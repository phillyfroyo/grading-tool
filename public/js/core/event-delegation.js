/**
 * Event Delegation Module
 * Centralized event handling to replace inline onclick handlers
 */

import { createLogger } from './logger.js';

const logger = createLogger('Core:EventDelegation');
console.log('🔧 Event delegation module loaded');

class EventDelegation {
    constructor() {
        this.handlers = new Map();
        this.initialized = false;
    }

    /**
     * Initialize event delegation system
     */
    initialize() {
        console.log('🚀 Event delegation initialize() called');
        if (this.initialized) {
            logger.warn('Event delegation already initialized');
            console.log('⚠️ Event delegation already initialized');
            return;
        }

        console.log('🔧 Starting event delegation initialization...');
        logger.info('Initializing event delegation system');

        // Set up global click handler for event delegation
        document.addEventListener('click', this.handleGlobalClick.bind(this), true);
        console.log('Global click listener added to document');

        // Register all standard handlers
        this.registerStandardHandlers();

        this.initialized = true;
        logger.info('Event delegation system initialized');
    }

    /**
     * Handle global click events
     * @param {Event} event - Click event
     */
    handleGlobalClick(event) {
        const target = event.target;

        // Handle data-action attributes
        const action = target.dataset.action;
        if (action && this.handlers.has(action)) {
            event.preventDefault();
            console.log('Calling handler for action:', action);
            const handler = this.handlers.get(action);
            handler(event, target);
            return;
        }

        // Handle specific class-based actions
        this.handleClassBasedActions(event, target);
    }

    /**
     * Handle class-based actions
     * @param {Event} event - Click event
     * @param {HTMLElement} target - Target element
     */
    handleClassBasedActions(event, target) {
        // Clear selection buttons
        if (target.id?.includes('clearSelectionBtn')) {
            event.preventDefault();
            const essayIndex = target.id.includes('-') ?
                parseInt(target.id.split('-')[1]) : undefined;
            this.handleClearSelection(essayIndex);
            return;
        }

        // Export/download buttons (be more specific to avoid false positives)
        if (target.tagName === 'BUTTON' && target.textContent?.includes('Export to PDF')) {
            event.preventDefault();
            this.handleExportToPDF();
            return;
        }


        // Individual essay download
        if (target.textContent?.includes('Download') && target.onclick?.toString().includes('downloadIndividualEssay')) {
            event.preventDefault();
            const match = target.onclick.toString().match(/downloadIndividualEssay\((\d+)\)/);
            if (match) {
                this.handleDownloadIndividualEssay(parseInt(match[1]));
            }
            return;
        }

        // Student header toggles
        if (target.onclick?.toString().includes('toggleStudentDetails')) {
            event.preventDefault();
            const match = target.onclick.toString().match(/toggleStudentDetails\((\d+)\)/);
            if (match) {
                this.handleToggleStudentDetails(parseInt(match[1]));
            }
            return;
        }

        // Profile management
        if (target.onclick?.toString().includes('showProfileForm')) {
            event.preventDefault();
            const match = target.onclick.toString().match(/showProfileForm\('([^']+)'\)/);
            const profileId = match ? match[1] : undefined;
            this.handleShowProfileForm(profileId);
            return;
        }

        if (target.onclick?.toString().includes('deleteProfile')) {
            event.preventDefault();
            const match = target.onclick.toString().match(/deleteProfile\('([^']+)'\)/);
            if (match) {
                this.handleDeleteProfile(match[1]);
            }
            return;
        }

        // Essay management
        if (target.onclick?.toString().includes('removeEssay')) {
            event.preventDefault();
            const match = target.onclick.toString().match(/removeEssay\((\d+)\)/);
            if (match) {
                this.handleRemoveEssay(parseInt(match[1]));
            }
            return;
        }

        // Manual grading actions
        if (target.onclick?.toString().includes('saveManualGrading')) {
            event.preventDefault();
            this.handleSaveManualGrading();
            return;
        }

        if (target.onclick?.toString().includes('cancelManualGrading')) {
            event.preventDefault();
            this.handleCancelManualGrading();
            return;
        }

        // Editable sections
        if (target.onclick?.toString().includes('editTeacherNotes')) {
            event.preventDefault();
            this.handleEditTeacherNotes(target);
            return;
        }

        if (target.onclick?.toString().includes('editStat')) {
            event.preventDefault();
            const match = target.onclick.toString().match(/editStat\(this,\s*'([^']+)'\)/);
            if (match) {
                this.handleEditStat(target, match[1]);
            }
            return;
        }

        // Manage Profiles button
        if (target.id === 'manageProfilesBtn' || target.classList.contains('manage-profiles-btn')) {
            event.preventDefault();
            this.handleManageProfiles();
            return;
        }
    }

    /**
     * Register a custom action handler
     * @param {string} action - Action name
     * @param {Function} handler - Handler function
     */
    registerHandler(action, handler) {
        this.handlers.set(action, handler);
        logger.debug(`Registered handler for action: ${action}`);
    }

    /**
     * Register all standard handlers
     */
    registerStandardHandlers() {
        console.log('Registering standard handlers...');
        // Modal actions
        this.registerHandler('close-modal', (event, target) => {
            const modalId = target.closest('.modal')?.id;
            if (modalId && window.ModalManager) {
                const modalName = modalId.replace('Modal', '');
                window.ModalManager.closeModal(modalName);
            }
        });

        this.registerHandler('save-modal', (event, target) => {
            const modalId = target.closest('.modal')?.id;
            if (modalId && window.ModalManager) {
                const modalName = modalId.replace('Modal', '');
                window.ModalManager.saveModal(modalName);
            }
        });

        // Category selection
        this.registerHandler('select-category', (event, target) => {
            const category = target.dataset.category;
            if (category && window.CategorySelectionModule) {
                window.CategorySelectionModule.selectCategory(category);
            }
        });

        // Text selection
        this.registerHandler('clear-selection', (event, target) => {
            const essayIndex = target.dataset.essayIndex ?
                parseInt(target.dataset.essayIndex) : undefined;
            this.handleClearSelection(essayIndex);
        });

        // PDF Export
        this.registerHandler('export-pdf', (event, target) => {
            console.log('export-pdf handler triggered');
            this.handleExportToPDF();
        });
        console.log('Registered export-pdf handler');

        // Profile Management
        this.registerHandler('manage-profiles', (event, target) => {
            this.handleManageProfiles();
        });
    }

    // Handler implementations
    handleClearSelection(essayIndex) {
        if (typeof clearSelection === 'function') {
            clearSelection(essayIndex);
        } else {
            logger.warn('clearSelection function not found');
        }
    }

    handleExportToPDF() {
        console.log('🎯 handleExportToPDF called');

        // Determine which export function to call based on current tab/context
        const isManualTab = document.querySelector('.tab-button[data-tab="manual-grader"]')?.classList.contains('active');
        const hasManualResults = document.getElementById('manualResults')?.innerHTML.trim();
        const hasMainResults = document.getElementById('results')?.innerHTML.trim();

        console.log('Manual tab active:', isManualTab);
        console.log('Has manual results:', !!hasManualResults);
        console.log('Has main results:', !!hasMainResults);

        if (isManualTab || (hasManualResults && !hasMainResults)) {
            // Manual grading context
            if (window.PDFExportModule?.exportManualToPDF) {
                window.PDFExportModule.exportManualToPDF();
            } else if (typeof exportManualResults === 'function') {
                exportManualResults();
            } else {
                logger.warn('Manual export function not found');
            }
        } else {
            // Main grading context
            if (window.PDFExportModule?.exportToPDF) {
                window.PDFExportModule.exportToPDF();
            } else if (typeof exportToPDF === 'function') {
                exportToPDF();
            } else {
                logger.warn('Main export function not found');
            }
        }
    }


    handleDownloadIndividualEssay(index) {
        if (typeof downloadIndividualEssay === 'function') {
            downloadIndividualEssay(index);
        } else {
            logger.warn('downloadIndividualEssay function not found');
        }
    }

    handleToggleStudentDetails(index) {
        if (typeof toggleStudentDetails === 'function') {
            toggleStudentDetails(index);
        } else {
            logger.warn('toggleStudentDetails function not found');
        }
    }

    handleShowProfileForm(profileId) {
        if (typeof showProfileForm === 'function') {
            showProfileForm(profileId);
        } else {
            logger.warn('showProfileForm function not found');
        }
    }

    handleDeleteProfile(profileId) {
        if (typeof deleteProfile === 'function') {
            deleteProfile(profileId);
        } else {
            logger.warn('deleteProfile function not found');
        }
    }

    handleRemoveEssay(index) {
        if (typeof removeEssay === 'function') {
            removeEssay(index);
        } else {
            logger.warn('removeEssay function not found');
        }
    }

    handleSaveManualGrading() {
        if (typeof saveManualGrading === 'function') {
            saveManualGrading();
        } else {
            logger.warn('saveManualGrading function not found');
        }
    }

    handleCancelManualGrading() {
        if (typeof cancelManualGrading === 'function') {
            cancelManualGrading();
        } else {
            logger.warn('cancelManualGrading function not found');
        }
    }

    handleEditTeacherNotes(target) {
        if (typeof editTeacherNotes === 'function') {
            editTeacherNotes(target);
        } else if (window.ModalManager) {
            window.ModalManager.openTeacherNotesModal(target);
        } else {
            logger.warn('editTeacherNotes function not found');
        }
    }

    handleEditStat(target, statType) {
        if (typeof editStat === 'function') {
            editStat(target, statType);
        } else {
            logger.warn('editStat function not found');
        }
    }

    handleManageProfiles() {
        console.log('[MANAGE_PROFILES] Opening profile management modal...');
        logger.info('Opening profile management modal');

        // Direct modal opening (avoid modal manager complexity)
        const modal = document.getElementById('profileManagementModal');
        if (modal) {
            console.log('[MANAGE_PROFILES] Modal found, showing...');
            modal.style.display = 'block';

            // Load and display profiles list with protection against infinite loops
            if (window.ProfilesModule && !this._loadingProfiles) {
                console.log('[MANAGE_PROFILES] Loading profiles list...');
                this._loadingProfiles = true;
                try {
                    window.ProfilesModule.loadProfilesList();
                } finally {
                    this._loadingProfiles = false;
                }
            } else if (this._loadingProfiles) {
                logger.warn('Already loading profiles, skipping to prevent infinite loop');
            } else {
                console.error('[MANAGE_PROFILES] ProfilesModule not found');
                logger.warn('ProfilesModule not found');
            }
        } else {
            logger.error('Profile management modal not found');
        }
    }

    /**
     * Clean up event delegation
     */
    destroy() {
        if (this.initialized) {
            document.removeEventListener('click', this.handleGlobalClick.bind(this), true);
            this.handlers.clear();
            this.initialized = false;
            logger.info('Event delegation system destroyed');
        }
    }
}

// Create and export the event delegation instance
const eventDelegation = new EventDelegation();

// Export for ES6 modules
export default eventDelegation;

// Legacy global access
if (typeof window !== 'undefined') {
    window.EventDelegation = eventDelegation;
}