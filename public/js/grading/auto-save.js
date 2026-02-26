/**
 * Auto-Save Module
 * Persists grading session data to the database so results survive page reloads.
 * Exposes window.AutoSaveModule.
 */
(function () {
    'use strict';

    // --- State ---
    let isSaving = false;
    let isRestoring = false;
    let debounceTimer = null;
    let initialized = false;
    let lastSuccessfulSaveTime = 0;
    let hasPendingChanges = false;
    const DEBOUNCE_MS = 2500;

    // --- Public API ---

    function initialize() {
        if (initialized) return;
        initialized = true;

        // Debounced save on score / feedback edits (event delegation)
        document.addEventListener('input', function (e) {
            if (
                e.target.classList.contains('editable-score') ||
                e.target.classList.contains('editable-feedback') ||
                e.target.classList.contains('score-input') ||
                e.target.closest('.editable-score') ||
                e.target.closest('.editable-feedback')
            ) {
                debouncedSave();
            }
        });

        // Save on checkbox changes: mark-complete, remove-from-PDF toggles
        document.addEventListener('change', function (e) {
            if (
                e.target.classList.contains('mark-complete-checkbox') ||
                e.target.classList.contains('remove-all-checkbox')
            ) {
                debouncedSave();
            }
        });

        // Save on click for toggle buttons: category note PDF toggle, highlight PDF toggle
        document.addEventListener('click', function (e) {
            if (
                e.target.classList.contains('toggle-note-pdf-btn') ||
                e.target.classList.contains('toggle-pdf-btn') ||
                e.target.closest('.toggle-note-pdf-btn') ||
                e.target.closest('.toggle-pdf-btn')
            ) {
                debouncedSave();
            }
        });

        // Save on event bus events: highlight edits, teacher notes
        function listenToEventBus() {
            if (window.eventBus) {
                window.eventBus.on('highlight:updated', function () { debouncedSave(); });
                window.eventBus.on('highlight:removed', function () { debouncedSave(); });
                window.eventBus.on('teacher-notes:saved', function () { debouncedSave(); });
            } else {
                // eventBus module may not have loaded yet; retry shortly
                setTimeout(listenToEventBus, 500);
            }
        }
        listenToEventBus();

        // beforeunload safety-net via sendBeacon — only if we have unsaved changes
        window.addEventListener('beforeunload', function () {
            // Skip beacon if we have no pending changes (already saved recently)
            if (!hasPendingChanges && (Date.now() - lastSuccessfulSaveTime) < 10000) {
                console.log('[AutoSave] beforeunload: no pending changes, skipping beacon');
                return;
            }
            const payload = buildPayload();
            if (payload) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                // If payload is too large for sendBeacon (~64KB), strip renderedHTML
                if (blob.size > 60000) {
                    const lite = buildPayload(true);
                    if (lite) {
                        navigator.sendBeacon('/api/grading-session', new Blob([JSON.stringify(lite)], { type: 'application/json' }));
                    }
                } else {
                    navigator.sendBeacon('/api/grading-session', blob);
                }
            }
        });

        console.log('[AutoSave] Initialized');
    }

    /**
     * Save immediately (called after grading completes).
     */
    function saveImmediately() {
        clearDebounce();
        hasPendingChanges = true;
        return doSave();
    }

    /**
     * Schedule a debounced save.
     */
    function debouncedSave() {
        clearDebounce();
        hasPendingChanges = true;
        debounceTimer = setTimeout(() => doSave(), DEBOUNCE_MS);
    }

    /**
     * Load saved session from server and restore UI.
     * Returns true if a session was restored.
     */
    async function loadAndRestore() {
        try {
            const resp = await fetch('/api/grading-session');
            if (!resp.ok) return false;
            const data = await resp.json();
            if (!data.exists) return false;

            const { activeTab, sessionData } = data;
            console.log('[AutoSave] Restoring saved session…');
            isRestoring = true;

            // 1. Switch to saved tab
            if (activeTab && window.TabManagementModule) {
                window.TabManagementModule.switchTab(activeTab);
            }

            // 2. Render student list skeleton via displayBatchResults
            //    (this overwrites essayData_* globals with originals, so we re-restore after)
            if (sessionData.currentBatchData && window.BatchProcessingModule) {
                window.currentBatchData = sessionData.currentBatchData;
                const { batchResult, originalData } = window.currentBatchData;
                const bData = originalData || window.currentBatchData.batchData;
                if (batchResult && bData) {
                    window.BatchProcessingModule.displayBatchResults(batchResult, bData);
                }
            }

            // 3. Re-restore window globals (displayBatchResults overwrites essayData_* with originals)
            if (sessionData.currentBatchData) {
                window.currentBatchData = sessionData.currentBatchData;
            }
            if (sessionData.essaySnapshots) {
                Object.entries(sessionData.essaySnapshots).forEach(([key, val]) => {
                    window[key] = val;
                });
            }

            // 4. Inject saved rendered HTML (skip /format call)
            const htmlKeys = sessionData.renderedHTML ? Object.keys(sessionData.renderedHTML) : [];
            console.log('[AutoSave] renderedHTML keys:', htmlKeys, 'lengths:', htmlKeys.map(k => (sessionData.renderedHTML[k] || '').length));
            if (sessionData.renderedHTML) {
                Object.entries(sessionData.renderedHTML).forEach(([indexStr, html]) => {
                    const idx = parseInt(indexStr, 10);
                    const essayDiv = document.getElementById(`batch-essay-${idx}`);
                    console.log(`[AutoSave] Inject essay ${idx}: div found=${!!essayDiv}, html length=${(html || '').length}`);
                    if (essayDiv && html) {
                        essayDiv.innerHTML = html;
                        // Re-attach interactive handlers for this essay
                        reattachHandlers(idx);
                    }
                });
            }

            // 5. Apply score overrides
            if (sessionData.scoreOverrides) {
                applyScoreOverrides(sessionData.scoreOverrides);
            }

            // 6. Restore mark-complete checkbox states
            if (sessionData.completedEssays) {
                Object.entries(sessionData.completedEssays).forEach(([indexStr, checked]) => {
                    if (checked && window.BatchProcessingModule) {
                        window.BatchProcessingModule.markStudentComplete(parseInt(indexStr, 10), true);
                    }
                });
            }

            // 7. Auto-resize feedback textareas that have long content
            setTimeout(() => {
                document.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(34, textarea.scrollHeight) + 'px';
                });
            }, 400);

            // 8. Show clear button
            showClearButton();

            isRestoring = false;
            console.log('[AutoSave] Restore complete');
            return true;
        } catch (err) {
            isRestoring = false;
            console.error('[AutoSave] Restore failed:', err);
            return false;
        }
    }

    /**
     * Delete saved session, reset UI to blank state.
     */
    async function clearSavedSession() {
        clearDebounce();

        try {
            await fetch('/api/grading-session', { method: 'DELETE' });
        } catch (e) {
            console.warn('[AutoSave] Delete request failed:', e);
        }

        // Clear globals
        if (window.currentBatchData) {
            const count = window.currentBatchData.batchResult?.results?.length || 0;
            for (let i = 0; i < count; i++) {
                delete window[`essayData_${i}`];
            }
        }
        // Clear any remaining essayData globals (up to a reasonable max)
        for (let i = 0; i < 50; i++) {
            if (window[`essayData_${i}`]) delete window[`essayData_${i}`];
        }
        window.currentBatchData = null;
        window.originalBatchDataForRetry = null;

        // Clear results div in active tab
        document.querySelectorAll('#results').forEach(div => {
            div.innerHTML = '';
            div.style.display = 'none';
        });

        // Clear batch progress area
        document.querySelectorAll('.batch-progress-container').forEach(el => el.remove());

        // Reset forms
        const forms = ['gradingForm', 'claudeGradingForm'];
        forms.forEach(id => {
            const f = document.getElementById(id);
            if (f) f.reset();
        });

        // Remove clear button
        const btn = document.getElementById('auto-save-clear-btn');
        if (btn) btn.remove();

        // Clear SingleResultModule batch data
        if (window.SingleResultModule && window.SingleResultModule.clearGradingState) {
            window.SingleResultModule.clearGradingState();
        }

        console.log('[AutoSave] Session cleared');
    }

    /**
     * Show / create "Clear & Start Fresh" button above the results div.
     */
    function showClearButton() {
        if (document.getElementById('auto-save-clear-btn')) return;

        const activeTab = document.querySelector('.tab-content.active');
        const resultsDiv = activeTab
            ? activeTab.querySelector('#results')
            : document.getElementById('results');
        if (!resultsDiv) return;

        const btn = document.createElement('button');
        btn.id = 'auto-save-clear-btn';
        btn.textContent = 'Clear & Start Fresh';
        btn.style.cssText =
            'display:block;margin:12px auto;padding:10px 24px;' +
            'background:#dc3545;color:#fff;border:none;border-radius:6px;' +
            'font-size:15px;font-weight:600;cursor:pointer;';
        btn.addEventListener('mouseover', () => (btn.style.background = '#b02a37'));
        btn.addEventListener('mouseout', () => (btn.style.background = '#dc3545'));
        btn.addEventListener('click', function () {
            if (confirm('This will clear all graded essays. Are you sure?')) {
                clearSavedSession();
            }
        });

        resultsDiv.parentNode.insertBefore(btn, resultsDiv);
    }

    // --- Internal helpers ---

    function clearDebounce() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    /**
     * Count how many essayData_* globals exist (scan up to 50).
     */
    function countEssayDataGlobals() {
        let count = 0;
        for (let i = 0; i < 50; i++) {
            if (window[`essayData_${i}`]) count = i + 1;
            else if (count > 0) break; // stop at first gap after finding some
        }
        return count;
    }

    /**
     * Build the POST body for /api/grading-session.
     * @param {boolean} omitHTML - If true, skip rendered HTML to keep payload small.
     */
    function buildPayload(omitHTML) {
        // Determine essay count from currentBatchData OR by scanning essayData_* globals
        const resultCount = window.currentBatchData?.batchResult?.results?.length
            || countEssayDataGlobals();

        if (resultCount === 0) {
            console.log('[AutoSave] buildPayload: no essay data found, skipping');
            return null;
        }

        // If currentBatchData is missing, reconstruct it from essayData_* globals
        if (!window.currentBatchData) {
            console.log('[AutoSave] buildPayload: reconstructing currentBatchData from essayData globals');
            const results = [];
            const essays = [];
            for (let i = 0; i < resultCount; i++) {
                const ed = window[`essayData_${i}`];
                if (ed) {
                    results.push(ed.essay);
                    essays.push(ed.originalData);
                }
            }
            window.currentBatchData = {
                batchResult: { results, totalEssays: results.length },
                originalData: { essays }
            };
        }

        const activeTab = document.querySelector('.tab-button.active');
        const activeTabName = activeTab ? activeTab.getAttribute('data-tab') : 'gpt-grader';

        // Gather essayData_* globals
        const essaySnapshots = {};
        for (let i = 0; i < resultCount; i++) {
            if (window[`essayData_${i}`]) {
                essaySnapshots[`essayData_${i}`] = window[`essayData_${i}`];
            }
        }

        // Gather rendered HTML from DOM (for instant restore)
        const renderedHTML = {};
        if (!omitHTML) {
            for (let i = 0; i < resultCount; i++) {
                const div = document.getElementById(`batch-essay-${i}`);
                const hasContent = div && div.innerHTML.trim() && div.innerHTML.trim() !== 'Loading formatted result...';
                if (hasContent) {
                    renderedHTML[i] = div.innerHTML;
                }
                console.log(`[AutoSave] buildPayload essay ${i}: div found=${!!div}, hasContent=${hasContent}, length=${div ? div.innerHTML.length : 0}`);
            }
        }

        // Gather score overrides from SingleResultModule
        let scoreOverrides = null;
        if (window.SingleResultModule && window.SingleResultModule.getBatchGradingData) {
            const bgd = window.SingleResultModule.getBatchGradingData();
            if (bgd && Object.keys(bgd).length > 0) {
                scoreOverrides = bgd;
            }
        }

        // Gather mark-complete checkbox states
        const completedEssays = {};
        for (let i = 0; i < resultCount; i++) {
            const cb = document.querySelector(`.mark-complete-checkbox[data-student-index="${i}"]`);
            if (cb && cb.checked) {
                completedEssays[i] = true;
            }
        }

        const sessionData = {
            currentBatchData: window.currentBatchData,
            essaySnapshots,
            renderedHTML,
            scoreOverrides,
            completedEssays,
        };

        return {
            activeTab: activeTabName,
            sessionData,
        };
    }

    /**
     * Execute a save if not already saving.
     */
    async function doSave() {
        if (isSaving || isRestoring) {
            console.log('[AutoSave] doSave: skipped (isSaving=' + isSaving + ', isRestoring=' + isRestoring + ')');
            return;
        }
        const payload = buildPayload();
        if (!payload) {
            console.log('[AutoSave] doSave: no payload to save');
            return;
        }

        isSaving = true;
        try {
            console.log('[AutoSave] Saving session…');
            const resp = await fetch('/api/grading-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                console.warn('[AutoSave] Save failed:', resp.status);
            } else {
                console.log('[AutoSave] Save successful');
                lastSuccessfulSaveTime = Date.now();
                hasPendingChanges = false;
            }
        } catch (err) {
            console.warn('[AutoSave] Save error:', err);
        } finally {
            isSaving = false;
        }
    }

    /**
     * Re-attach interactive handlers on a restored essay div.
     */
    function reattachHandlers(index) {
        setTimeout(() => {
            const essayData = window[`essayData_${index}`];
            if (!essayData) return;
            const { essay, originalData } = essayData;

            // Strip "already initialized" data attributes from injected HTML.
            // Event listeners don't survive innerHTML injection, but these marker
            // attributes do — causing setup functions to skip re-attaching listeners.
            const essayContainer = document.getElementById(`batch-essay-${index}`);
            if (essayContainer) {
                essayContainer.removeAttribute('data-listeners-attached');
                essayContainer.querySelectorAll('[data-listener-added]').forEach(
                    el => el.removeAttribute('data-listener-added')
                );
                essayContainer.querySelectorAll('[data-listener-setup]').forEach(
                    el => el.removeAttribute('data-listener-setup')
                );
            }

            // Text selection handler
            const essayContentDiv = document.querySelector(
                `.formatted-essay-content[data-essay-index="${index}"]`
            );
            if (essayContentDiv) {
                essayContentDiv.addEventListener('mouseup', function (e) {
                    const selection = window.getSelection();
                    const hasTextSelection =
                        selection.rangeCount > 0 && !selection.isCollapsed;
                    if (hasTextSelection) {
                        if (window.TextSelectionModule) {
                            window.TextSelectionModule.handleBatchTextSelection(e, index);
                        }
                        return;
                    }
                    if (e.target.tagName === 'SPAN' || e.target.tagName === 'MARK') return;
                    const highlightParent = e.target.closest(
                        'span[data-category], mark[data-category]'
                    );
                    if (highlightParent) return;
                    if (window.TextSelectionModule) {
                        window.TextSelectionModule.handleBatchTextSelection(e, index);
                    }
                });
            }

            // Category buttons
            const categoryButtons = document.querySelectorAll(
                `#categoryButtons-${index} .category-btn`
            );
            categoryButtons.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    const category = this.dataset.category;
                    if (window.CategorySelectionModule) {
                        window.CategorySelectionModule.selectBatchCategory(category, index);
                    } else if (window.TextSelectionModule) {
                        window.TextSelectionModule.setSelectedCategory(category, index);
                    }
                });
            });

            // Highlight click handlers
            if (window.HighlightingModule) {
                if (essayContainer) {
                    const highlights = essayContainer.querySelectorAll(
                        'span[style*="background"], span[class*="highlight"], span[style*="color"], mark[data-type], mark.highlighted-segment'
                    );
                    highlights.forEach(function (element) {
                        element.style.cursor = 'pointer';
                        element.addEventListener(
                            'click',
                            function (e) {
                                e.stopPropagation();
                                e.preventDefault();
                                if (window.HighlightingModule) {
                                    window.HighlightingModule.editHighlight(this);
                                }
                            },
                            true
                        );
                        element.addEventListener(
                            'mousedown',
                            function (e) {
                                e.stopPropagation();
                            },
                            true
                        );
                    });
                    window.HighlightingModule.ensureHighlightClickHandlers(essayContainer);
                }
            }

            // Essay editing module
            if (window.EssayEditingModule && essay && originalData) {
                window.EssayEditingModule.initializeBatchEssayEditing(
                    index,
                    essay.result,
                    originalData
                );
            }

            // Editable score inputs (also calls setupCategoryNoteToggleListeners internally)
            if (
                window.SingleResultModule &&
                window.SingleResultModule.setupBatchEditableElements &&
                essay &&
                originalData
            ) {
                window.SingleResultModule.setupBatchEditableElements(
                    essay.result,
                    originalData,
                    index
                );
            }

            // Highlight PDF toggle listeners (for the highlights management tab)
            if (essayContainer && window.DisplayUtilsModule &&
                window.DisplayUtilsModule.setupTogglePDFListeners) {
                window.DisplayUtilsModule.setupTogglePDFListeners(essayContainer);
            }

            // Auto-resize feedback textareas to fit their content
            if (essayContainer) {
                essayContainer.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(34, textarea.scrollHeight) + 'px';
                });
            }
        }, 250);
    }

    /**
     * Apply saved score overrides to the DOM inputs.
     */
    function applyScoreOverrides(overrides) {
        if (!overrides) return;

        Object.entries(overrides).forEach(([essayIndex, data]) => {
            if (!data || !data.gradingData || !data.gradingData.scores) return;

            Object.entries(data.gradingData.scores).forEach(([category, scoreData]) => {
                // Find score input for this essay/category
                const container = document.getElementById(`batch-essay-${essayIndex}`);
                if (!container) return;

                const input = container.querySelector(
                    `.score-input[data-category="${category}"], .editable-score[data-category="${category}"]`
                );
                if (input && scoreData.points !== undefined) {
                    input.value = scoreData.points;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Find feedback textarea
                const textarea = container.querySelector(
                    `.editable-feedback[data-category="${category}"]`
                );
                if (textarea && scoreData.rationale !== undefined) {
                    textarea.value = scoreData.rationale;
                }
            });
        });
    }

    // --- Expose ---
    window.AutoSaveModule = {
        initialize,
        saveImmediately,
        debouncedSave,
        loadAndRestore,
        clearSavedSession,
        showClearButton,
    };
})();
