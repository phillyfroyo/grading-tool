/**
 * Keyboard Shortcuts Module
 * Handles keyboard shortcut functionality for the application
 */

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Ctrl/Cmd + E for export
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            if (typeof exportToPDF === 'function') {
                exportToPDF();
            } else if (window.PDFExportModule && window.PDFExportModule.exportToPDF) {
                window.PDFExportModule.exportToPDF();
            }
        }

        // Ctrl/Cmd + M for manual grading
        if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
            event.preventDefault();
            if (window.TabManagementModule) {
                window.TabManagementModule.switchTab('manual-grader');
            }
        }

        // Ctrl/Cmd + G for GPT grading
        if ((event.ctrlKey || event.metaKey) && event.key === 'g') {
            event.preventDefault();
            if (window.TabManagementModule) {
                window.TabManagementModule.switchTab('gpt-grader');
            }
        }

        // Ctrl/Cmd + S for save (prevent default browser save)
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            console.log('Save shortcut pressed - implement save functionality if needed');
        }

        // Escape key for clearing selections
        if (event.key === 'Escape') {
            if (window.EssayEditingModule && window.EssayEditingModule.clearSelection) {
                window.EssayEditingModule.clearSelection();
            }
        }

        // F1 for help (prevent default)
        if (event.key === 'F1') {
            event.preventDefault();
            showHelpModal();
        }
    });
}

/**
 * Show help modal with keyboard shortcuts
 */
function showHelpModal() {
    const helpContent = `
        <h4>Keyboard Shortcuts</h4>
        <ul style="text-align: left; margin: 10px 0;">
            <li><strong>Ctrl/Cmd + E</strong> - Export to PDF</li>
            <li><strong>Ctrl/Cmd + M</strong> - Switch to Manual Grading</li>
            <li><strong>Ctrl/Cmd + G</strong> - Switch to GPT Grading</li>
            <li><strong>Escape</strong> - Clear text selection</li>
            <li><strong>F1</strong> - Show this help</li>
        </ul>
        <h4>Essay Editing</h4>
        <ul style="text-align: left; margin: 10px 0;">
            <li>Select text first, then choose a category button</li>
            <li>Or choose a category button first, then select text</li>
            <li>Click on highlights to edit them</li>
            <li>Use the Clear Selection button to reset</li>
        </ul>
    `;

    if (window.ModalManagementModule) {
        window.ModalManagementModule.showModal('Help & Shortcuts', helpContent);
    } else {
        alert('Help: Use Ctrl+E to export, Ctrl+M for manual grading, Ctrl+G for GPT grading, Escape to clear selection');
    }
}

/**
 * Add custom keyboard shortcut
 * @param {string} key - Key combination (e.g., 'ctrl+shift+d')
 * @param {Function} callback - Function to execute
 * @param {string} description - Description for help display
 */
function addKeyboardShortcut(key, callback, description = '') {
    // Store custom shortcuts for help display
    if (!window.customShortcuts) {
        window.customShortcuts = [];
    }

    window.customShortcuts.push({ key, callback, description });

    // Parse key combination
    const parts = key.toLowerCase().split('+');
    const modifiers = {
        ctrl: parts.includes('ctrl'),
        meta: parts.includes('meta') || parts.includes('cmd'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt')
    };
    const mainKey = parts[parts.length - 1];

    document.addEventListener('keydown', function(event) {
        if (event.key.toLowerCase() === mainKey &&
            event.ctrlKey === modifiers.ctrl &&
            event.metaKey === modifiers.meta &&
            event.shiftKey === modifiers.shift &&
            event.altKey === modifiers.alt) {
            event.preventDefault();
            callback(event);
        }
    });
}

/**
 * Remove keyboard shortcut event listeners
 */
function removeKeyboardShortcuts() {
    // This would require tracking event listeners, which is complex
    // For now, just clear custom shortcuts
    window.customShortcuts = [];
}

// Export functions for module usage
window.KeyboardShortcutsModule = {
    setupKeyboardShortcuts,
    showHelpModal,
    addKeyboardShortcut,
    removeKeyboardShortcuts
};