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

    /** Generate a default label for a new tab. Uses the numeric part of the ID. */
    function defaultLabelFor(tabId) {
        const match = tabId.match(/^tab-(\d+)$/);
        const num = match ? match[1] : String(tabs.size + 1);
        return `Tab ${num}`;
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
        const label = (initialState && initialState.label) || defaultLabelFor(tabId);
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
                label: savedState.label || defaultLabelFor(savedState.id),
                createdAt: savedState.createdAt || Date.now(),
                currentGradingData: savedState.currentGradingData || null,
                currentBatchData: savedState.currentBatchData || null,
                originalBatchDataForRetry: savedState.originalBatchDataForRetry || null,
                essayData: savedState.essayData || {},
                batchResults: savedState.batchResults || null,
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
    };
})();
