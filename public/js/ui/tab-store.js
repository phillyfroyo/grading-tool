/**
 * TabStore — per-tab state registry for the multi-tab grading feature
 *
 * Infrastructure module for the multi-tab refactor. Holds all per-tab state
 * in a single namespaced object keyed by tabId, with helpers for creating,
 * switching, closing, renaming, and serializing tabs.
 *
 * Loaded BEFORE tab-management.js so that by the time any module cares about
 * tab state, `window.TabStore` is already wired up and has an initial tab
 * ready.
 *
 * Phase 2 of the multi-tab refactor: infrastructure only, no consumers yet.
 * Phases 3+ will migrate DOM scoping and window globals into this store.
 *
 * ## State shape per tab
 *
 * Each tab's state object has this shape:
 *
 *   {
 *     id: "tab-1",
 *     label: "Tab 1",
 *     createdAt: 1718... (ms timestamp),
 *     // Per-tab grading state — starts empty, populated as grading proceeds:
 *     currentGradingData: null,        // single-essay result + teacher notes
 *     currentBatchData: null,          // batch result
 *     originalBatchDataForRetry: null, // batch retry source data
 *     essayData: {},                   // per-essay snapshots keyed by index
 *     batchResults: null,              // pdf-export fallback
 *     batchGradingData: {},            // user edits to category scores/rationales
 *   }
 *
 * DOM state (form inputs, results, scroll positions, highlights, open modals)
 * is not held here — that lives in the tab's .tab-pane DOM subtree, which
 * Phase 3 will introduce. TabStore holds only the JS data.
 *
 * ## Events
 *
 * The store dispatches CustomEvents on window for consumers to listen to:
 *
 *   - 'tab-created' — detail: { tabId, label }
 *   - 'tab-switched' — detail: { fromTabId, toTabId }
 *   - 'tab-closed' — detail: { tabId, wasActive }
 *   - 'tab-renamed' — detail: { tabId, oldLabel, newLabel }
 *
 * No consumers exist yet in Phase 2 — these are hooks for Phase 3/5.
 *
 * ## ID generation
 *
 * Tab IDs are monotonically increasing: "tab-1", "tab-2", "tab-3", ...
 * Closed IDs are never reused, even after the tab is gone. This prevents
 * async operations and event listeners that still hold a reference to a
 * closed tab's ID from accidentally writing into a brand-new tab that
 * happened to get the same ID.
 */
(function () {
    'use strict';

    // Module-private state. Not exposed on window.TabStore directly — callers
    // must go through the API so we can emit events and enforce invariants.
    const tabs = new Map(); // Map<tabId, tabState>
    let activeTabId = null;
    let nextIdCounter = 1; // monotonically increasing, never reused

    /** Generate the next unique tab ID. */
    function generateId() {
        return `tab-${nextIdCounter++}`;
    }

    /**
     * Generate a default label for a new tab. Uses the smallest positive
     * integer not already taken by an existing tab label, so the user sees
     * "Tab 1", "Tab 2", "Tab 3" even after closing and reopening tabs.
     * The internal tab ID stays monotonic (tab-11, tab-12, ...) to prevent
     * async-write collisions, but the display label is user-friendly.
     */
    function defaultLabelFor() {
        // Find the smallest "Tab N" label not currently in use.
        const usedNumbers = new Set();
        for (const tab of tabs.values()) {
            const match = tab.label && tab.label.match(/^Tab (\d+)$/);
            if (match) usedNumbers.add(parseInt(match[1], 10));
        }
        let n = 1;
        while (usedNumbers.has(n)) n++;
        return `Tab ${n}`;
    }

    /** Create an empty state object for a fresh tab. */
    function makeEmptyState(tabId, label) {
        return {
            id: tabId,
            label: label,
            createdAt: Date.now(),
            currentGradingData: null,
            currentBatchData: null,
            originalBatchDataForRetry: null,
            essayData: {},
            batchResults: null,
            // Per-tab grading data for batch results. Keyed by essay index,
            // values are { gradingData, originalData }. Holds user edits to
            // category scores and feedback rationales so they persist through
            // auto-save/restore. Previously a module-level singleton in
            // single-result.js, moved here so each tab owns its own edits.
            batchGradingData: {},
        };
    }

    /** Dispatch a tab-related CustomEvent on the window. */
    function emit(eventName, detail) {
        try {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        } catch (err) {
            // CustomEvent should always succeed in modern browsers; log just in case.
            console.error(`[TabStore] Failed to dispatch ${eventName}:`, err);
        }
    }

    /**
     * Create a new tab and return its ID.
     *
     * If `initialState` is provided, its fields are merged into the fresh
     * tab's state object (useful when restoring from persistence). Unknown
     * fields are preserved as-is.
     *
     * The new tab is NOT automatically made active — call switchTo() if that
     * is what you want. (Exception: if there is no active tab, the new tab
     * becomes active immediately so the app is never in a zero-active-tab
     * state.)
     */
    function create(initialState) {
        const tabId = generateId();
        const label = (initialState && initialState.label) || defaultLabelFor();
        const state = makeEmptyState(tabId, label);

        if (initialState && typeof initialState === 'object') {
            // Shallow merge — caller-provided fields override defaults.
            // We skip the fields we control (id, createdAt) to avoid drift.
            for (const key of Object.keys(initialState)) {
                if (key === 'id' || key === 'createdAt') continue;
                state[key] = initialState[key];
            }
        }

        tabs.set(tabId, state);

        // If this is the first tab, activate it immediately.
        if (activeTabId === null) {
            activeTabId = tabId;
        }

        emit('tab-created', { tabId, label: state.label });
        return tabId;
    }

    /** Return the active tab's state object, or null if no active tab. */
    function active() {
        if (activeTabId === null) return null;
        return tabs.get(activeTabId) || null;
    }

    /** Return the active tab's ID, or null if no active tab. */
    function activeId() {
        return activeTabId;
    }

    /**
     * Switch to a different tab. No-op if the target ID doesn't exist or
     * is already active. Fires 'tab-switched' on successful change.
     */
    function switchTo(tabId) {
        if (!tabs.has(tabId)) {
            console.warn(`[TabStore] switchTo: unknown tab ${tabId}`);
            return;
        }
        if (activeTabId === tabId) return;

        const fromTabId = activeTabId;
        activeTabId = tabId;
        emit('tab-switched', { fromTabId, toTabId: tabId });
    }

    /**
     * Close a tab. If the closed tab was active, the most recently created
     * remaining tab is activated. If closing the last tab, a fresh tab-N is
     * auto-created so the app is never in a zero-tabs state.
     *
     * Fires 'tab-closed' with { tabId, wasActive }. If a new tab had to be
     * auto-created, 'tab-created' fires first for that tab, then 'tab-closed'
     * for the removed one, then 'tab-switched' to the new active.
     */
    function close(tabId) {
        if (!tabs.has(tabId)) {
            console.warn(`[TabStore] close: unknown tab ${tabId}`);
            return;
        }

        const wasActive = (activeTabId === tabId);
        tabs.delete(tabId);

        if (wasActive) {
            // Pick a replacement active tab. If none exist, create a fresh one.
            if (tabs.size === 0) {
                // Auto-create a new tab so the app is never in a zero-tabs state.
                // This emits 'tab-created' and sets activeTabId inside create().
                activeTabId = null; // so create() will activate the new one
                create();
            } else {
                // Switch to the most recently created remaining tab.
                // Map preserves insertion order; find the last key.
                let newActive = null;
                for (const key of tabs.keys()) {
                    newActive = key;
                }
                const fromTabId = activeTabId;
                activeTabId = newActive;
                emit('tab-switched', { fromTabId, toTabId: newActive });
            }
        }

        emit('tab-closed', { tabId, wasActive });
    }

    /**
     * Return an array of all tabs in creation order. Each entry is the full
     * tab state object. Callers should treat the returned state objects as
     * live references — mutating them mutates the store.
     */
    function all() {
        return Array.from(tabs.values());
    }

    /** Return the number of tabs currently in the store. */
    function count() {
        return tabs.size;
    }

    /**
     * Return a specific tab's state by ID, or null if not found. Returned
     * state is a live reference into the store.
     */
    function get(tabId) {
        return tabs.get(tabId) || null;
    }

    /**
     * Rename a tab. No-op if the target ID doesn't exist.
     * Empty/whitespace labels are rejected. Fires 'tab-renamed' on success.
     */
    function rename(tabId, newLabel) {
        const state = tabs.get(tabId);
        if (!state) {
            console.warn(`[TabStore] rename: unknown tab ${tabId}`);
            return;
        }
        if (typeof newLabel !== 'string') return;
        const trimmed = newLabel.trim();
        if (!trimmed) return;
        if (trimmed === state.label) return;

        const oldLabel = state.label;
        state.label = trimmed;
        emit('tab-renamed', { tabId, oldLabel, newLabel: trimmed });
    }

    /**
     * Serialize the full store to a JSON-safe object for persistence.
     * Used by auto-save to write all tabs to the database.
     *
     * Returns:
     *   {
     *     activeTabId: "tab-2",
     *     nextIdCounter: 5,
     *     tabs: [ <tabState>, <tabState>, ... ]
     *   }
     *
     * nextIdCounter is included so restored sessions continue IDs from where
     * they left off, preventing ID collisions with newly-created tabs.
     */
    function serialize() {
        return {
            activeTabId: activeTabId,
            nextIdCounter: nextIdCounter,
            tabs: Array.from(tabs.values()).map(state => {
                // Deep clone via JSON to ensure the serialized form is safe
                // to store and doesn't share references with the live store.
                return JSON.parse(JSON.stringify(state));
            }),
        };
    }

    /**
     * Replace the entire store with deserialized data.
     *
     * Does NOT fire per-tab 'tab-created' events — deserialization is bulk
     * restoration, not user-initiated creation. Consumers that need to know
     * about the restored state should listen for a 'tab-store-restored' event
     * that fires once at the end.
     *
     * If the saved data is malformed or empty, falls back to a fresh single
     * tab so the app is never in an invalid state.
     */
    function deserialize(data) {
        tabs.clear();
        activeTabId = null;
        nextIdCounter = 1;

        const valid = data
            && typeof data === 'object'
            && Array.isArray(data.tabs)
            && data.tabs.length > 0;

        if (!valid) {
            // Fallback: empty or malformed data. Create a fresh tab.
            create();
            emit('tab-store-restored', { tabCount: 1, fallback: true });
            return;
        }

        // Restore nextIdCounter first so any new tabs created after restore
        // don't collide with saved IDs.
        if (typeof data.nextIdCounter === 'number' && data.nextIdCounter >= 1) {
            nextIdCounter = data.nextIdCounter;
        }

        for (const savedState of data.tabs) {
            if (!savedState || typeof savedState !== 'object' || !savedState.id) continue;
            // Trust the saved id — do not regenerate. Preserves references.
            tabs.set(savedState.id, {
                id: savedState.id,
                label: savedState.label || defaultLabelFor(),
                createdAt: savedState.createdAt || Date.now(),
                currentGradingData: savedState.currentGradingData || null,
                currentBatchData: savedState.currentBatchData || null,
                originalBatchDataForRetry: savedState.originalBatchDataForRetry || null,
                essayData: savedState.essayData || {},
                batchResults: savedState.batchResults || null,
                batchGradingData: savedState.batchGradingData || {},
            });
        }

        // Activate the saved active tab if it still exists; otherwise pick the first.
        if (data.activeTabId && tabs.has(data.activeTabId)) {
            activeTabId = data.activeTabId;
        } else {
            const first = tabs.keys().next().value;
            activeTabId = first || null;
        }

        // If deserialization somehow produced zero tabs, create a fresh one.
        if (tabs.size === 0) {
            create();
        }

        emit('tab-store-restored', { tabCount: tabs.size, fallback: false });
    }

    /**
     * Remove all tabs and create a fresh empty tab-1. Used by
     * "Clear & Start Fresh". Resets the ID counter.
     *
     * Fires 'tab-store-cleared' after reset, then 'tab-created' for the
     * fresh tab from inside create().
     */
    function clear() {
        tabs.clear();
        activeTabId = null;
        nextIdCounter = 1;
        emit('tab-store-cleared', {});
        create();
    }

    // ----- Module init -----
    // Create the initial tab-1 so the app is never in a zero-tab state.
    // This fires 'tab-created' — consumers loaded later (tab-management,
    // form-handling, etc.) won't have listeners attached yet, which is fine:
    // the initial tab is implicit to their existing behavior.
    create();

    /**
     * Return the DOM element for the active tab's pane (the
     * `<div class="tab-pane" data-tab-id="...">` container).
     *
     * Returns null if no active tab or if the pane element is not present
     * in the DOM (for example, during early module init before index.html
     * has been fully parsed).
     *
     * Used by code that needs to scope a querySelector to the currently-
     * visible grading form rather than searching the whole document.
     */
    function activePane() {
        if (activeTabId === null) return null;
        return document.querySelector(`.tab-pane[data-tab-id="${activeTabId}"]`);
    }

    /**
     * Scoped querySelector that searches within the active tab's pane first,
     * falling back to a document-wide search if the pane can't be found or
     * doesn't contain a match.
     *
     * This is the preferred way to look up tab-scoped elements like
     * `#results`, `#gradingForm`, `#classProfile`, etc. during the
     * multi-tab migration:
     *
     *   const resultsDiv = window.TabStore.activeQuery('#results');
     *
     * The fallback to `document.querySelector` keeps the app working if
     * anything unexpected happens with the tab pane (e.g. during tests
     * that mount the grading form outside the normal index.html layout).
     *
     * @param {string} selector - CSS selector
     * @returns {Element|null}
     */
    function activeQuery(selector) {
        const pane = activePane();
        if (pane) {
            const found = pane.querySelector(selector);
            if (found) return found;
        }
        return document.querySelector(selector);
    }

    /**
     * Scoped querySelectorAll equivalent of activeQuery().
     *
     * Returns a NodeList of matches within the active tab's pane. Unlike
     * activeQuery(), this does NOT fall back to document-wide search if
     * the pane has no matches — an empty NodeList is returned instead.
     * Document-wide fallback on querySelectorAll would be dangerous
     * (could return elements from other tabs) so we refuse to guess.
     *
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    function activeQueryAll(selector) {
        const pane = activePane();
        if (pane) return pane.querySelectorAll(selector);
        // No pane: search the whole document. This is a best-effort
        // fallback that matches the activeQuery() single-element behavior.
        return document.querySelectorAll(selector);
    }

    /**
     * Scoped querySelector that searches within a SPECIFIC tab's pane,
     * regardless of which tab is currently active.
     *
     * Used by async writers (streaming callbacks, delayed DOM updates) that
     * need to target a specific tab's DOM even if the user has since
     * switched to a different tab.
     *
     * Behavior by tabId:
     *   - If tabId is provided and the pane exists: returns the first match
     *     inside that pane, or null if the pane has no match. DOES NOT fall
     *     back to a document-wide search — crossing tabs would silently
     *     corrupt state (e.g. return tab-2's element when tab-1 was asked
     *     for). Callers that want "find anywhere" should query the document
     *     explicitly.
     *   - If tabId is provided but the pane is missing (e.g. tab was closed
     *     while a pending write was in flight): returns null.
     *   - If tabId is falsy: delegates to activeQuery() which has an
     *     active-tab-first, document-wide-fallback policy.
     *
     * @param {string} tabId - The tab ID to scope the query to
     * @param {string} selector - CSS selector
     * @returns {Element|null}
     */
    function queryInTab(tabId, selector) {
        if (!tabId) return activeQuery(selector);
        const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
        if (!pane) return null;
        return pane.querySelector(selector);
    }

    /**
     * Scoped querySelectorAll that searches within a SPECIFIC tab's pane.
     * Same use case and same tabId semantics as queryInTab().
     *
     * When tabId is provided and the pane has no matches, returns an empty
     * NodeList — NEVER falls back to a document-wide search. Returning
     * cross-tab matches silently would be worse than returning nothing.
     *
     * @param {string} tabId - The tab ID to scope the query to
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    function queryAllInTab(tabId, selector) {
        if (!tabId) return activeQueryAll(selector);
        const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
        if (!pane) {
            // Return an empty NodeList rather than document-wide. Use a
            // non-matching selector on document to produce an empty NodeList.
            return document.querySelectorAll(':not(*)');
        }
        return pane.querySelectorAll(selector);
    }

    /**
     * Return the DOM element for a specific tab's pane by tab ID.
     * Returns null if the pane isn't in the DOM (e.g. after tab close).
     */
    function paneForTab(tabId) {
        if (!tabId) return null;
        return document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
    }

    // Expose the API on window.
    window.TabStore = {
        create,
        active,
        activeId,
        switchTo,
        close,
        all,
        count,
        get,
        rename,
        serialize,
        deserialize,
        clear,
        activePane,
        activeQuery,
        activeQueryAll,
        queryInTab,
        queryAllInTab,
        paneForTab,
    };
})();
