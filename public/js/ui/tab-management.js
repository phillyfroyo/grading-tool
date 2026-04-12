/**
 * Tab Management Module (Phase 5 multi-tab rewrite)
 *
 * Renders the grading tab bar from TabStore state, wires up click/rename
 * handlers, and handles creating/closing/switching tabs. Each tab corresponds
 * to a `.tab-pane[data-tab-id="..."]` DOM element holding an independent
 * grading form and its results.
 *
 * ## Data flow
 *
 * TabStore is the source of truth for which tabs exist, which is active,
 * and what they're named. This module:
 *
 * 1. Reads `TabStore.all()` and `TabStore.activeId()` to render the tab bar.
 * 2. Subscribes to `tab-created`, `tab-switched`, `tab-closed`, `tab-renamed`
 *    events on window so the bar re-renders when state changes.
 * 3. Calls `TabStore.switchTo()` / `create()` / `close()` / `rename()` in
 *    response to user actions, and trusts the events to trigger re-renders.
 *
 * ## Legacy compatibility
 *
 * The old provider-tab system used tab names like "gpt-grader" that mapped to
 * `<div id="gpt-grader-content">`. The rewrite keeps switchTab(name) working
 * for that legacy name — "gpt-grader" aliases to the first tab in TabStore —
 * so auto-save.js's restore path (which reads saved "activeTab" strings from
 * old sessions) continues to work without changes.
 */

/**
 * Max number of tabs a user can have open at once.
 * Enforced by addTab(); cap is a soft UX limit, not a hard technical one.
 */
const MAX_TABS = 10;

/**
 * Switch to a tab by ID or legacy tab name.
 *
 * Delegates to TabStore.switchTo(). The pane visibility update happens in
 * the 'tab-switched' event listener (syncPanesToActiveTab), so callers that
 * invoke TabStore.switchTo() directly get the same pane toggling for free.
 *
 * @param {string} tabIdOrLegacyName - Either a real tab ID like "tab-2"
 *   or the legacy string "gpt-grader" (aliases to the first tab).
 */
function switchTab(tabIdOrLegacyName) {
    // Clean up any leftover debug elements from old code.
    const existingDebugDiv = document.getElementById('debug-message');
    if (existingDebugDiv) existingDebugDiv.remove();

    // Resolve legacy tab names to real tab IDs.
    const tabId = resolveLegacyTabName(tabIdOrLegacyName);
    if (!tabId) {
        console.warn('[TabManagement] switchTab: unknown tab name:', tabIdOrLegacyName);
        return;
    }

    if (!window.TabStore) {
        // Fallback: without TabStore, toggle panes directly. Should never
        // happen in production since tab-store.js loads first.
        syncPanesToActiveTab(tabId);
        return;
    }

    // If the target is already active, still sync panes (handles initial
    // load case where tab-1 is active in TabStore but pane has no .active).
    if (window.TabStore.activeId() === tabId) {
        syncPanesToActiveTab(tabId);
        return;
    }

    // Ask TabStore to switch. It fires 'tab-switched' on window, and our
    // listener syncPanesToActiveTab() handles the pane class toggling.
    window.TabStore.switchTo(tabId);
}

/**
 * Toggle the .active class on tab panes to match the given tabId.
 * Called from the 'tab-switched' event listener and from switchTab() in
 * the edge case where we need to force-sync without a switch.
 */
function syncPanesToActiveTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.dataset.tabId === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Keep the legacy .tab-content.active class in sync for any code that
    // still checks it. (Phase 6+ can remove this once nothing depends on it.)
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.dataset.tabId === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

/**
 * Resolve a tab-name-or-id string to a real tab ID.
 * "gpt-grader" is the legacy name and aliases to the first tab.
 * A real tab ID like "tab-2" is returned as-is if it exists.
 */
function resolveLegacyTabName(name) {
    if (!name) return null;
    if (!window.TabStore) return null;

    // Legacy alias: "gpt-grader" → first tab.
    if (name === 'gpt-grader') {
        const all = window.TabStore.all();
        return all.length > 0 ? all[0].id : null;
    }

    // Real tab ID: verify it exists in the store.
    if (window.TabStore.get(name)) return name;

    return null;
}

/**
 * Render the tab bar from TabStore state. Called at init and in response
 * to tab-* events. Idempotent — safe to call repeatedly.
 */
function renderTabBar() {
    const bar = document.getElementById('gradingTabBar');
    if (!bar || !window.TabStore) return;

    const tabs = window.TabStore.all();
    const activeId = window.TabStore.activeId();

    // Update the data-tab-count attribute so CSS can hide the close button
    // when only one tab remains.
    bar.dataset.tabCount = String(tabs.length);

    // Build the tab item buttons.
    const parts = tabs.map(tab => {
        const isActive = tab.id === activeId;
        const activeClass = isActive ? ' active' : '';
        // Label text is user-controlled so escape HTML.
        const escapedLabel = escapeHTML(tab.label || tab.id);
        return `
            <div class="tab-item${activeClass}" data-tab-id="${tab.id}" role="tab" aria-selected="${isActive}">
                <span class="tab-label" title="Double-click to rename">${escapedLabel}</span>
                <button type="button" class="tab-close" title="Close tab" aria-label="Close tab">×</button>
            </div>
        `;
    });

    // Add the "+" button. Disabled if we're at the cap.
    const atCap = tabs.length >= MAX_TABS;
    const disabledAttr = atCap ? ' disabled title="Maximum 10 tabs reached"' : ' title="New tab"';
    parts.push(`<button type="button" class="tab-add-btn" id="tabAddBtn"${disabledAttr}>+</button>`);

    bar.innerHTML = parts.join('');
}

/** Escape HTML entities in a string for safe insertion into innerHTML. */
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Create a new tab: add it to TabStore, clone the form template into a new
 * .tab-pane DOM element, and switch to it. Enforces the MAX_TABS cap.
 */
function addTab() {
    if (!window.TabStore) return;

    if (window.TabStore.count() >= MAX_TABS) {
        console.warn('[TabManagement] addTab: max tabs reached, ignoring');
        // The button should be disabled already, but if it's somehow clicked,
        // show a friendly error via the existing error modal if available.
        if (window.ModalManager && typeof window.ModalManager.showError === 'function') {
            window.ModalManager.showError(
                `You have ${MAX_TABS} tabs open, which is the maximum. Close a tab before opening a new one.`,
                'Maximum tabs reached'
            );
        }
        return;
    }

    const tabId = window.TabStore.create();
    createTabPaneDOM(tabId);
    switchTab(tabId);

    // Wire up form-submit and essay management handlers on the new pane.
    // These are the init functions that run once on page load for tab-1;
    // now we run them again for each new tab. The handlers themselves are
    // idempotent via data-listener-attached guards we set below.
    wireUpTabEventHandlers(tabId);

    // Phase 6: if grading is already in progress in another tab, start the
    // new tab with its Grade button disabled so the user can still prep
    // essays but can't start a second concurrent grading run.
    applyGradingLockToNewTab(tabId);

    // Persist the updated tab set so a refresh reflects the new tab.
    if (window.AutoSaveModule && window.AutoSaveModule.saveImmediately) {
        window.AutoSaveModule.saveImmediately();
    }
}

/**
 * Clone the tab-pane-template into a new `.tab-pane[data-tab-id="..."]`
 * element appended to the main container. The new pane is NOT automatically
 * activated — caller should call switchTab(tabId) after.
 */
function createTabPaneDOM(tabId) {
    const template = document.getElementById('tab-pane-template');
    if (!template) {
        console.error('[TabManagement] tab-pane-template not found in DOM');
        return null;
    }

    // Clone the template content into a fresh .tab-pane wrapper.
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.dataset.tabId = tabId;
    pane.appendChild(template.content.cloneNode(true));

    // Find where to insert the new pane. Existing .tab-pane elements live
    // inside the <div class="main-container"> or wherever tab-1's pane lives
    // — we append as the next sibling of the last existing .tab-pane.
    const existingPanes = document.querySelectorAll('.tab-pane');
    if (existingPanes.length > 0) {
        const last = existingPanes[existingPanes.length - 1];
        last.parentNode.insertBefore(pane, last.nextSibling);
    } else {
        // Fallback: append to body. Should never happen because tab-1 is
        // always statically in the DOM.
        console.warn('[TabManagement] no existing .tab-pane found; appending new pane to body');
        document.body.appendChild(pane);
    }

    return pane;
}

/**
 * Run the per-tab setup functions on the just-created tab pane.
 * Guards against duplicate listener attachment via a data attribute.
 */
function wireUpTabEventHandlers(tabId) {
    // These setup functions read from TabStore.activeQuery, which scopes to
    // the active tab. We just switched to tabId above, so they'll find the
    // new pane's form.
    if (window.FormHandlingModule && window.FormHandlingModule.setupMainGrading) {
        window.FormHandlingModule.setupMainGrading();
    }
    if (window.EssayManagementModule && window.EssayManagementModule.setupEssayManagement) {
        window.EssayManagementModule.setupEssayManagement();
    }
    // Populate the class profile dropdown with current profiles.
    if (window.ProfilesModule && window.ProfilesModule.updateProfileDropdown) {
        window.ProfilesModule.updateProfileDropdown();
    }
}

/**
 * Close a tab. Shows a confirmation dialog if the tab has unsaved work
 * (form inputs filled, essays, or graded results).
 */
function closeTab(tabId) {
    if (!window.TabStore) return;
    const tab = window.TabStore.get(tabId);
    if (!tab) return;

    // Don't allow closing the last tab — the CSS hides the button for this
    // case, but guard against JS calls.
    if (window.TabStore.count() <= 1) {
        console.warn('[TabManagement] cannot close the last tab');
        return;
    }

    const hasWork = tabHasUnsavedWork(tabId);
    const doClose = () => {
        // Remove the DOM pane.
        const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
        if (pane && pane.parentNode) pane.parentNode.removeChild(pane);

        // Remove from store (store will auto-switch to another tab if this
        // was the active one, and fire tab-switched which re-renders the bar).
        window.TabStore.close(tabId);

        // Persist the updated tab state so a refresh reflects the current
        // set of open tabs — including empty ones. The teacher should see
        // exactly what they left when they come back.
        if (window.AutoSaveModule && window.AutoSaveModule.saveImmediately) {
            window.AutoSaveModule.saveImmediately();
        }
    };

    if (hasWork && window.ModalManager && typeof window.ModalManager.showConfirmation === 'function') {
        window.ModalManager.showConfirmation(
            `"${tab.label}" has graded essays or unsaved content. Close anyway?`,
            doClose,
            () => {/* cancelled */},
            'Close tab?'
        );
    } else {
        doClose();
    }
}

/**
 * Check if a tab has any content worth preserving. Used to decide whether
 * to show the confirmation dialog on close.
 */
function tabHasUnsavedWork(tabId) {
    if (!window.TabStore) return false;
    const tab = window.TabStore.get(tabId);
    if (!tab) return false;

    // Quick checks against TabStore state.
    if (tab.currentBatchData) return true;
    if (tab.currentGradingData) return true;
    if (tab.essayData && Object.keys(tab.essayData).length > 0) return true;

    // Check the DOM: any filled-in student-text, student-name, or nickname?
    const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
    if (pane) {
        const textareas = pane.querySelectorAll('textarea.student-text');
        for (const ta of textareas) {
            if (ta.value && ta.value.trim()) return true;
        }
        const nameInputs = pane.querySelectorAll('input.student-name');
        for (const inp of nameInputs) {
            if (inp.value && inp.value.trim()) return true;
        }
    }

    return false;
}

/**
 * Start renaming a tab via inline editable span. Called on double-click of
 * the tab label.
 */
function startRenameTab(tabId, labelEl) {
    if (!window.TabStore) return;
    const tab = window.TabStore.get(tabId);
    if (!tab) return;

    labelEl.contentEditable = 'true';
    labelEl.classList.add('editing');
    labelEl.focus();

    // Select all text in the span so the user can overwrite immediately.
    const range = document.createRange();
    range.selectNodeContents(labelEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = (commit) => {
        labelEl.contentEditable = 'false';
        labelEl.classList.remove('editing');
        labelEl.removeEventListener('blur', onBlur);
        labelEl.removeEventListener('keydown', onKeyDown);

        if (commit) {
            const newLabel = labelEl.textContent.trim();
            if (newLabel && newLabel !== tab.label) {
                window.TabStore.rename(tabId, newLabel);
            } else {
                // Revert display to original if blank or unchanged.
                labelEl.textContent = tab.label;
            }
        } else {
            // Cancel: revert to original label.
            labelEl.textContent = tab.label;
        }
    };

    const onBlur = () => finish(true);
    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    };

    labelEl.addEventListener('blur', onBlur);
    labelEl.addEventListener('keydown', onKeyDown);
}

/**
 * Wire up delegated click and double-click handlers on the tab bar.
 * Called once from initializeTabs().
 */
function wireUpTabBarHandlers() {
    const bar = document.getElementById('gradingTabBar');
    if (!bar) return;

    // Guard against double wiring if this function is ever called twice.
    if (bar.dataset.handlersAttached === 'true') return;
    bar.dataset.handlersAttached = 'true';

    // Click delegation: tab item click → switch; close button → close;
    // add button → addTab.
    bar.addEventListener('click', (e) => {
        const target = e.target;

        // Close button (must check first because close is inside tab item).
        const closeBtn = target.closest('.tab-close');
        if (closeBtn) {
            e.stopPropagation();
            const tabItem = closeBtn.closest('.tab-item');
            if (tabItem) closeTab(tabItem.dataset.tabId);
            return;
        }

        // Add button
        const addBtn = target.closest('.tab-add-btn');
        if (addBtn) {
            e.stopPropagation();
            addTab();
            return;
        }

        // Tab item body → switch to that tab
        const tabItem = target.closest('.tab-item');
        if (tabItem) {
            switchTab(tabItem.dataset.tabId);
            return;
        }
    });

    // Double-click delegation on labels → start rename
    bar.addEventListener('dblclick', (e) => {
        const label = e.target.closest('.tab-label');
        if (!label) return;
        const tabItem = label.closest('.tab-item');
        if (!tabItem) return;
        startRenameTab(tabItem.dataset.tabId, label);
    });
}

/**
 * Phase 6: Grading lock — while any tab is actively grading, disable the
 * Grade button in every OTHER tab. The originating tab keeps its Grade
 * button enabled (though its submit handler is already disabled via the
 * existing "grading in progress" button-disabled state inside form-handling).
 *
 * Users can still switch tabs, view results, add essays, paste content,
 * select class profiles, edit teacher notes — everything except start a
 * new grading run in a non-originating tab.
 *
 * The lock state is signaled by grading-started and grading-finished events
 * dispatched on window from AutoSaveModule.markGradingStarted/Finished.
 */

/** The tab ID that owns the currently-running grading operation, or null. */
let gradingLockOriginTabId = null;

/**
 * Apply the locked visual state to a single Grade button and insert an
 * inline notice next to it explaining why. Idempotent — safe to call
 * repeatedly on the same button.
 */
function lockGradeButton(gradeBtn) {
    if (!gradeBtn) return;
    gradeBtn.disabled = true;
    gradeBtn.dataset.lockedByOtherTab = 'true';
    gradeBtn.title = 'Grading is in progress in another tab. Please wait for it to finish.';

    // Insert a sibling notice element if not already present.
    const parent = gradeBtn.parentNode;
    if (parent && !parent.querySelector('.grading-lock-notice')) {
        const notice = document.createElement('span');
        notice.className = 'grading-lock-notice';
        notice.textContent = '⏳ Grading active in another tab';
        // Insert right after the grade button so it appears inline.
        gradeBtn.insertAdjacentElement('afterend', notice);
    }
}

/** Remove the locked visual state and the inline notice from a button. */
function unlockGradeButton(gradeBtn) {
    if (!gradeBtn) return;
    if (gradeBtn.dataset.lockedByOtherTab === 'true') {
        gradeBtn.disabled = false;
        delete gradeBtn.dataset.lockedByOtherTab;
        gradeBtn.title = '';
    }
    // Remove the notice if present.
    const parent = gradeBtn.parentNode;
    if (parent) {
        const notice = parent.querySelector('.grading-lock-notice');
        if (notice) notice.remove();
    }
}

/**
 * Disable the Grade button in every tab except the originating one.
 * Called from the grading-started event listener.
 */
function applyGradingLockAcrossTabs(originTabId) {
    gradingLockOriginTabId = originTabId;
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.dataset.tabId === originTabId) return;
        const gradeBtn = pane.querySelector('#gradeButton, button[type="submit"]');
        lockGradeButton(gradeBtn);
    });
}

/** Re-enable Grade buttons in all tabs. Called from grading-finished. */
function releaseGradingLockAcrossTabs() {
    gradingLockOriginTabId = null;
    document.querySelectorAll('.tab-pane').forEach(pane => {
        const gradeBtn = pane.querySelector('#gradeButton, button[type="submit"]');
        unlockGradeButton(gradeBtn);
    });
}

/**
 * If grading is currently in progress, disable the Grade button in a
 * newly-created tab. Called from addTab() right after wireUpTabEventHandlers().
 */
function applyGradingLockToNewTab(tabId) {
    if (!gradingLockOriginTabId) return;
    if (tabId === gradingLockOriginTabId) return;
    const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
    if (!pane) return;
    const gradeBtn = pane.querySelector('#gradeButton, button[type="submit"]');
    lockGradeButton(gradeBtn);
}

/**
 * Listen for TabStore events and re-render the tab bar when state changes.
 * Also syncs pane visibility on tab-switched, and handles grading lock.
 */
function wireUpTabStoreListeners() {
    // Guard against double wiring.
    if (window._tabBarListenersAttached) return;
    window._tabBarListenersAttached = true;

    window.addEventListener('tab-created', renderTabBar);
    window.addEventListener('tab-switched', (e) => {
        // Sync pane visibility first, then re-render the bar to update
        // the .active class on the clicked tab item.
        const toTabId = e.detail && e.detail.toTabId;
        if (toTabId) syncPanesToActiveTab(toTabId);
        renderTabBar();
    });
    window.addEventListener('tab-closed', renderTabBar);
    window.addEventListener('tab-renamed', renderTabBar);
    window.addEventListener('tab-store-restored', (e) => {
        // Rebuild tab panes for all restored tabs (Phase 7 adds full
        // multi-tab restore; for now, just re-render the bar and let
        // pane visibility sync to whatever the active tab is).
        if (window.TabStore) {
            const activeId = window.TabStore.activeId();
            if (activeId) syncPanesToActiveTab(activeId);
        }
        renderTabBar();
    });
    window.addEventListener('tab-store-cleared', renderTabBar);

    // Phase 6 grading lock: disable Grade buttons in non-originating tabs
    // while any tab is actively grading.
    window.addEventListener('grading-started', (e) => {
        const originTabId = (e.detail && e.detail.originTabId)
            || (window.TabStore && window.TabStore.activeId());
        if (originTabId) applyGradingLockAcrossTabs(originTabId);
    });
    window.addEventListener('grading-finished', () => {
        releaseGradingLockAcrossTabs();
    });
}

/**
 * Initialize tab functionality. Called from index.html's init block.
 */
function initializeTabs() {
    console.log('🔧 Initializing tab functionality...');

    wireUpTabStoreListeners();
    wireUpTabBarHandlers();
    renderTabBar();

    // Activate the initial tab (tab-1) so its pane becomes visible.
    if (window.TabStore && window.TabStore.activeId()) {
        switchTab(window.TabStore.activeId());
    }

    console.log('✅ Tab functionality initialized');
}

/**
 * Setup tab switching functionality — legacy entry point called from
 * ui-interactions-main.js. Delegates to initializeTabs().
 */
function setupTabSwitching() {
    initializeTabs();
}

// Export functions for module usage
window.TabManagementModule = {
    switchTab,
    initializeTabs,
    setupTabSwitching,
    addTab,
    closeTab,
    renderTabBar,
    createTabPaneDOM,
    wireUpTabEventHandlers,
    MAX_TABS,
};
