/**
 * auto-save-state.js — shared cross-cluster save state.
 *
 * The auto-save save engine (Cluster A, in auto-save.js) and the restore
 * rehydrator (Cluster C, in auto-save-restore.js) live in separate files but
 * share ONE flag: `isRestoring`. The save lifecycle reads it on its hot path
 * (doSave skips while a restore is rebuilding the DOM); restore writes it
 * (true for the duration of loadAndRestore, cleared 500ms after the reattach
 * timeouts settle). Two files can't share a closure `let`, so the flag lives
 * here as a tiny owned-state object both files reach through.
 *
 * Deliberately MINIMAL — this owns only the genuinely cross-file flag, via a
 * getter/setter (NOT a bare public variable), so the seam is a method call, not
 * a shared mutable global anyone can scribble on. Other coupled flags
 * (authExpired, retryTimer) stay in core until/unless their cluster is
 * extracted; this is not a junk drawer for all of auto-save's state.
 *
 * MUST load BEFORE auto-save.js and auto-save-restore.js — both call into it.
 * Exposes window.AutoSaveState.
 */
(function () {
    'use strict';

    // True while a saved session is being restored/re-rendered. The save
    // lifecycle consults it (doSave bails) so a debounced save can't race the
    // restore and persist a half-rebuilt DOM; the public AutoSaveModule
    // .isRestoring() getter also reads it (the re-render path suppresses its
    // "Grading complete" banner during restore).
    let isRestoring = false;

    window.AutoSaveState = {
        isRestoring: function () { return isRestoring === true; },
        setRestoring: function (value) { isRestoring = (value === true); },
    };
})();
