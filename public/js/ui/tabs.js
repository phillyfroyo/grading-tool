/**
 * Tab Management Module
 * Handles tab switching functionality and tab-related UI interactions
 */

import eventBus from '../core/eventBus.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('UI:Tabs');

class TabManager {
    constructor() {
        this.activeTab = null;
        this.tabs = new Map();
        this.debugMode = false;
    }

    /**
     * Initialize tab functionality
     */
    initialize() {
        logger.info('Initializing tab functionality');

        this.setupTabButtons();
        this.setupEventListeners();
        this.setInitialTab();

        eventBus.registerModule('TabManager', this);
    }

    /**
     * Set up tab button event listeners
     */
    setupTabButtons() {
        const tabButtons = document.querySelectorAll('.tab-button');
        logger.debug(`Found ${tabButtons.length} tab buttons`);

        tabButtons.forEach(button => {
            const tabName = button.getAttribute('data-tab');
            if (tabName) {
                this.tabs.set(tabName, {
                    button,
                    content: document.getElementById(`${tabName}-content`),
                    name: tabName
                });

                button.addEventListener('click', () => {
                    this.switchToTab(tabName);
                });
            }
        });
    }

    /**
     * Set up event bus listeners
     */
    setupEventListeners() {
        eventBus.on('tab:switch', (data) => {
            this.switchToTab(data.tabName);
        });

        eventBus.on('tab:get-active', (requestData) => {
            eventBus.respond(requestData, this.activeTab);
        });
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - Name of the tab to switch to
     */
    switchToTab(tabName) {
        logger.info(`Switching to tab: ${tabName}`);

        if (this.debugMode) {
            document.title = `ESL Essay Grader - Switching to ${tabName}`;
            this.showDebugInfo(tabName);
        }

        // Deactivate all tabs
        this.deactivateAllTabs();

        // Activate the selected tab
        const success = this.activateTab(tabName);

        if (success) {
            this.activeTab = tabName;
            eventBus.emit('tab:switched', { tabName, previousTab: this.activeTab });

            // Handle tab-specific loading
            this.handleTabSpecificActions(tabName);
        }

        return success;
    }

    /**
     * Deactivate all tabs
     */
    deactivateAllTabs() {
        this.tabs.forEach((tab) => {
            if (tab.button) {
                tab.button.classList.remove('active');
            }
            if (tab.content) {
                tab.content.classList.remove('active');
            }
        });
    }

    /**
     * Activate a specific tab
     * @param {string} tabName - Name of the tab to activate
     * @returns {boolean} True if successful
     */
    activateTab(tabName) {
        const tab = this.tabs.get(tabName);

        if (!tab) {
            logger.error(`Tab not found: ${tabName}`);
            return false;
        }

        // Activate button
        if (tab.button) {
            tab.button.classList.add('active');
            logger.debug(`Activated button for tab: ${tabName}`);
        } else {
            logger.warn(`Button not found for tab: ${tabName}`);
        }

        // Activate content
        if (tab.content) {
            tab.content.classList.add('active');
            logger.debug(`Activated content for tab: ${tabName}`);
        } else {
            logger.warn(`Content not found for tab: ${tabName}`);
        }

        return true;
    }

    /**
     * Handle tab-specific actions when switching
     * @param {string} tabName - Name of the activated tab
     */
    handleTabSpecificActions(tabName) {
        switch (tabName) {
            case 'profiles':
                eventBus.emit('profiles:load-list');
                break;
            case 'gpt-grader':
                eventBus.emit('gpt-grading:tab-activated');
                break;
        }
    }

    /**
     * Set the initial tab
     */
    setInitialTab() {
        // Check for tab in URL hash
        const hash = window.location.hash.substring(1);
        if (hash && this.tabs.has(hash)) {
            this.switchToTab(hash);
        } else {
            // Default to first tab or gpt-grader
            const defaultTab = this.tabs.has('gpt-grader') ? 'gpt-grader' : this.tabs.keys().next().value;
            if (defaultTab) {
                this.switchToTab(defaultTab);
            }
        }
    }

    /**
     * Get the currently active tab
     * @returns {string|null} Active tab name
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * Check if a tab exists
     * @param {string} tabName - Name of the tab to check
     * @returns {boolean} True if tab exists
     */
    hasTab(tabName) {
        return this.tabs.has(tabName);
    }

    /**
     * Get all available tabs
     * @returns {array} Array of tab names
     */
    getAllTabs() {
        return Array.from(this.tabs.keys());
    }

    /**
     * Enable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        logger.setLevel(enabled ? 'debug' : 'info');
    }

    /**
     * Show debug information
     * @param {string} tabName - Current tab being switched to
     */
    showDebugInfo(tabName) {
        let debugDiv = document.getElementById('tab-debug-message');
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.id = 'tab-debug-message';
            debugDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #007bff;
                color: white;
                padding: 10px;
                z-index: 9999;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                max-width: 300px;
            `;
            document.body.appendChild(debugDiv);
        }

        const tabCount = this.tabs.size;
        const success = this.tabs.has(tabName);

        debugDiv.innerHTML = `
            <strong>Tab Manager Debug</strong><br>
            Switching to: ${tabName}<br>
            Total tabs: ${tabCount}<br>
            Status: ${success ? '✅ Success' : '❌ Failed'}
        `;

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (debugDiv.parentNode) {
                debugDiv.parentNode.removeChild(debugDiv);
            }
        }, 3000);
    }

    /**
     * Clean up event listeners and debug elements
     */
    destroy() {
        // Remove debug elements
        const debugDiv = document.getElementById('tab-debug-message');
        if (debugDiv && debugDiv.parentNode) {
            debugDiv.parentNode.removeChild(debugDiv);
        }

        // Clear tabs
        this.tabs.clear();
        this.activeTab = null;

        logger.info('Tab manager destroyed');
    }
}

// Create and export the tab manager instance
const tabManager = new TabManager();

// Export for ES6 modules
export default tabManager;

// Legacy global access for backward compatibility during transition
if (typeof window !== 'undefined') {
    window.TabManager = tabManager;

    // Legacy function exports
    window.switchTab = (tabName) => tabManager.switchToTab(tabName);
    window.initializeTabs = () => tabManager.initialize();
}