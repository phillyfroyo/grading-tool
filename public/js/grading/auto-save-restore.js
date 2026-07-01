/**
 * auto-save-restore.js — Cluster C (restore & reattach) extracted from
 * auto-save.js.
 *
 * The DOM rehydrator: pulls the saved session from the server and rebuilds the
 * grading UI from it — student skeletons, injected rendered HTML (with the
 * swap-guard that pairs HTML to a row by data-essay-id, never blindly by
 * index), legacy highlights back-compat, remove-all + mark-complete + score
 * overrides, and the deferred 250ms reattach of interactive handlers onto the
 * injected innerHTML. This is the highest-risk grading code (the recent
 * cross-tab production bugs lived here), moved WHOLE — bodies are byte-identical
 * to the pre-split core; only the cross-file seams below are delegated out.
 *
 * MUST load AFTER its dependency modules and BEFORE auto-save.js:
 *  - window.AutoSaveState  — the shared isRestoring flag (setRestoring); the
 *    save lifecycle in core reads it so a debounced save can't race a restore.
 *  - window.AutoSaveUI     — showClearButton (the "Session restored" banner).
 *  - window.AutoSavePayload — readEssayData (reattachHandlers needs the essay).
 * Exposes window.AutoSaveRestore. The core keeps thin facade delegators
 * (loadAndRestore on window.AutoSaveModule; _reattachHighlightsHandlers for the
 * regression net) that forward here.
 *
 * Outbound-only seams — nothing in core reaches back into this file's closure;
 * core calls loadAndRestore() (from promptRestoreIfSaved, which stays in core
 * as it drives the restore-or-discard modal + clearSavedSession teardown).
 */
(function () {
    'use strict';

    // --- Cross-file seam delegators (forward to already-loaded modules) ---
    // These keep the moved function bodies byte-identical to the pre-split core:
    // the bodies still call setRestoring()/showClearButton()/readEssayData(),
    // which here forward to the owning module instead of a core closure.
    function setRestoring(value) {
        if (window.AutoSaveState) window.AutoSaveState.setRestoring(value);
    }
    function showClearButton(statusText) {
        if (window.AutoSaveUI) window.AutoSaveUI.showClearButton(statusText);
    }
    function readEssayData(index) {
        return window.AutoSavePayload && window.AutoSavePayload.readEssayData(index);
    }

    /**
     * Load saved session from server and restore UI.
     * Returns true if a session was restored.
     */
    /**
     * Restore a single tab's DOM state from saved data. This is the core
     * logic that was previously the body of loadAndRestore(). Now extracted
     * as a helper so it can be called once per tab in the multi-tab path.
     *
     * Assumes the target tab is already active (so activeQuery / DOM writes
     * go to the right pane) and that the tab's JS state (currentBatchData,
     * essayData, etc.) is already populated in TabStore.
     *
     * @param {Object} tabData - The saved data for this tab. In the
     *   multi-tab path this is the augmented tab snapshot from
     *   tabStoreSnapshot.tabs[i]. In the legacy path this is sessionData.
     * @param {string|null} tabId - The tab ID (for scoped queries)
     */
    function restoreTabDOM(tabData, tabId) {
        const queryInTab = (selector) => {
            if (window.TabStore && tabId) {
                return window.TabStore.queryInTab(tabId, selector);
            }
            if (window.TabStore) return window.TabStore.activeQuery(selector);
            return document.querySelector(selector);
        };

        // Render student list skeleton via displayBatchResults
        if (tabData.currentBatchData && window.BatchProcessingModule) {
            const { batchResult, originalData } = tabData.currentBatchData;
            const bData = originalData || tabData.currentBatchData.batchData;
            if (batchResult && bData) {
                window.BatchProcessingModule.displayBatchResults(batchResult, bData);
            }
        }

        // Inject saved rendered HTML (skip /format call).
        //
        // Swap-safety: each captured HTML chunk recorded which essayId it
        // belongs to (renderedHTMLEssayIds). On restore we inject it into the
        // row whose data-essay-id matches — NOT blindly by index. If a saved
        // essay failed/dropped, indices in the skeleton may not line up with
        // the saved sparse map; pairing by id guarantees a student's rendered
        // essay can only land in that student's row.
        //
        // Legacy saves (no renderedHTMLEssayIds) fall back to index injection,
        // which is safe ONLY for complete batches — see the count check below.
        if (tabData.renderedHTML) {
            const idMap = tabData.renderedHTMLEssayIds || null;

            // Legacy safety gate: a save made before essayIds existed (no idMap)
            // can only be restored by index, which is safe ONLY if the batch was
            // complete (no failed/missing essays). If a legacy save was partial,
            // index injection could slide a student's essay onto another student
            // — so we refuse to inject and leave the failure placeholders the
            // skeleton already rendered. Newer saves (with idMap) pair by id and
            // are always safe, so this gate doesn't apply to them.
            let legacyUnsafe = false;
            if (!idMap) {
                const results = tabData.currentBatchData?.batchResult?.results || [];
                const anyFailed = results.some(r => r && r.success === false);
                const renderedCount = Object.keys(tabData.renderedHTML).length;
                const successCount = results.filter(r => r && r.success).length;
                // Unsafe if any essay failed, or fewer rendered chunks than
                // successes (a gap that would slide under index injection).
                legacyUnsafe = anyFailed || (results.length > 0 && renderedCount < successCount);
                if (legacyUnsafe) {
                    console.warn('[swap-guard] legacy save (no essayIds) is partial/has failures — skipping index-based HTML restore to avoid mis-pairing; affected students show the retry placeholder');
                }
            }

            if (legacyUnsafe) {
                // Skip injection entirely; the skeleton's per-student placeholders stand.
            } else
            Object.entries(tabData.renderedHTML).forEach(([indexStr, html]) => {
                if (!html) return;
                const idx = parseInt(indexStr, 10);
                const savedEssayId = idMap ? idMap[indexStr] : null;

                let targetDiv = null;
                let targetIdx = idx;

                if (savedEssayId) {
                    // Scan all batch-essay divs in the tab for a matching data-essay-id.
                    const candidates = window.TabStore
                        ? window.TabStore.queryAllInTab(tabId, '[id^="batch-essay-"][data-essay-id]')
                        : document.querySelectorAll('[id^="batch-essay-"][data-essay-id]');
                    for (const div of candidates) {
                        if (div.dataset.essayId === savedEssayId) {
                            targetDiv = div;
                            const m = /batch-essay-(\d+)/.exec(div.id || '');
                            if (m) targetIdx = parseInt(m[1], 10);
                            break;
                        }
                    }
                    // If we had an id but found no matching row, do NOT fall back
                    // to index — that's exactly the swap we're preventing.
                    if (!targetDiv) {
                        console.warn(`[swap-guard] restore: saved essayId ${savedEssayId} has no matching row; skipping index ${idx} to avoid mis-pairing`);
                        return;
                    }
                } else {
                    // Legacy save without id map — inject by index.
                    targetDiv = queryInTab(`#batch-essay-${idx}`);
                }

                if (targetDiv) {
                    targetDiv.innerHTML = html;
                    // Pass tabId so the 250ms-delayed reattach targets the
                    // correct tab even during multi-tab restore iteration.
                    reattachHandlers(targetIdx, tabId);
                }
            });
        }

        // Inject saved highlights tab HTML.
        // NOTE: read-only back-compat for LEGACY payloads. This branch stopped
        // capturing highlightsTabHTML/highlightsContentHTML (they're regenerable
        // from the essay marks via populateHighlightsContent, and were doubling
        // the payload size this fix exists to shrink), so saves written from here
        // on never contain these fields and this block no-ops. It still fires for
        // sessions saved BEFORE the branch; absent fields just lazily regenerate.
        // Remove once old saved sessions have aged out.
        if (tabData.highlightsTabHTML) {
            Object.entries(tabData.highlightsTabHTML).forEach(([indexStr, html]) => {
                const hlTabDiv = queryInTab(`#highlights-tab-content-${indexStr}`);
                if (hlTabDiv && html) {
                    hlTabDiv.innerHTML = html;
                    hlTabDiv.dataset.loaded = 'true';
                    reattachHighlightsHandlers(parseInt(indexStr, 10), hlTabDiv, 'tab', tabId);
                }
            });
        }

        // Inject saved highlights content (grade-details section).
        // Same legacy-payload back-compat as highlightsTabHTML above — no-ops for
        // saves written from this branch on.
        if (tabData.highlightsContentHTML) {
            Object.entries(tabData.highlightsContentHTML).forEach(([indexStr, html]) => {
                const hlInner = queryInTab(`#highlights-content-${indexStr}-inner`);
                if (hlInner && html) {
                    hlInner.innerHTML = html;
                    hlInner.dataset.populated = 'true';
                    reattachHighlightsHandlers(parseInt(indexStr, 10), hlInner, 'content', tabId);
                }
            });
        }

        // Restore remove-all checkbox states.
        // The checkbox now lives INSIDE the (lazily-rendered) highlights dropdown
        // body, so on restore it usually doesn't exist yet — when the teacher
        // opens the dropdown it's generated already-checked from localStorage.
        // So we persist the saved state to localStorage here (the durable source
        // of truth that export reads via applyRemoveAllStateToMarks), which also
        // covers a fresh-browser restore where localStorage started empty. If the
        // checkbox happens to already be in the DOM, reflect it too.
        if (tabData.removeAllStates) {
            Object.entries(tabData.removeAllStates).forEach(([contentId, checked]) => {
                if (!checked) return;
                // Tab-scoped key. CRITICAL: pass the EXPLICIT tabId of the tab
                // being restored — during multi-tab restore the active tab flips,
                // so activeId() would mis-scope this to the wrong tab.
                const key = window.removeAllStorageKey
                    ? window.removeAllStorageKey(contentId, tabId)
                    : `removeAllFromPDF_${contentId}`;
                localStorage.setItem(key, 'true');
                const actualCbId = window.removeAllCheckboxId
                    ? window.removeAllCheckboxId(contentId)
                    : `${contentId}-remove-all`;
                const cb = queryInTab(`#${actualCbId}`) || document.getElementById(actualCbId);
                if (cb) cb.checked = true;
            });
        }

        // Apply score overrides scoped to this tab. Passing tabId is critical
        // during multi-tab restore — the active tab flips between iterations
        // as switchTab is called, so activeQuery would race.
        if (tabData.scoreOverrides) {
            applyScoreOverrides(tabData.scoreOverrides, tabId);
        }

        // Restore mark-complete checkbox states
        if (tabData.completedEssays) {
            Object.entries(tabData.completedEssays).forEach(([indexStr, checked]) => {
                if (checked && window.BatchProcessingModule) {
                    window.BatchProcessingModule.markStudentComplete(parseInt(indexStr, 10), true);
                }
            });
        }
    }

    async function loadAndRestore() {
        try {
            const resp = await fetch('/api/grading-session');
            if (!resp.ok) return false;
            const data = await resp.json();
            if (!data.exists) return false;

            console.log('[AutoSave] Restoring saved session…');
            setRestoring(true);

            const { sessionData, tabStoreSnapshot } = data;

            // ─── Phase 7 multi-tab restore path ───────────────────────
            if (tabStoreSnapshot && Array.isArray(tabStoreSnapshot.tabs) && tabStoreSnapshot.tabs.length > 0) {
                console.log(`[AutoSave] Multi-tab restore: ${tabStoreSnapshot.tabs.length} tabs`);

                // 1. Deserialize TabStore state (creates tab entries, restores
                //    labels, IDs, JS state, and the ID counter). Does NOT
                //    create DOM panes — those are handled below.
                window.TabStore.deserialize(tabStoreSnapshot);

                // Track whether any tab's per-tab scoreOverrides were applied.
                // If not (e.g. loading a pre-refactor save that only has the
                // flat sessionData.scoreOverrides), we fall back after the
                // loop and apply to the primary tab.
                let appliedAnyPerTabOverrides = false;

                // 2. For each restored tab, create a DOM pane (if one doesn't
                //    already exist) and restore its DOM state.
                const allTabs = window.TabStore.all();
                for (const tabState of allTabs) {
                    const tabId = tabState.id;

                    // Tab-1's DOM pane already exists in the static HTML.
                    // For other tabs, create a new pane from the template.
                    let pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
                    if (!pane && window.TabManagementModule) {
                        // createTabPaneDOM is exposed on the module
                        if (typeof window.TabManagementModule.createTabPaneDOM === 'function') {
                            pane = window.TabManagementModule.createTabPaneDOM(tabId);
                        }
                    }

                    // Temporarily switch to this tab so displayBatchResults
                    // (called inside restoreTabDOM) writes to the correct pane.
                    if (window.TabManagementModule) {
                        window.TabManagementModule.switchTab(tabId);
                    }

                    // Wire up event handlers for the new pane
                    if (pane && window.TabManagementModule && typeof window.TabManagementModule.wireUpTabEventHandlers === 'function') {
                        window.TabManagementModule.wireUpTabEventHandlers(tabId);
                    }

                    // Find the saved data for this tab in the snapshot.
                    // tabStoreSnapshot.tabs[i] contains both the JS state AND
                    // the DOM-derived state (renderedHTML, etc.) merged by
                    // buildPayload.
                    const savedTabData = tabStoreSnapshot.tabs.find(t => t.id === tabId);
                    if (savedTabData && savedTabData.currentBatchData) {
                        // Re-populate the tab's state (deserialize only restores
                        // the core fields; essaySnapshots and DOM data are extras
                        // added by buildPayload that need to be re-applied).
                        if (savedTabData.essaySnapshots) {
                            Object.entries(savedTabData.essaySnapshots).forEach(([key, val]) => {
                                const match = key.match(/^essayData_(\d+)$/);
                                if (match) {
                                    tabState.essayData[parseInt(match[1], 10)] = val;
                                }
                            });
                        }

                        if (savedTabData.scoreOverrides
                            && Object.keys(savedTabData.scoreOverrides).length > 0) {
                            appliedAnyPerTabOverrides = true;
                        }

                        restoreTabDOM(savedTabData, tabId);
                    }
                }

                // 3. Switch to the tab that was active at save time.
                const savedActiveId = tabStoreSnapshot.activeTabId;
                if (savedActiveId && window.TabManagementModule) {
                    window.TabManagementModule.switchTab(savedActiveId);
                }

                // 4. Backward-compat fallback for pre-refactor saves: old
                //    payloads stored scoreOverrides as a flat singleton blob
                //    inside sessionData, with no per-tab gathering. If no
                //    per-tab overrides were applied above AND the legacy field
                //    is present, apply it to the primary tab as a best-effort
                //    restoration of the most-recently-setup tab's edits.
                if (!appliedAnyPerTabOverrides
                    && sessionData
                    && sessionData.scoreOverrides
                    && Object.keys(sessionData.scoreOverrides).length > 0) {
                    const primaryId = savedActiveId
                        || (tabStoreSnapshot.tabs[0] && tabStoreSnapshot.tabs[0].id)
                        || (window.TabStore && window.TabStore.activeId());
                    if (primaryId) {
                        console.log('[AutoSave] Applying legacy scoreOverrides to primary tab:', primaryId);
                        const primaryState = window.TabStore && window.TabStore.get(primaryId);
                        if (primaryState) {
                            // Seed the primary tab's batchGradingData so the next
                            // auto-save writes them in the new per-tab format.
                            primaryState.batchGradingData = JSON.parse(JSON.stringify(sessionData.scoreOverrides));
                        }
                        applyScoreOverrides(sessionData.scoreOverrides, primaryId);
                    }
                }

            // ─── Legacy single-tab restore path (pre-Phase-7 saves) ──
            } else if (sessionData) {
                console.log('[AutoSave] Legacy single-tab restore');

                const { activeTab } = data;
                if (activeTab && window.TabManagementModule) {
                    window.TabManagementModule.switchTab(activeTab);
                }

                // Populate tab-1's JS state from legacy sessionData
                const tab1State = window.TabStore && window.TabStore.active();
                if (sessionData.currentBatchData && tab1State) {
                    tab1State.currentBatchData = sessionData.currentBatchData;
                }
                if (sessionData.essaySnapshots && tab1State) {
                    Object.entries(sessionData.essaySnapshots).forEach(([key, val]) => {
                        const match = key.match(/^essayData_(\d+)$/);
                        if (match) {
                            tab1State.essayData[parseInt(match[1], 10)] = val;
                        }
                    });
                }

                restoreTabDOM(sessionData, window.TabStore ? window.TabStore.activeId() : null);
            }

            // ─── Common post-restore steps ────────────────────────────

            // Auto-resize feedback textareas that have long content
            setTimeout(() => {
                document.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(34, textarea.scrollHeight) + 'px';
                });
            }, 400);

            // Restore confirmation banner. Kept terse: the "all prior changes
            // saved" wording was dropped because the save-status banner that
            // appears just after restore already conveys that, so the two read
            // as redundant. (No actual save fires here — this is a load.)
            showClearButton('Session restored');

            // Delay clearing isRestoring until after reattachHandlers timeouts
            // and applyScoreOverrides event dispatches have settled
            setTimeout(() => {
                setRestoring(false);
                console.log('[AutoSave] Restore complete');
            }, 500);
            return true;
        } catch (err) {
            setRestoring(false);
            console.error('[AutoSave] Restore failed:', err);
            return false;
        }
    }

    /**
     * Re-attach interactive handlers on a restored essay div.
     *
     * @param {number} index - Essay index
     * @param {string|null} tabId - The tab ID to scope queries to. During
     *   multi-tab restore, the active tab changes as we iterate, so callers
     *   pass the specific tab ID to avoid the 250ms setTimeout finding the
     *   wrong tab's elements.
     */
    function reattachHandlers(index, tabId) {
        // Capture the tab ID now; by the time the setTimeout fires, the
        // active tab may have changed (multi-tab restore iterates tabs).
        const scopedTabId = tabId
            || (window.TabStore && window.TabStore.activeId())
            || null;

        const queryScoped = (selector) => {
            if (window.TabStore && scopedTabId) {
                return window.TabStore.queryInTab(scopedTabId, selector);
            }
            if (window.TabStore) return window.TabStore.activeQuery(selector);
            return document.querySelector(selector);
        };

        const queryAllScoped = (selector) => {
            if (window.TabStore && scopedTabId) {
                return window.TabStore.queryAllInTab(scopedTabId, selector);
            }
            return document.querySelectorAll(selector);
        };

        setTimeout(() => {
            const essayData = readEssayData(index);
            if (!essayData) return;
            const { essay, originalData } = essayData;

            // Strip "already initialized" data attributes from injected HTML.
            // Event listeners don't survive innerHTML injection, but these marker
            // attributes do — causing setup functions to skip re-attaching the
            // per-element listeners that are still attached that way (the score
            // INPUTs via data-listener-added, the container guard via
            // data-listeners-attached). The arrow steppers, note PDF toggle, and
            // new-highlight mouseup are now document-delegated and need no strip.
            const essayContainer = queryScoped(`#batch-essay-${index}`);
            if (essayContainer) {
                essayContainer.removeAttribute('data-listeners-attached');
                essayContainer.querySelectorAll('[data-listener-added]').forEach(
                    el => el.removeAttribute('data-listener-added')
                );
                // Heal contaminated saves: a cross-tab bug (fixed in highlighting.js)
                // could brand a teacher-note span as a highlight, and that branding
                // is persisted in renderedHTML and replays here on restore. Strip it
                // off this tab's note spans (scoped to essayContainer). Source is now
                // fixed; this undoes prior damage so reloaded sessions self-clean.
                if (window.EditingFunctionsModule && window.EditingFunctionsModule.sanitizeTeacherNoteSpan) {
                    essayContainer.querySelectorAll('.teacher-notes-content').forEach(
                        span => window.EditingFunctionsModule.sanitizeTeacherNoteSpan(span)
                    );
                }
            }

            // Text selection handler
            const essayContentDiv = queryScoped(`.formatted-essay-content[data-essay-index="${index}"]`);
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

            // The restored HTML is a saved snapshot that may carry stale category
            // labels/order in the button row and the "Highlight Meanings" key.
            // Rebuild both from the current single source of truth so previously-
            // saved essays reflect the latest categories. The essay's highlight
            // marks (the real data) are untouched; their colors come from the
            // generated categories.css regardless of the saved inline styles.
            const categoryButtonsContainer = queryScoped(`#categoryButtons-${index}`);
            if (categoryButtonsContainer && window.CategorySelectionModule &&
                typeof window.CategorySelectionModule.createCategoryButtons === 'function') {
                categoryButtonsContainer.innerHTML =
                    window.CategorySelectionModule.createCategoryButtons(index) +
                    `<button id="clearSelectionBtn-${index}" onclick="clearSelection(${index})" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>`;
            }

            // Rebuild the "Highlight Meanings" legend from the source of truth.
            // The legend lives inside the restored #batch-essay-N subtree.
            if (essayContainer && typeof createColorLegend === 'function') {
                const oldLegend = essayContainer.querySelector('.color-legend');
                if (oldLegend) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = createColorLegend();
                    const fresh = tmp.querySelector('.color-legend');
                    if (fresh) oldLegend.replaceWith(fresh);
                }
            }

            // Category buttons
            const categoryButtons = queryAllScoped(
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
                    // Wire legacy/GPT highlight spans via the shared helper (the
                    // broad selector + .teacher-notes guard + capture-phase
                    // listeners live in highlighting.js, shared with the
                    // initial-render path in batch-processing.js so they can't
                    // drift). Restore doesn't re-brand: the saved HTML already
                    // carries data-category/title, so brandCategory is omitted.
                    window.HighlightingModule.wireLegacyHighlightSpans(essayContainer);
                    // Scope to the color-coded essay, NOT the whole #batch-essay-N
                    // row — the row also contains the teacher-notes block, and the
                    // un-scoped call would re-wire note descendants as highlights.
                    const essayContentForHandlers = queryScoped(`.formatted-essay-content[data-essay-index="${index}"]`) || essayContainer;
                    window.HighlightingModule.ensureHighlightClickHandlers(essayContentForHandlers);
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

            // Editable score inputs. Pass scopedTabId so per-tab batchGradingData
            // writes land in the correct tab even though the active tab may have
            // changed during the 250ms setTimeout (multi-tab restore iterates tabs).
            if (
                window.SingleResultModule &&
                window.SingleResultModule.setupBatchEditableElements &&
                essay &&
                originalData
            ) {
                window.SingleResultModule.setupBatchEditableElements(
                    essay.result,
                    originalData,
                    index,
                    scopedTabId
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
     * @param {string|null} tabId - Tab to scope queries to (for multi-tab restore)
     */
    function reattachHighlightsHandlers(index, container, type, tabId) {
        const scopedTabId = tabId
            || (window.TabStore && window.TabStore.activeId())
            || null;

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
                const checkbox = (window.TabStore && scopedTabId)
                    ? window.TabStore.queryInTab(scopedTabId, `#highlights-tab-${index}-remove-all`)
                    : document.getElementById(`highlights-tab-${index}-remove-all`);
                if (checkbox) {
                    checkbox.removeAttribute('data-setup-complete');
                    // setupRemoveAllCheckboxForTab is declared at global scope in grading-display-main.js
                    if (window.setupRemoveAllCheckboxForTab) {
                        window.setupRemoveAllCheckboxForTab(checkbox, container);
                    } else {
                        setupRemoveAllCheckboxFromAutoSave(checkbox, container, scopedTabId);
                    }
                }
            } else if (type === 'content') {
                const contentId = `highlights-content-${index}`;
                // Tab-scope the lookup: highlights-content-N-remove-all ids repeat
                // across panes (N restarts per tab, inactive panes stay in the DOM),
                // so a bare getElementById grabs the FIRST tab's checkbox — wrong
                // essay on a multi-tab restore. Scope to the tab's pane, and use
                // the [id="…"] attribute selector (not `#id`) because querySelector
                // with `#dupId` is unreliable under duplicate ids; the attribute
                // form resolves the per-pane element in both browsers and jsdom.
                const pane = (window.TabStore && scopedTabId)
                    ? window.TabStore.paneForTab(scopedTabId) : null;
                const checkbox = pane
                    ? pane.querySelector(`[id="${contentId}-remove-all"]`)
                    : document.getElementById(`${contentId}-remove-all`);
                if (checkbox) {
                    checkbox.removeAttribute('data-setup-complete');
                    if (window.DisplayUtilsModule && window.DisplayUtilsModule.setupRemoveAllCheckbox) {
                        // Pass the checkbox we resolved via paneForTab(restoringTab):
                        // during multi-tab restore the active tab flips behind this
                        // 250ms timeout, so setup must NOT re-resolve via activeQuery
                        // (it would grab the wrong tab). The passed element pins all
                        // of setup's downstream lookups to the restoring tab's pane.
                        window.DisplayUtilsModule.setupRemoveAllCheckbox(contentId, checkbox);
                    }
                }
            }
        }, 250);
    }

    /**
     * Setup remove-all checkbox listener for highlights tab (mirrors setupRemoveAllCheckboxForTab
     * from grading-display-main.js, which is a file-scoped function we can't call directly).
     */
    function setupRemoveAllCheckboxFromAutoSave(checkbox, contentDiv, tabId) {
        if (checkbox.dataset.setupComplete === 'true') return;

        const contentId = checkbox.dataset.contentId || checkbox.id.replace('-remove-all', '');
        // Tab-scoped key via the shared helper. tabId is the restoring tab (passed
        // from reattachHighlightsHandlers); fall back to activeId() inside helper.
        const storageKey = window.removeAllStorageKey
            ? window.removeAllStorageKey(contentId, tabId)
            : `removeAllFromPDF_${contentId}`;
        const savedState = localStorage.getItem(storageKey);

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
            localStorage.setItem(storageKey, checked.toString());
            // (Teacher-note add/subtract is driven by the document-level delegated
            // remove-all listener in display-utils.js.)
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
     * @param {Object} overrides - Score overrides keyed by essay index.
     * @param {string} [tabId] - Optional tab ID. When provided, container lookups
     *                          are scoped to that tab's pane via queryInTab,
     *                          which is critical during the multi-tab restore
     *                          loop where the active tab flips between iterations.
     */
    function applyScoreOverrides(overrides, tabId) {
        if (!overrides) return;

        Object.entries(overrides).forEach(([essayIndex, data]) => {
            if (!data || !data.gradingData || !data.gradingData.scores) return;

            Object.entries(data.gradingData.scores).forEach(([category, scoreData]) => {
                // Find score input for this essay/category, scoped to the
                // target tab (not the active tab).
                const container = (window.TabStore && tabId)
                    ? window.TabStore.queryInTab(tabId, `#batch-essay-${essayIndex}`)
                    : (window.TabStore
                        ? window.TabStore.activeQuery(`#batch-essay-${essayIndex}`)
                        : document.getElementById(`batch-essay-${essayIndex}`));
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

    window.AutoSaveRestore = {
        loadAndRestore,
        restoreTabDOM,
        reattachHandlers,
        reattachHighlightsHandlers,
        setupRemoveAllCheckboxFromAutoSave,
        applyScoreOverrides,
    };
})();
