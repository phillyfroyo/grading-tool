/**
 * Keyboard Shortcuts Module
 * NOTE: Custom keyboard shortcuts have been disabled to avoid interfering with
 * native browser shortcuts like Ctrl+C (copy), Ctrl+V (paste), etc.
 */

/**
 * Setup keyboard shortcuts - DISABLED
 * All native browser shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, etc.) now work normally.
 */
function setupKeyboardShortcuts() {
    // No custom keyboard shortcuts - let browser handle all key combinations naturally
}

/**
 * Show help modal - DISABLED
 */
function showHelpModal() {
    // No longer needed since shortcuts are disabled
}

/**
 * Add custom keyboard shortcut - DISABLED
 */
function addKeyboardShortcut(key, callback, description = '') {
    // Disabled - do nothing
}

/**
 * Remove keyboard shortcut event listeners - DISABLED
 */
function removeKeyboardShortcuts() {
    // Disabled - do nothing
}

// Export functions for module usage (empty implementations)
window.KeyboardShortcutsModule = {
    setupKeyboardShortcuts,
    showHelpModal,
    addKeyboardShortcut,
    removeKeyboardShortcuts
};
