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

        // No beforeunload beacon — the DOM is unreliable during page teardown
        // and stale/empty payloads have been overwriting good DB data.
        // Debounced saves (2.5s) and immediate saves cover all edit scenarios.

        console.log('[AutoSave] Initialized');
    }

    /**
     * Save immediately (called after grading completes).
     */
    function saveImmediately() {
        clearDebounce();
        hasPendingChanges = true;
        updateBannerStatus('Saving\u2026', 'ok');
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
                    if (essayDiv && html) {
                        essayDiv.innerHTML = html;
                        // Re-attach interactive handlers for this essay
                        reattachHandlers(idx);
                    }
                });
            }

            // 4b. Inject saved highlights tab HTML
            if (sessionData.highlightsTabHTML) {
                Object.entries(sessionData.highlightsTabHTML).forEach(([indexStr, html]) => {
                    const hlTabDiv = document.getElementById(`highlights-tab-content-${indexStr}`);
                    if (hlTabDiv && html) {
                        hlTabDiv.innerHTML = html;
                        hlTabDiv.dataset.loaded = 'true';
                        reattachHighlightsHandlers(parseInt(indexStr, 10), hlTabDiv, 'tab');
                    }
                });
            }

            // 4c. Inject saved highlights content (grade-details section)
            if (sessionData.highlightsContentHTML) {
                Object.entries(sessionData.highlightsContentHTML).forEach(([indexStr, html]) => {
                    const hlInner = document.getElementById(`highlights-content-${indexStr}-inner`);
                    if (hlInner && html) {
                        hlInner.innerHTML = html;
                        hlInner.dataset.populated = 'true';
                        reattachHighlightsHandlers(parseInt(indexStr, 10), hlInner, 'content');
                    }
                });
            }

            // 4d. Restore remove-all checkbox states
            if (sessionData.removeAllStates) {
                Object.entries(sessionData.removeAllStates).forEach(([contentId, checked]) => {
                    if (!checked) return;
                    // For highlights-tab: checkbox id is "highlights-tab-${i}-remove-all"
                    // For highlights-content: checkbox id is "highlights-content-${i}-remove-all"
                    const cbId = contentId + '-remove-all';
                    // Also check the alternate format from the tab
                    const tabMatch = contentId.match(/^highlights-tab-content-(\d+)$/);
                    const actualCbId = tabMatch ? `highlights-tab-${tabMatch[1]}-remove-all` : cbId;
                    const cb = document.getElementById(actualCbId);
                    if (cb) {
                        cb.checked = true;
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

            // Delay clearing isRestoring until after reattachHandlers timeouts (250ms)
            // and applyScoreOverrides event dispatches have settled
            setTimeout(() => {
                isRestoring = false;
                console.log('[AutoSave] Restore complete');
            }, 500);
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

        // Remove banner and reset body padding
        const banner = document.getElementById('auto-save-banner');
        if (banner) {
            document.body.style.paddingTop = '';
            banner.remove();
        }

        // Clear SingleResultModule batch data
        if (window.SingleResultModule && window.SingleResultModule.clearGradingState) {
            window.SingleResultModule.clearGradingState();
        }

        console.log('[AutoSave] Session cleared');
    }

    /**
     * Show the fixed auto-save banner at the top of the viewport.
     * Left side: status text. Right side: "Clear & Start Fresh" button.
     */
    function showClearButton(statusText) {
        if (document.getElementById('auto-save-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'auto-save-banner';
        banner.style.cssText =
            'position:fixed;top:0;left:0;right:0;z-index:9999;' +
            'display:flex;align-items:center;justify-content:space-between;' +
            'padding:4px 20px;' +
            'background:rgba(209,243,209,0.92);' +
            'border-bottom:1px solid rgba(100,180,100,0.4);' +
            'box-shadow:0 1px 3px rgba(0,0,0,0.06);' +
            'font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
            'font-size:12px;color:#2d6a2d;letter-spacing:0.01em;' +
            'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';

        // Status text (left)
        const status = document.createElement('span');
        status.id = 'auto-save-status';
        status.style.cssText = 'font-weight:500;';
        setStatusContent(status, statusText || 'Session restored', 'ok');

        // Clear button (right)
        const btn = document.createElement('button');
        btn.textContent = 'Clear & Start Fresh';
        btn.style.cssText =
            'padding:4px 14px;' +
            'background:#e8e8e8;color:#444;' +
            'border:1px solid #ccc;border-radius:4px;' +
            'font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;' +
            'transition:background 0.15s;white-space:nowrap;';
        btn.addEventListener('mouseover', () => {
            btn.style.background = '#dcdcdc';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.background = '#e8e8e8';
        });
        btn.addEventListener('click', function () {
            if (confirm('This will clear all graded essays. Are you sure?')) {
                clearSavedSession();
            }
        });

        banner.appendChild(status);
        banner.appendChild(btn);
        document.body.appendChild(banner);

        // Push page content down so banner doesn't overlap it
        document.body.style.paddingTop = banner.offsetHeight + 'px';
    }

    /**
     * Set status span content with optional trailing icon.
     */
    function setStatusContent(statusEl, text, level) {
        statusEl.innerHTML = '';
        statusEl.appendChild(document.createTextNode(text));
        if (level === 'ok') {
            const icon = document.createElement('span');
            icon.textContent = ' \u2713';
            icon.style.cssText = 'font-weight:400;margin-left:4px;';
            statusEl.appendChild(icon);
        }
    }

    /**
     * Update the banner status text and appearance.
     * @param {string} text - Status message
     * @param {'ok'|'warn'} level - Visual style
     */
    function updateBannerStatus(text, level) {
        const banner = document.getElementById('auto-save-banner');
        const status = document.getElementById('auto-save-status');
        if (!banner || !status) return;

        setStatusContent(status, text, level);

        if (level === 'warn') {
            banner.style.background = 'rgba(255,243,205,0.95)';
            banner.style.borderBottomColor = 'rgba(200,170,80,0.4)';
            banner.style.color = '#856404';
            status.style.color = '#856404';
        } else {
            banner.style.background = 'rgba(209,243,209,0.92)';
            banner.style.borderBottomColor = 'rgba(100,180,100,0.4)';
            banner.style.color = '#2d6a2d';
            status.style.color = '#2d6a2d';
        }
    }

    // --- Internal helpers ---

    let retryTimer = null;

    /**
     * Schedule a retry save after a failure (10s delay).
     * If the retry succeeds, the banner switches back to green.
     */
    function scheduleRetry() {
        if (retryTimer) return; // already scheduled
        retryTimer = setTimeout(() => {
            retryTimer = null;
            hasPendingChanges = true;
            doSave();
        }, 10000);
    }

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
        const highlightsTabHTML = {};
        const highlightsContentHTML = {};
        if (!omitHTML) {
            for (let i = 0; i < resultCount; i++) {
                const div = document.getElementById(`batch-essay-${i}`);
                const hasContent = div && div.innerHTML.trim() && div.innerHTML.trim() !== 'Loading formatted result...';
                if (hasContent) {
                    renderedHTML[i] = div.innerHTML;
                }
                console.log(`[AutoSave] buildPayload essay ${i}: hasContent=${hasContent}, length=${div ? div.innerHTML.length : 0}`);

                // Save highlights tab content ("Manage Highlights" standalone tab)
                const hlTabDiv = document.getElementById(`highlights-tab-content-${i}`);
                if (hlTabDiv && hlTabDiv.dataset.loaded === 'true' && hlTabDiv.innerHTML.trim() && hlTabDiv.innerHTML.trim() !== 'Loading highlights...') {
                    highlightsTabHTML[i] = hlTabDiv.innerHTML;
                }

                // Save highlights content within grade-details section
                const hlContentInner = document.getElementById(`highlights-content-${i}-inner`);
                if (hlContentInner && hlContentInner.dataset.populated === 'true' && hlContentInner.innerHTML.trim()) {
                    highlightsContentHTML[i] = hlContentInner.innerHTML;
                }
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

        // Gather remove-all checkbox states (checked property doesn't survive innerHTML)
        const removeAllStates = {};
        for (let i = 0; i < resultCount; i++) {
            // Highlights tab remove-all checkbox
            const hlTabCb = document.getElementById(`highlights-tab-${i}-remove-all`);
            if (hlTabCb && hlTabCb.checked) {
                removeAllStates[`highlights-tab-content-${i}`] = true;
            }
            // Grade-details highlights remove-all checkbox
            const hlContentCb = document.getElementById(`highlights-content-${i}-remove-all`);
            if (hlContentCb && hlContentCb.checked) {
                removeAllStates[`highlights-content-${i}`] = true;
            }
        }

        const sessionData = {
            currentBatchData: window.currentBatchData,
            essaySnapshots,
            renderedHTML,
            highlightsTabHTML,
            highlightsContentHTML,
            scoreOverrides,
            completedEssays,
            removeAllStates,
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
                updateBannerStatus('Changes failed to auto-save, sorry. Do not refresh or close the page.', 'warn');
                scheduleRetry();
            } else {
                console.log('[AutoSave] Save successful');
                lastSuccessfulSaveTime = Date.now();
                hasPendingChanges = false;
                updateBannerStatus('All changes saved', 'ok');
            }
        } catch (err) {
            console.warn('[AutoSave] Save error:', err);
            updateBannerStatus('Changes failed to auto-save, sorry. Do not refresh or close the page.', 'warn');
            scheduleRetry();
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
                        'span[style*="background"], span[class*="highlight"], span[style*="color"], mark[data-type], mark.highlighted-segment, mark[data-category]'
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
     * Re-attach interactive handlers on a restored highlights section.
     * @param {number} index - Essay index
     * @param {HTMLElement} container - The highlights content container
     * @param {'tab'|'content'} type - Which highlights section this is
     */
    function reattachHighlightsHandlers(index, container, type) {
        setTimeout(() => {
            // Strip guard attributes that survived innerHTML injection
            container.querySelectorAll('[data-setup-complete]').forEach(
                el => el.removeAttribute('data-setup-complete')
            );

            // Setup toggle PDF button listeners
            if (window.DisplayUtilsModule && window.DisplayUtilsModule.setupTogglePDFListeners) {
                window.DisplayUtilsModule.setupTogglePDFListeners(container);
            }

            // Setup remove-all checkbox
            if (type === 'tab') {
                const checkbox = document.getElementById(`highlights-tab-${index}-remove-all`);
                if (checkbox) {
                    checkbox.removeAttribute('data-setup-complete');
                    // setupRemoveAllCheckboxForTab is declared at global scope in grading-display-main.js
                    if (window.setupRemoveAllCheckboxForTab) {
                        window.setupRemoveAllCheckboxForTab(checkbox, container);
                    } else {
                        setupRemoveAllCheckboxFromAutoSave(checkbox, container);
                    }
                }
            } else if (type === 'content') {
                const contentId = `highlights-content-${index}`;
                const checkbox = document.getElementById(`${contentId}-remove-all`);
                if (checkbox) {
                    checkbox.removeAttribute('data-setup-complete');
                    if (window.DisplayUtilsModule && window.DisplayUtilsModule.setupRemoveAllCheckbox) {
                        window.DisplayUtilsModule.setupRemoveAllCheckbox(contentId);
                    }
                }
            }
        }, 250);
    }

    /**
     * Setup remove-all checkbox listener for highlights tab (mirrors setupRemoveAllCheckboxForTab
     * from grading-display-main.js, which is a file-scoped function we can't call directly).
     */
    function setupRemoveAllCheckboxFromAutoSave(checkbox, contentDiv) {
        if (checkbox.dataset.setupComplete === 'true') return;

        const contentId = checkbox.dataset.contentId || checkbox.id.replace('-remove-all', '');
        const savedState = localStorage.getItem(`removeAllFromPDF_${contentId}`);

        let isChecked;
        if (savedState !== null) {
            isChecked = savedState === 'true';
            checkbox.checked = isChecked;
        } else {
            isChecked = checkbox.checked;
        }

        // Apply state to all toggle buttons
        if (isChecked) {
            const toggleButtons = contentDiv.querySelectorAll('.toggle-pdf-btn');
            toggleButtons.forEach(button => {
                const elementId = button.dataset.elementId;
                const highlightElement = document.getElementById(elementId);
                if (highlightElement) {
                    highlightElement.dataset.excludeFromPdf = 'true';
                    button.dataset.excluded = 'true';
                    button.style.background = '#28a745';
                    button.textContent = '+';
                    button.onmouseover = function() { this.style.background = '#218838'; };
                    button.onmouseout = function() { this.style.background = '#28a745'; };
                    const entryDiv = button.closest('div[style*="margin: 20px 0"]');
                    if (entryDiv) {
                        entryDiv.style.textDecoration = 'line-through';
                        entryDiv.style.opacity = '0.6';
                    }
                }
            });
        }

        // Add change listener
        checkbox.addEventListener('change', function() {
            const checked = this.checked;
            localStorage.setItem(`removeAllFromPDF_${contentId}`, checked.toString());
            const toggleButtons = contentDiv.querySelectorAll('.toggle-pdf-btn');
            toggleButtons.forEach(button => {
                const elementId = button.dataset.elementId;
                const highlightElement = document.getElementById(elementId);
                if (!highlightElement) return;
                highlightElement.dataset.excludeFromPdf = checked ? 'true' : 'false';
                button.dataset.excluded = checked;
                if (checked) {
                    button.style.background = '#28a745';
                    button.textContent = '+';
                    button.onmouseover = function() { this.style.background = '#218838'; };
                    button.onmouseout = function() { this.style.background = '#28a745'; };
                } else {
                    button.style.background = '#dc3545';
                    button.textContent = '-';
                    button.onmouseover = function() { this.style.background = '#c82333'; };
                    button.onmouseout = function() { this.style.background = '#dc3545'; };
                }
                const entryDiv = button.closest('div[style*="margin: 20px 0"]');
                if (entryDiv) {
                    entryDiv.style.textDecoration = checked ? 'line-through' : 'none';
                    entryDiv.style.opacity = checked ? '0.6' : '1';
                }
            });
        });

        checkbox.dataset.setupComplete = 'true';
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
