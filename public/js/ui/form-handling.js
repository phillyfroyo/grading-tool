/**
 * Form Handling Module
 * Handles form submission, validation, and manual grading form management
 */

// Phase 6 followup: Track which tab owns the currently-running grading
// operation. Set by handleGradingFormSubmission when grading starts,
// cleared when the grading-finished event fires. Used to pin essayData
// and currentBatchData state writes to the originating tab, so that
// switching tabs mid-stream does not scramble state across tabs.
//
// This mirrors currentBatchTabId in batch-processing.js but lives here
// because the chunk stream callbacks are in this file and they need the
// context at write time. The two contexts are set at the same time
// (displayBatchProgress is called right after we capture here) and
// cleared by the same grading-finished event.
let currentBatchOriginTabId = null;

/**
 * Generate a stable, unique per-essay identifier. Used to bind grading
 * results to the correct student regardless of array position, retries, or
 * dropped/failed essays. Uses crypto.randomUUID when available, with a
 * collision-resistant fallback for older browsers.
 */
function generateEssayId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return 'essay-' + crypto.randomUUID();
    }
    // Fallback: timestamp + two random segments (no Date.now collisions across a single batch)
    return 'essay-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 10) + '-' +
        Math.random().toString(36).slice(2, 10);
}

/**
 * Get the tab ID to use for state writes during batch streaming. Returns
 * the originating tab if a batch is currently in progress, else falls
 * back to the currently active tab (safe default for edge cases).
 */
function getBatchWriteTabState() {
    if (!window.TabStore) return null;
    if (currentBatchOriginTabId) {
        return window.TabStore.get(currentBatchOriginTabId);
    }
    return window.TabStore.active();
}

// Listen for the grading-finished event from auto-save.js and clear the
// origin tab context. Done at module level so it fires on success or
// failure path alike.
if (typeof window !== 'undefined') {
    window.addEventListener('grading-finished', () => {
        currentBatchOriginTabId = null;
    });
}

/**
 * CSS class applied to invalid fields so the user can visually locate which
 * ones need attention. Styled in css/main.css.
 */
const INVALID_FIELD_CLASS = 'field-invalid';

function clearFieldErrors(form) {
    form.querySelectorAll('.' + INVALID_FIELD_CLASS).forEach(el => {
        el.classList.remove(INVALID_FIELD_CLASS);
    });
    // Also strip any stale legacy .error class from prior pageloads or
    // manual inspection — they cause a pink fill that clashes with the
    // red outline styling of .field-invalid.
    form.querySelectorAll('.error').forEach(el => {
        el.classList.remove('error');
    });
}

function markFieldInvalid(el) {
    if (el) el.classList.add(INVALID_FIELD_CLASS);
}

/**
 * Validate the grading form and return any missing-field messages.
 *
 * Scoped to the submitted form's DOM subtree via form.querySelectorAll, so
 * it naturally Just Works across multiple tabs — no tab-ID resolution
 * needed. (Previously validation used getElementById which always targeted
 * tab-1's error div due to duplicate IDs across tab panes.)
 *
 * Logic:
 *   - Class profile is required unless a custom prompt is provided.
 *   - The first essay row is always required (both name and text). This
 *     covers the "nothing filled in" case — user gets individual errors
 *     for the first row's name and text, not a generic "enter at least
 *     one essay" message.
 *   - Additional rows (2+) are only required if they're partially filled.
 *     Fully-blank rows 2+ are ignored — users often click "Add another
 *     essay" prematurely and leave rows empty.
 *
 * @param {HTMLFormElement} form - The submitted grading form
 * @returns {string[]} List of human-readable error messages. Empty = valid.
 */
function validateGradingForm(form) {
    clearFieldErrors(form);
    const errors = [];

    // Class profile (allow empty if a custom prompt is set — backwards compat
    // with the prior inline-error logic).
    const classProfileEl = form.querySelector('select[name="classProfile"]');
    const classProfile = classProfileEl ? (classProfileEl.value || '').trim() : '';
    const promptEl = document.querySelector('#prompt');
    const prompt = promptEl ? (promptEl.value || '').trim() : '';
    if (!classProfile && !prompt) {
        errors.push('Please select a class profile');
        markFieldInvalid(classProfileEl);
    }

    // Per-essay checks. All rows that exist are required — if the user
    // clicked "Add another essay" and left both name and text empty, that's
    // an unintentional blank row that should be fixed or removed rather
    // than silently skipped during grading.
    const essayEntries = form.querySelectorAll('.essay-entry');
    essayEntries.forEach((entry, idx) => {
        const nameEl = entry.querySelector('.student-name');
        const textEl = entry.querySelector('.student-text');
        const name = nameEl ? (nameEl.value || '').trim() : '';
        const text = textEl ? (textEl.value || '').trim() : '';
        const essayLabel = `Essay ${idx + 1}`;

        if (!name) {
            errors.push(`Student name required: ${essayLabel}`);
            markFieldInvalid(nameEl);
        }
        if (!text) {
            errors.push(`Paste student essay: ${essayLabel}`);
            markFieldInvalid(textEl);
        }
    });

    return errors;
}

/**
 * Show the collected validation errors as a single red toast. The AutoSave
 * module owns the toast styling; we just hand it the combined message.
 */
function showValidationToast(errors) {
    if (!errors || errors.length === 0) return;
    const message = errors.map(e => '• ' + e).join('\n');
    if (window.AutoSaveModule && typeof window.AutoSaveModule.showToast === 'function') {
        window.AutoSaveModule.showToast(message, 'error');
    } else {
        // Defensive fallback if AutoSaveModule hasn't loaded yet
        alert(message);
    }
}

/**
 * Handle manual grading form submission
 * @param {Event} e - Form submission event
 */
async function handleManualGradingSubmission(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const studentName = formData.get('studentName') || 'Student';
    const studentNickname = formData.get('studentNickname') || '';
    const essayText = formData.get('essayText') || '';

    if (!essayText.trim()) {
        showError('Please enter student essay text', 'Missing Essay Text');
        return;
    }

    // Show loading state
    const button = e.target.querySelector('.grade-button');
    const originalText = button.textContent;
    button.textContent = 'Generating Grade...';
    button.disabled = true;

    try {
        // Use the same GPT grading system but mark as manual mode
        const gradingData = {
            studentText: essayText,
            prompt: 'Manual grading mode - generate detailed feedback',
            classProfile: 'default-profile', // Use default profile for manual mode
            temperature: 0,
            studentName: studentName,
            studentNickname: studentNickname,
            isManualMode: true
        };

        const response = await fetch('/api/grade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gradingData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Mark result as manual and display
            result.isManual = true;
            result.studentName = studentName;
            result.originalEssayText = essayText;

            // Display results using the grading display module
            if (window.GradingDisplayModule) {
                window.GradingDisplayModule.displayResults(result, gradingData);
            } else {
                console.error('GradingDisplayModule not available');
            }
        } else {
            throw new Error(result.error || 'Grading failed');
        }

    } catch (error) {
        console.error('Manual grading error:', error);
        showError('Error generating grade: ' + error.message, 'Grading Error');
    } finally {
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Handle main grading form submission
 * @param {Event} e - Form submission event
 */
async function handleGradingFormSubmission(e) {
    e.preventDefault();

    // Validate required fields and show a single combined error toast if
    // anything is missing. Form-scoped queries so this works correctly in
    // every tab (getElementById used to silently target tab-1 only).
    const validationErrors = validateGradingForm(e.target);
    if (validationErrors.length > 0) {
        showValidationToast(validationErrors);
        return;
    }

    // Phase 6: Hard-enforce the grading lock. The Grade button in
    // non-originating tabs is disabled via tab-management.js, but we also
    // check here as defense-in-depth against keyboard submits or
    // programmatic form.submit() calls.
    if (window.AutoSaveModule && typeof window.AutoSaveModule.isGradingInProgress === 'function') {
        if (window.AutoSaveModule.isGradingInProgress()) {
            showError(
                'Grading is already in progress in another tab. Please wait for it to finish before starting a new one.',
                'Grading in Progress'
            );
            return;
        }
    }

    // Phase 6 followup: Capture the originating tab ID before any async
    // work starts. This ID is used by the streaming chunk callbacks to
    // pin their essayData and currentBatchData writes to the correct
    // tab, even if the user switches to a different tab mid-stream.
    currentBatchOriginTabId = (window.TabStore && window.TabStore.activeId()) || null;

    const formData = new FormData(e.target);
    const studentName = formData.get('studentName') || 'Student';
    const classProfile = formData.get('classProfile') || '';

    // Get temperature from the selected profile
    let temperature = 0;
    if (classProfile && window.ProfilesModule) {
        const profiles = window.ProfilesModule.getProfiles();
        const selectedProfile = profiles.find(p => p.id === classProfile);
        if (selectedProfile && selectedProfile.temperature !== undefined) {
            temperature = selectedProfile.temperature;
        }
    }
    // Fallback to form field if it exists (for backwards compatibility)
    if (!temperature) {
        const temp = parseFloat(formData.get('temperature'));
        temperature = (isNaN(temp) || !isFinite(temp)) ? 0 : temp;
    }

    // Get all student texts from the form
    const studentTexts = [];
    const textareas = e.target.querySelectorAll('.student-text');
    textareas.forEach((textarea, index) => {
        if (textarea.value.trim()) {
            const studentNameField = textarea.closest('.essay-entry').querySelector('.student-name');
            const studentNicknameField = textarea.closest('.essay-entry').querySelector('.student-nickname');
            const individualName = studentNameField ? studentNameField.value.trim() : '';
            const individualNickname = studentNicknameField ? studentNicknameField.value.trim() : '';
            studentTexts.push({
                // Stable per-essay identity. This UUID is the ONLY thing that
                // binds a result back to its student — never array position —
                // so a dropped/failed/retried essay can't slide results onto
                // the wrong student name. Threaded through: batchData →
                // backend (echoed on every SSE event) → DOM (data-essay-id) →
                // essayData/renderedHTML → auto-save/restore.
                essayId: generateEssayId(),
                text: textarea.value.trim(),
                studentName: individualName || `${studentName} ${index + 1}`.trim(),
                studentNickname: individualNickname
            });
        }
    });

    if (studentTexts.length === 0) {
        showError('Please enter at least one essay to grade.', 'No Essays Found');
        return;
    }

    // Per-tab essay cap is enforced at ADD time in essay-management.js (the
    // "Add another essay" button + counter stop at MAX_ESSAYS_PER_TAB), so a
    // teacher can't build an over-limit batch and only discover it here at
    // "Grade". As a silent safety net for any path that bypasses the add-time UI
    // (e.g. programmatic), clamp here without a disruptive error modal: grade the
    // first MAX_ESSAYS_PER_TAB and warn via the lightweight toast.
    const MAX_ESSAYS_PER_TAB = 10;
    if (studentTexts.length > MAX_ESSAYS_PER_TAB) {
        const dropped = studentTexts.length - MAX_ESSAYS_PER_TAB;
        studentTexts.length = MAX_ESSAYS_PER_TAB;
        if (window.AutoSaveModule && window.AutoSaveModule.showToast) {
            window.AutoSaveModule.showToast(
                `Grading the first ${MAX_ESSAYS_PER_TAB} essays (max per tab). ` +
                `Move the other ${dropped} to a new tab.`,
                'warn'
            );
        }
    }


    // Show loading state
    const button = e.target.querySelector('button[type="submit"]');
    if (!button) {
        console.error('Could not find submit button');
        return;
    }
    const originalText = button.textContent;
    button.textContent = 'Grading essays...';
    button.disabled = true;

    // Mark grading as in progress so a page reload mid-grading will show
    // the "interrupted" variant of the restore modal. Cleared in finally.
    if (window.AutoSaveModule) {
        window.AutoSaveModule.markGradingStarted();
    }

    try {
        if (studentTexts.length === 1) {
            // Single essay grading. Validation already ran at the top of
            // handleGradingFormSubmission via validateGradingForm — class
            // profile / custom prompt / student name / essay text all
            // already required. We just need the prompt here for the request.
            const prompt = document.querySelector('#prompt')?.value?.trim() || '';

            const gradingData = {
                studentText: studentTexts[0].text,
                studentName: studentTexts[0].studentName,
                studentNickname: studentTexts[0].studentNickname,
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature,
                isManualMode: false
            };

            // Show progress UI for single essay (same as batch)
            const singleEssayBatchData = {
                essays: [{
                    studentName: studentTexts[0].studentName,
                    studentNickname: studentTexts[0].studentNickname,
                    studentText: studentTexts[0].text
                }]
            };

            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.displayBatchProgress(singleEssayBatchData);
            }

            const response = await fetch('/api/grade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gradingData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Update progress UI to show completion
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.updateEssayStatus(0, true);
                }

                // Convert single result to batch format for consistent display
                const batchResult = {
                    results: [{
                        success: true,
                        studentName: studentTexts[0].studentName,
                        result: result.result || result
                    }],
                    totalEssays: 1
                };

                // Display using batch results display for consistent UI
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.displayBatchResults(batchResult, singleEssayBatchData);
                } else if (window.GradingDisplayModule) {
                    // Fallback to original display method
                    window.GradingDisplayModule.displayResults(result, gradingData);
                } else {
                    console.error('Neither BatchProcessingModule nor GradingDisplayModule available');
                }

                // Auto-save after single essay grading completes, then
                // lock the form so the user can't accidentally submit a
                // new batch on top of the saved session.
                // Phase 7: scope the lock to the originating tab so only
                // that tab's form collapses, not all tabs.
                if (window.AutoSaveModule) {
                    const lockTabId = currentBatchOriginTabId;
                    setTimeout(() => {
                        window.AutoSaveModule.saveImmediately();
                        window.AutoSaveModule.setFormLocked(true, lockTabId);
                    }, 1000);
                }
            } else {
                // Update progress UI to show failure for single essay
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.updateEssayStatus(0, false, result.error || 'Grading failed');
                }
                console.error('📋 Grading failed - full response:', result);
                throw new Error(result.error || 'Grading failed');
            }
        } else {
            // Batch essay grading. Validation already ran at the top of
            // handleGradingFormSubmission via validateGradingForm — class
            // profile / custom prompt / per-essay name and text all
            // already required.
            const prompt = document.querySelector('#prompt')?.value?.trim() || '';

            const batchData = {
                essays: studentTexts.map(essay => ({
                    essayId: essay.essayId,
                    studentText: essay.text,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname
                })),
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature
            };

            // Show the progress UI only after validation passes
            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.displayBatchProgress(batchData);
            }

            // Reset the format-call tracker so the post-stream save can
            // wait until every essay's /format call has completed before
            // snapshotting renderedHTML. See TODO.md: "INTERMITTENT:
            // Category Breakdown not editable post-restore".
            if (window.BatchProcessingModule?.resetFormatCallTracking) {
                window.BatchProcessingModule.resetFormatCallTracking(batchData.essays.length);
            }

            // Use streaming batch endpoint for better UX (essays return progressively)
            console.log(`[AutoSaveDiag] streaming start: ${batchData.essays.length} essays submitted`);

            // Store original batch data for retry functionality — pinned to
            // the originating tab via currentBatchOriginTabId, with a
            // fallback to the legacy window global during the multi-phase
            // migration.
            const submitTabState = getBatchWriteTabState();
            if (submitTabState) {
                submitTabState.originalBatchDataForRetry = batchData;
            } else {
                window.originalBatchDataForRetry = batchData;
            }

            try {
                const streamResult = await streamBatchGradingSimple(batchData);

                // Read current batch data from the ORIGINATING tab (not the
                // currently-active tab), with window fallback. This is
                // essential after streaming finishes because the user may
                // have switched tabs during the stream.
                const readCurrentBatchData = () => {
                    const originState = getBatchWriteTabState();
                    return (originState && originState.currentBatchData) || window.currentBatchData;
                };

                const preExisting = !!readCurrentBatchData();
                const preExistingCount = readCurrentBatchData()?.batchResult?.results?.length;
                const streamCount = streamResult?.results?.length;
                console.log(
                    `[AutoSaveDiag] streaming done: streamResult.results=${streamCount}, ` +
                    `currentBatchData already set=${preExisting} (len=${preExistingCount ?? 'n/a'})`
                );

                // Ensure currentBatchData is set after streaming completes
                // (streaming displays results individually via queue, skipping displayBatchResults)
                if (!readCurrentBatchData() && streamResult) {
                    const newBatchData = {
                        batchResult: streamResult,
                        originalData: batchData
                    };
                    const postStreamTabState = getBatchWriteTabState();
                    if (postStreamTabState) {
                        postStreamTabState.currentBatchData = newBatchData;
                    } else {
                        window.currentBatchData = newBatchData;
                    }
                    console.log(`[AutoSaveDiag] assigned currentBatchData from streamResult (len=${streamCount})`);
                } else if (preExisting && preExistingCount !== streamCount) {
                    console.warn(
                        `[AutoSaveDiag] MISMATCH: currentBatchData was already set with len=${preExistingCount} ` +
                        `but streamResult has len=${streamCount}. Save will use the pre-existing value!`
                    );
                }

                // Auto-save after streaming batch completes. We must wait
                // until every essay's /format call has finished, otherwise
                // the save will snapshot loading-spinner placeholders for
                // essays that are still mid-load — which then can't be
                // edited after a page refresh. See TODO.md.
                if (window.AutoSaveModule) {
                    // Capture the origin tab ID NOW, before the grading-finished
                    // event (fired by markGradingFinished in the finally block)
                    // clears currentBatchOriginTabId. The async block below runs
                    // AFTER the finally block, so currentBatchOriginTabId would
                    // already be null by the time setFormLocked fires.
                    const lockTargetTabId = currentBatchOriginTabId;
                    (async () => {
                        console.log(`[AutoSaveDiag] waiting for /format calls before save...`);
                        if (window.BatchProcessingModule?.waitForAllFormatCalls) {
                            const result = await window.BatchProcessingModule.waitForAllFormatCalls();
                            console.log(
                                `[AutoSaveDiag] /format wait done: ${result.done}/${result.expected}, ` +
                                `completed=${result.completed}`
                            );
                        }
                        // Extra 300ms buffer for the 200ms setTimeout inside
                        // loadEssayDetails that wires up setupBatchEditableElements
                        // after the fetch resolves. Without this buffer the save
                        // could capture HTML that is structurally correct but not
                        // yet event-wired (restore will rewire it anyway, so this
                        // is just belt-and-suspenders).
                        await new Promise(r => setTimeout(r, 300));
                        console.log(`[AutoSaveDiag] firing saveImmediately (post-format-complete)`);
                        window.AutoSaveModule.saveImmediately();
                        window.AutoSaveModule.showClearButton('Grading complete');
                        // Phase 7: scope the lock to the originating tab only
                        window.AutoSaveModule.setFormLocked(true, lockTargetTabId);

                        // Clear the batch tab context now that all format calls
                        // are done and the save has fired. From this point,
                        // tabScopedQuery in batch-processing.js falls back to
                        // activeQuery (correct for post-grading user interactions
                        // like expand, retry, download).
                        if (window.BatchProcessingModule && window.BatchProcessingModule.clearBatchTabContext) {
                            window.BatchProcessingModule.clearBatchTabContext();
                        }
                    })();
                }
            } catch (streamError) {
                console.error('Streaming failed, using fallback:', streamError);
                await fallbackToBatchProcessing(batchData);
            }
        }

    } catch (error) {
        console.error('Grading error:', error);
        showError('Error during grading: ' + error.message, 'Grading Error');
    } finally {
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;

        // Clear the in-progress flag. The next save (which already fires at
        // stream_done+2s on success, or is unneeded on failure) will persist
        // the cleared state. On failure we leave any partial saved session
        // alone — the user will see it on next refresh as "interrupted".
        if (window.AutoSaveModule) {
            window.AutoSaveModule.markGradingFinished();
        }
    }
}

/**
 * Setup main grading form functionality
 */
function setupMainGrading() {
    const gradingForm = window.TabStore
        ? window.TabStore.activeQuery('#gradingForm')
        : document.getElementById('gradingForm');
    if (gradingForm) {
        // Disable HTML5 native validation so browser tooltips don't compete
        // with our validation toasts. Our validateGradingForm runs first
        // and shows a single combined red toast for all missing fields.
        gradingForm.noValidate = true;
        gradingForm.addEventListener('submit', handleGradingFormSubmission);

        // Clear the .field-invalid red outline as soon as the user starts
        // typing/pasting/selecting into a flagged field. Uses event
        // delegation on the form so it covers all current AND future fields
        // (e.g. rows added via "Add another essay" after the form loads).
        // Listens for both 'input' (text boxes, textareas) and 'change'
        // (select dropdown — input also fires for select, but change is the
        // canonical event for select value changes).
        const clearOwnInvalidState = (e) => {
            if (e.target && e.target.classList
                && e.target.classList.contains(INVALID_FIELD_CLASS)) {
                e.target.classList.remove(INVALID_FIELD_CLASS);
            }
        };
        gradingForm.addEventListener('input', clearOwnInvalidState);
        gradingForm.addEventListener('change', clearOwnInvalidState);
    } else {
        console.warn('Main grading form not found');
    }
}

/**
 * Setup manual grading functionality
 */
function setupManualGrading() {
    const manualForm = document.getElementById('manualGradingForm');
    if (manualForm) {
        manualForm.addEventListener('submit', handleManualGradingSubmission);
    }
    // Note: manual grading form is optional; no warning when missing
}


/**
 * Clear manual grading form
 */
function clearManualForm() {
    const form = document.getElementById('manualGradingForm');
    if (form) {
        form.reset();
    }

    // Clear results display
    const resultsContainer = document.getElementById('manualResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
}

/**
 * Validate form input
 * @param {HTMLFormElement} form - Form to validate
 * @returns {boolean} True if valid
 */
function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('error');
            isValid = false;
        } else {
            field.classList.remove('error');
        }
    });

    return isValid;
}

/**
 * Stream batch grading using Server-Sent Events
 * CHUNKING: Splits large batches into chunks to avoid SSE connection timeouts
 * Vercel appears to have ~5 minute SSE connection limit, so we chunk to stay under
 * @param {Object} batchData - The batch data to process
 */
async function streamBatchGradingSimple(batchData) {
    const CHUNK_SIZE = 2; // 2 essays = 1 batch of 2, matches backend BATCH_SIZE
    const totalEssays = batchData.essays.length;

    // If batch is small enough, process in single request
    if (totalEssays <= CHUNK_SIZE) {
        const smallResult = await processEssayChunk(batchData, 0);
        // Keep currentBatchData in sync so any save firing here sees the truth.
        // Write to the batch's originating tab so state is not scrambled when
        // the user switches tabs mid-stream.
        const smallBatch = {
            batchResult: smallResult,
            originalData: batchData
        };
        const smallTabState = getBatchWriteTabState();
        if (smallTabState) {
            smallTabState.currentBatchData = smallBatch;
        } else {
            window.currentBatchData = smallBatch;
        }
        return smallResult;
    }

    // Large batch - split into chunks and process sequentially
    let allResults = [];
    let processedCount = 0;

    while (processedCount < totalEssays) {
        const chunkStart = processedCount;
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalEssays);
        const chunkEssays = batchData.essays.slice(chunkStart, chunkEnd);

        const chunkData = {
            ...batchData,
            essays: chunkEssays
        };

        try {
            const chunkResult = await processEssayChunk(chunkData, chunkStart);

            // Merge results
            if (chunkResult.results) {
                allResults = allResults.concat(chunkResult.results);
            }
            console.log(
                `[AutoSaveDiag] chunk ${chunkStart}-${chunkEnd - 1} done: ` +
                `chunkResult.results=${chunkResult?.results?.length}, allResults=${allResults.length}`
            );

            // Update currentBatchData incrementally so any save firing mid-batch
            // (debounced from user edits, etc.) sees the latest known results
            // instead of triggering the buildPayload reconstruction fallback.
            // Pinned to the originating tab so state writes don't cross tabs
            // when the user switches mid-stream.
            const chunkBatch = {
                batchResult: {
                    success: true,
                    results: allResults,
                    totalEssays: totalEssays
                },
                originalData: batchData
            };
            const chunkTabState = getBatchWriteTabState();
            if (chunkTabState) {
                chunkTabState.currentBatchData = chunkBatch;
            } else {
                window.currentBatchData = chunkBatch;
            }

            processedCount = chunkEnd;

        } catch (error) {
            console.error(`❌ Chunk failed: Essays ${chunkStart + 1}-${chunkEnd}:`, error.message);

            // Append an explicit failed result for EVERY essay in the failed
            // chunk, bound to its essayId. Without this, the failed chunk
            // contributes nothing to allResults and every later chunk's essays
            // shift up into these slots — a silent student/grade swap. Keeping
            // the array positionally complete (1:1 with batchData.essays) is
            // what makes pairing safe.
            chunkEssays.forEach((submitted, i) => {
                const globalIndex = chunkStart + i;
                allResults.push({
                    essayId: submitted.essayId,
                    success: false,
                    error: `Chunk failed: ${error.message}`,
                    result: null,
                    studentName: submitted.studentName,
                    studentNickname: submitted.studentNickname,
                    index: globalIndex
                });
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.updateEssayStatus(globalIndex, false, `Chunk failed: ${error.message}`, submitted.essayId);
                }
            });

            // Continue with next chunk instead of failing entire batch
            processedCount = chunkEnd;
        }
    }

    return {
        success: true,
        results: allResults,
        totalEssays: totalEssays
    };
}

/**
 * Process a chunk of essays via Server-Sent Events
 * @param {Object} chunkData - The chunk data to process
 * @param {number} globalOffset - Starting index in the global essay list
 */
async function processEssayChunk(chunkData, globalOffset) {
    return new Promise((resolve, reject) => {
        let processedResults = [];
        let timeoutId;
        let reader; // hoisted so finishChunk() can cancel the stream
        // Guard so the chunk resolves exactly once. The chunk can now be
        // finished by any of: the 'complete' event, the stream 'done' close,
        // OR the per-essay watchdog completing the last pending essay (so a
        // server that never closes the stream — the real infinite-load — still
        // lets the batch finish and the post-grade auto-save fire).
        let settled = false;
        function finishChunk() {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            clearAllPerEssayTimers();
            try { reader && reader.cancel && reader.cancel(); } catch (e) { /* best-effort */ }
            resolve({
                success: true,
                results: buildAlignedChunkResults(),
                totalEssays: chunkData.essays.length
            });
        }
        // Resolve the chunk once every submitted essay has a terminal result,
        // regardless of whether the server has closed the stream.
        function resolveIfAllDone() {
            for (let i = 0; i < chunkData.essays.length; i++) {
                if (processedResults[i] === undefined) return; // still waiting on someone
            }
            console.log('[AutoSaveDiag] chunk all essays terminal — resolving without waiting for stream close');
            finishChunk();
        }
        const TIMEOUT_MS = 1200000; // 20 minutes - allow server to complete large batches

        // Per-essay watchdog timers, keyed by local chunk index. Each starts
        // when that essay's 'processing' event arrives (i.e. it was actually
        // sent to GPT — NOT at submit time, so queued essays don't false-fail),
        // and is cleared by its 'result' or 'error' event. If it fires, the
        // essay never came back: mark it failed, bound to the correct student
        // via essayId, so the user sees a clear placeholder + retry instead of
        // an infinite spinner that could desync on refresh.
        const PER_ESSAY_TIMEOUT_MS = 120000; // 120s after an essay is sent to GPT
        const perEssayTimers = {};
        function clearPerEssayTimer(localIdx) {
            if (perEssayTimers[localIdx]) {
                clearTimeout(perEssayTimers[localIdx]);
                delete perEssayTimers[localIdx];
            }
        }
        function clearAllPerEssayTimers() {
            Object.keys(perEssayTimers).forEach(k => clearTimeout(perEssayTimers[k]));
            for (const k in perEssayTimers) delete perEssayTimers[k];
        }
        function failEssayTimedOut(localIdx) {
            // Only act if no terminal result was recorded for this essay.
            if (processedResults[localIdx] !== undefined) return;
            const submitted = chunkData.essays[localIdx];
            const gIdx = globalOffset + localIdx;
            const eid = submitted && submitted.essayId;
            console.error(`⏱️ Per-essay timeout: "${submitted && submitted.studentName}" (essayId ${eid}) did not return within ${PER_ESSAY_TIMEOUT_MS / 1000}s of being sent to GPT`);
            processedResults[localIdx] = {
                essayId: eid,
                success: false,
                error: 'Essay did not return (timed out after being sent for grading)',
                result: null,
                studentName: submitted && submitted.studentName,
                studentNickname: submitted && submitted.studentNickname,
                index: gIdx
            };
            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.updateEssayStatus(gIdx, false, 'Essay did not return — please retry', eid);
            }
            // If this was the last pending essay, finish the chunk now rather
            // than waiting for a stream close that may never come.
            resolveIfAllDone();
        }
        // Build a results array with exactly one entry per submitted essay,
        // positionally aligned to chunkData.essays. Missing slots become
        // explicit failures bound to the correct essayId/student. Used by both
        // the 'complete' event and the stream-close ('done') path so neither
        // can produce a collapsed/sparse array (the swap vector).
        function buildAlignedChunkResults() {
            return chunkData.essays.map((submitted, localIdx) => {
                const r = processedResults[localIdx];
                if (r !== undefined) {
                    return {
                        essayId: r.essayId || submitted.essayId,
                        success: r.success,
                        error: r.error,
                        result: r.result,
                        studentName: r.studentName || submitted.studentName,
                        studentNickname: r.studentNickname ?? submitted.studentNickname,
                        index: r.index
                    };
                }
                return {
                    essayId: submitted.essayId,
                    success: false,
                    error: 'Essay did not return',
                    result: null,
                    studentName: submitted.studentName,
                    studentNickname: submitted.studentNickname,
                    index: globalOffset + localIdx
                };
            });
        }
        // Note: Server-Sent Events (SSE) bypass Vercel's normal 10s timeout for serverless functions

        // Set up timeout detection - mainly for detecting stalled connections
        timeoutId = setTimeout(() => {
            console.error('⏱️ SSE TIMEOUT: Request exceeded 20 minutes', {
                chunkSize: chunkData.essays.length,
                globalOffset,
                processedSoFar: processedResults.length,
                missingCount: chunkData.essays.length - processedResults.length,
                timestamp: new Date().toISOString()
            });
            if (settled) return;
            reject(new Error(`SSE timeout after 20 minutes. Processed ${processedResults.length}/${chunkData.essays.length} essays.`));
        }, TIMEOUT_MS);

        // Use direct fetch with streaming instead of EventSource
        fetch('/api/grade-batch?stream=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chunkData)
        }).then(response => {
            if (!response.ok) {
                clearTimeout(timeoutId);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function readStream() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        // Stream closed. finishChunk() reconciles into one
                        // aligned result per submitted essay (failures synthesized
                        // for any that never returned) and is idempotent via the
                        // settled guard, so it's safe if the watchdog already
                        // resolved the chunk.
                        finishChunk();
                        return;
                    }
                    if (settled) return; // chunk already resolved; stop reading

                    // Process the streamed data
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer

                    lines.forEach(line => {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                handleStreamingMessage(data);
                            } catch (e) {
                                console.error('Error parsing streaming data:', e);
                            }
                        }
                    });

                    return readStream();
                });
            }

            return readStream();
        }).catch(error => {
            clearTimeout(timeoutId);
            clearAllPerEssayTimers();
            console.error('❌ SSE fetch error:', error.message);
            // If the watchdog already resolved this chunk, ignore the late
            // stream error (e.g. our own reader.cancel()).
            if (settled) return;
            reject(error);
        });

        function handleStreamingMessage(data) {
            switch (data.type) {
                case 'start':
                    break;

                case 'processing':
                    // This essay was just sent to GPT — start its watchdog.
                    if (data.index !== undefined) {
                        clearPerEssayTimer(data.index);
                        perEssayTimers[data.index] = setTimeout(
                            () => failEssayTimedOut(data.index),
                            PER_ESSAY_TIMEOUT_MS
                        );
                    }
                    break;

                case 'result':
                        // Terminal event for this essay — stop its watchdog.
                        clearPerEssayTimer(data.index);
                        const globalResultIndex = data.index + globalOffset;

                        // Adjust data index to global position
                        const adjustedData = {
                            ...data,
                            index: globalResultIndex
                        };

                        // Store the result (use local index for chunk array)
                        processedResults[data.index] = adjustedData;

                        // Store essay data for expansion (use GLOBAL index).
                        // Pinned to the originating tab — this is the critical
                        // fix for the "essays stuck on loading messages" bug:
                        // if the user switches tabs mid-stream, TabStore.active()
                        // returns the new tab, and the essayData writes would
                        // land in the wrong tab. getBatchWriteTabState() returns
                        // the tab that started the batch regardless of the
                        // current active tab.
                        // Resolve the stable essayId: prefer the backend echo,
                        // fall back to the submitted essay (same object we sent).
                        const submittedEssay = chunkData.essays[data.index];
                        const resolvedEssayId = data.essayId || (submittedEssay && submittedEssay.essayId);
                        adjustedData.essayId = resolvedEssayId;

                        if (data.success && submittedEssay) {
                            const streamSnapshot = {
                                essay: {
                                    success: true,
                                    essayId: resolvedEssayId,
                                    result: data.result,
                                    studentName: data.studentName || submittedEssay.studentName
                                },
                                originalData: {
                                    ...submittedEssay,
                                    essayId: resolvedEssayId,
                                    index: globalResultIndex,
                                    classProfile: chunkData.classProfile || null
                                }
                            };
                            const streamTabState = getBatchWriteTabState();
                            // Key essayData by BOTH the stable essayId (primary,
                            // swap-proof) and the global index (legacy lookups
                            // still in place during the migration).
                            if (streamTabState) {
                                streamTabState.essayData[globalResultIndex] = streamSnapshot;
                                if (resolvedEssayId) streamTabState.essayData[resolvedEssayId] = streamSnapshot;
                            } else {
                                window[`essayData_${globalResultIndex}`] = streamSnapshot;
                                if (resolvedEssayId) window[`essayData_${resolvedEssayId}`] = streamSnapshot;
                            }
                        }

                        // Queue this result for staggered display
                        if (!window.batchResultQueue) {
                            window.batchResultQueue = [];
                            window.batchQueueProcessor = null;
                        }

                        window.batchResultQueue.push(adjustedData);

                        // Start processing queue if not already running
                        if (!window.batchQueueProcessor) {
                            processBatchResultQueue();
                        }
                        break;

                    case 'complete':
                        // finishChunk() builds one aligned entry per submitted
                        // essay (never collapsed) and is idempotent.
                        finishChunk();
                        break;

                    case 'error':
                        // Terminal event for this essay — stop its watchdog.
                        if (data.index !== undefined) clearPerEssayTimer(data.index);
                        const globalErrorIndex = data.index !== undefined ? data.index + globalOffset : undefined;
                        const erroredEssay = data.index !== undefined ? chunkData.essays[data.index] : undefined;
                        const erroredEssayId = data.essayId || (erroredEssay && erroredEssay.essayId);
                        console.error('❌ Backend streaming error:', {
                            error: data.error,
                            localIndex: data.index,
                            globalIndex: globalErrorIndex,
                            essayId: erroredEssayId,
                            chunkSize: chunkData.essays.length,
                            globalOffset
                        });
                        // Record the failure in the positional results array so
                        // the 'complete' handler emits it (bound to essayId)
                        // instead of synthesizing a generic failure.
                        if (data.index !== undefined) {
                            processedResults[data.index] = {
                                essayId: erroredEssayId,
                                success: false,
                                error: data.error,
                                result: null,
                                studentName: data.studentName || (erroredEssay && erroredEssay.studentName),
                                studentNickname: erroredEssay && erroredEssay.studentNickname,
                                index: globalErrorIndex
                            };
                        }
                        if (window.BatchProcessingModule && globalErrorIndex !== undefined) {
                            window.BatchProcessingModule.updateEssayStatus(globalErrorIndex, false, data.error, erroredEssayId);
                        }
                        // If this error completed the last pending essay, finish
                        // the chunk without waiting for a stream close.
                        resolveIfAllDone();
                        break;

                    default:
                        console.warn('Unknown message type:', data.type);
            }
        }

        // Streaming will complete when fetch response ends
    });
}

/**
 * Fallback to regular batch processing if streaming fails
 * @param {Object} batchData - The batch data to process
 */
async function fallbackToBatchProcessing(batchData) {
    console.log('🔄 Using fallback batch processing');

    const response = await fetch('/api/grade-batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && window.BatchProcessingModule) {
        window.BatchProcessingModule.displayBatchResults(result, batchData);
    }

    return result;
}

/**
 * Setup form validation for all forms
 */
function setupFormValidation() {
    document.querySelectorAll('form').forEach(form => {
        // Skip the grading form — it has its own tab-aware validation via
        // validateGradingForm + toast messaging. Running the legacy
        // validateForm on top would add the .error class (pink fill) which
        // clashes with the .field-invalid outline styling.
        if (form.id === 'gradingForm') return;

        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                console.warn('Form validation failed');
            }
        });
    });
}

/**
 * Process batch results with 1-second delay between each
 */
function processBatchResultQueue() {
    if (!window.batchResultQueue || window.batchResultQueue.length === 0) {
        window.batchQueueProcessor = null;
        // Note: we used to fire saveImmediately here when the queue drained,
        // but the queue drains between chunks in a chunked batch (since chunks
        // are sequential and the queue processor runs on a 3s stagger),
        // causing partial-state saves that corrupted currentBatchData via the
        // buildPayload reconstruction fallback. The authoritative post-batch
        // save now lives in handleGradingFormSubmission, fired 2s after
        // streamBatchGradingSimple fully resolves.
        return;
    }

    // Stagger was previously 3000ms which made the post-stream save wait
    // up to N × 3s for all essays to trigger their /format call. Since
    // dropdowns are collapsed by default, the user doesn't actually see
    // the staggered "pop-in" effect — it was cosmetic for a UX that
    // doesn't apply. 100ms is fast enough to let /format calls fire in
    // near-parallel without overwhelming the DOM.
    window.batchQueueProcessor = setTimeout(() => {
        const data = window.batchResultQueue.shift();

        // Resolve the DOM row by the stable essayId (swap-safe). Fall back to
        // the result's index only if the id can't be matched (legacy/no-id).
        const targetIndex = (window.BatchProcessingModule
            && window.BatchProcessingModule.resolveRowIndexByEssayId
            && data.essayId != null)
            ? (window.BatchProcessingModule.resolveRowIndexByEssayId(data.essayId) ?? data.index)
            : data.index;

        // Update the UI for this essay (pass essayId so status lands on the
        // correct student even if positions shifted).
        if (window.BatchProcessingModule) {
            window.BatchProcessingModule.updateEssayStatus(targetIndex, data.success, data.error, data.essayId);
        }

        // Pre-load the essay content so users can click and view it right away
        if (data.success) {
            if (window.BatchProcessingModule && window.BatchProcessingModule.loadEssayDetails) {
                window.BatchProcessingModule.loadEssayDetails(targetIndex, data.essayId);
            }
        }

        // Continue processing queue
        processBatchResultQueue();
    }, 100); // 100ms — fast, collapsed dropdowns make staggering moot
}

// Export functions for module usage
window.FormHandlingModule = {
    handleGradingFormSubmission,
    handleManualGradingSubmission,
    setupMainGrading,
    setupManualGrading,
    clearManualForm,
    validateForm,
    setupFormValidation,
    streamBatchGradingSimple,
    processEssayChunk,
    fallbackToBatchProcessing,
    processBatchResultQueue
};