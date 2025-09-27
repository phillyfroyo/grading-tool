/**
 * Manual Grading Module
 * Handles manual grading interface, scoring, and feedback collection
 */

import eventBus from '../core/eventBus.js';
import { createLogger } from '../core/logger.js';
import { generateId, formatPercentage } from '../core/utils.js';

const logger = createLogger('Grading:Manual');

class ManualGradingManager {
    constructor() {
        this.currentGrading = null;
        this.scoringCategories = [
            { name: 'Grammar', id: 'grammar', max: 15 },
            { name: 'Vocabulary', id: 'vocabulary', max: 15 },
            { name: 'Spelling', id: 'spelling', max: 10 },
            { name: 'Mechanics & Punctuation', id: 'mechanics', max: 15 },
            { name: 'Fluency', id: 'fluency', max: 15 },
            { name: 'Layout & Follow Specs', id: 'layout', max: 15 },
            { name: 'Content & Information', id: 'content', max: 15 }
        ];
    }

    /**
     * Initialize manual grading functionality
     */
    initialize() {
        logger.info('Initializing manual grading functionality');

        this.setupEventListeners();
        this.setupFormHandlers();
        this.setupScoreInputs();

        eventBus.registerModule('ManualGradingManager', this);
    }

    /**
     * Set up event bus listeners
     */
    setupEventListeners() {
        eventBus.on('manual-grading:tab-activated', () => {
            this.onTabActivated();
        });

        eventBus.on('manual-grading:start', (data) => {
            this.startGrading(data.studentName, data.essayText, data.prompt);
        });

        eventBus.on('manual-grading:save', () => {
            this.saveGrading();
        });

        eventBus.on('manual-grading:clear', () => {
            this.clearForm();
        });

        eventBus.on('manual-grading:test', () => {
            this.runTest();
        });
    }

    /**
     * Set up form handlers
     */
    setupFormHandlers() {
        const manualForm = document.getElementById('manualGradingForm');
        if (manualForm) {
            manualForm.addEventListener('submit', this.handleFormSubmission.bind(this));
        }

        // Clear button
        const clearButton = document.querySelector('.clear-button');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearForm());
        }

        logger.debug('Form handlers set up');
    }

    /**
     * Set up score input listeners
     */
    setupScoreInputs() {
        document.querySelectorAll('.manual-score-input').forEach(input => {
            input.addEventListener('input', () => this.updateTotalScore());
            input.addEventListener('blur', () => this.validateScoreInput(input));
        });

        // Initialize total score display
        this.updateTotalScore();
        logger.debug('Score inputs set up');
    }

    /**
     * Handle tab activation
     */
    onTabActivated() {
        logger.debug('Manual grading tab activated');
        this.updateTotalScore();
    }

    /**
     * Start manual grading for a student
     * @param {string} studentName - Student name
     * @param {string} essayText - Essay text
     * @param {string} prompt - Assignment prompt
     */
    startGrading(studentName, essayText, prompt = '') {
        logger.info(`Starting manual grading for: ${studentName}`);

        this.currentGrading = {
            id: generateId('manual'),
            studentName,
            essayText,
            prompt,
            startTime: new Date(),
            scores: {},
            feedback: {},
            overallFeedback: ''
        };

        // Pre-fill form if data provided
        if (studentName) {
            const nameInput = document.getElementById('manualStudentName');
            if (nameInput) nameInput.value = studentName;
        }

        if (essayText) {
            const essayInput = document.getElementById('manualEssayText');
            if (essayInput) essayInput.value = essayText;
        }

        if (prompt) {
            const promptInput = document.getElementById('manualPrompt');
            if (promptInput) promptInput.value = prompt;
        }

        eventBus.emit('tab:switch', { tabName: 'manual-grader' });
    }

    /**
     * Handle form submission
     * @param {Event} e - Form submission event
     */
    handleFormSubmission(e) {
        e.preventDefault();
        logger.info('Manual grading form submitted');

        const formData = this.collectFormData();
        const result = this.processGradingData(formData);

        this.displayResults(result);
        eventBus.emit('manual-grading:completed', result);
    }

    /**
     * Collect data from the form
     * @returns {object} Form data
     */
    collectFormData() {
        const formData = {
            studentName: document.getElementById('manualStudentName')?.value || 'Student',
            prompt: document.getElementById('manualPrompt')?.value || '',
            essayText: document.getElementById('manualEssayText')?.value || '',
            overallFeedback: document.getElementById('manualOverallFeedback')?.value || '',
            scores: {},
            feedback: {}
        };

        // Collect scores and individual feedback
        this.scoringCategories.forEach(category => {
            const scoreInput = document.getElementById(`score-${category.id}`);
            const feedbackInput = document.getElementById(`feedback-${category.id}`);

            formData.scores[category.id] = {
                points: parseFloat(scoreInput?.value) || 0,
                out_of: category.max,
                rationale: feedbackInput?.value || ''
            };

            formData.feedback[category.id] = feedbackInput?.value || '';
        });

        return formData;
    }

    /**
     * Process grading data into result format
     * @param {object} formData - Form data
     * @returns {object} Processed result
     */
    processGradingData(formData) {
        let totalScore = 0;
        let totalMax = 0;

        // Calculate totals
        Object.values(formData.scores).forEach(score => {
            totalScore += score.points;
            totalMax += score.out_of;
        });

        const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

        return {
            studentName: formData.studentName,
            essayText: formData.essayText,
            prompt: formData.prompt,
            scores: formData.scores,
            feedback: formData.feedback,
            overallFeedback: formData.overallFeedback,
            totalScore,
            totalMax,
            percentage,
            isManual: true,
            timestamp: new Date().toISOString(),
            gradingId: this.currentGrading?.id || generateId('manual')
        };
    }

    /**
     * Display grading results
     * @param {object} result - Grading result
     */
    displayResults(result) {
        logger.info(`Displaying manual grading results for: ${result.studentName}`);

        // Use the existing display function if available
        eventBus.emit('results:display-manual', result);

        // Also try the legacy method for backward compatibility
        if (typeof window.displayManualGradingResults === 'function') {
            window.displayManualGradingResults(result);
        } else if (window.UIInteractionsModule?.displayManualGradingResults) {
            window.UIInteractionsModule.displayManualGradingResults(result);
        }
    }

    /**
     * Update total score display
     */
    updateTotalScore() {
        let totalPoints = 0;
        let totalMax = 0;

        this.scoringCategories.forEach(category => {
            const input = document.getElementById(`score-${category.id}`);
            if (input) {
                const points = parseFloat(input.value) || 0;
                totalPoints += points;
                totalMax += category.max;
            }
        });

        // Fix floating point precision issues
        totalPoints = Math.round(totalPoints * 10) / 10;
        const percentage = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;

        // Update display elements
        const totalScoreElement = document.getElementById('manualTotalScore');
        const totalMaxElement = document.getElementById('manualTotalMax');
        const totalPercentageElement = document.getElementById('manualTotalPercentage');

        if (totalScoreElement) totalScoreElement.textContent = totalPoints;
        if (totalMaxElement) totalMaxElement.textContent = totalMax;
        if (totalPercentageElement) totalPercentageElement.textContent = percentage;

        // Update color based on percentage
        const color = this.getScoreColor(percentage);
        if (totalScoreElement?.parentElement) {
            totalScoreElement.parentElement.style.color = color;
        }

        logger.debug(`Total score updated: ${totalPoints}/${totalMax} (${percentage}%)`);
    }

    /**
     * Validate score input
     * @param {HTMLInputElement} input - Score input element
     */
    validateScoreInput(input) {
        const value = parseFloat(input.value);
        const max = parseFloat(input.dataset.max) || 15;
        const min = 0;

        if (isNaN(value) || value < min) {
            input.value = min;
        } else if (value > max) {
            input.value = max;
        }

        this.updateTotalScore();
    }

    /**
     * Get color based on score percentage
     * @param {number} percentage - Score percentage
     * @returns {string} Color value
     */
    getScoreColor(percentage) {
        if (percentage >= 90) return '#28a745'; // Green
        if (percentage >= 80) return '#20c997'; // Teal
        if (percentage >= 70) return '#ffc107'; // Yellow
        if (percentage >= 60) return '#fd7e14'; // Orange
        return '#dc3545'; // Red
    }

    /**
     * Clear the manual grading form
     */
    clearForm() {
        logger.info('Clearing manual grading form');

        // Clear text inputs
        const textInputs = ['manualStudentName', 'manualPrompt', 'manualEssayText', 'manualOverallFeedback'];
        textInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        // Clear scores and feedback
        this.scoringCategories.forEach(category => {
            const scoreInput = document.getElementById(`score-${category.id}`);
            const feedbackInput = document.getElementById(`feedback-${category.id}`);

            if (scoreInput) scoreInput.value = '0';
            if (feedbackInput) feedbackInput.value = '';
        });

        // Update total score
        this.updateTotalScore();

        // Clear results
        const resultsDiv = document.getElementById('manualResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
        }

        this.currentGrading = null;
        eventBus.emit('manual-grading:cleared');
    }

    /**
     * Save current grading (export or store)
     */
    saveGrading() {
        if (!this.currentGrading) {
            logger.warn('No current grading to save');
            return;
        }

        const formData = this.collectFormData();
        const result = this.processGradingData(formData);

        logger.info(`Saving manual grading for: ${result.studentName}`);

        // Export as PDF if available
        eventBus.emit('pdf:export-manual', result);

        // Store in local storage as backup
        this.storeGradingResult(result);

        eventBus.emit('manual-grading:saved', result);
    }

    /**
     * Store grading result in local storage
     * @param {object} result - Grading result
     */
    storeGradingResult(result) {
        try {
            const key = `manual_grading_${result.gradingId}`;
            localStorage.setItem(key, JSON.stringify(result));
            logger.debug(`Stored grading result: ${key}`);
        } catch (error) {
            logger.error('Failed to store grading result:', error);
        }
    }

    /**
     * Run a test with sample data
     */
    runTest() {
        logger.info('Running manual grading test');

        const testResult = {
            studentName: "Test Student",
            essayText: "This is a test essay. It has multiple sentences. This helps us test the formatting and display functionality.",
            scores: {
                grammar: { points: 12, out_of: 15, rationale: "Some grammar issues to address." },
                vocabulary: { points: 11, out_of: 15, rationale: "Nice vocabulary choices." },
                spelling: { points: 8, out_of: 10, rationale: "A few spelling errors noted." },
                mechanics: { points: 13, out_of: 15, rationale: "Excellent mechanics and punctuation." },
                fluency: { points: 10, out_of: 15, rationale: "Could improve fluency and flow." },
                layout: { points: 14, out_of: 15, rationale: "Good layout and formatting." },
                content: { points: 12, out_of: 15, rationale: "Good content overall." }
            },
            feedback: {
                grammar: "Some grammar issues to address.",
                vocabulary: "Nice vocabulary choices.",
                spelling: "A few spelling errors noted.",
                mechanics: "Excellent mechanics and punctuation.",
                fluency: "Could improve fluency and flow.",
                layout: "Good layout and formatting.",
                content: "Good content overall."
            },
            overallFeedback: "This is a test of the manual grading system. The student shows promise.",
            totalScore: 80,
            totalMax: 100,
            percentage: 80,
            isManual: true,
            timestamp: new Date().toISOString()
        };

        this.displayResults(testResult);
    }

    /**
     * Get current grading data
     * @returns {object|null} Current grading or null
     */
    getCurrentGrading() {
        return this.currentGrading;
    }

    /**
     * Get scoring categories
     * @returns {array} Scoring categories
     */
    getScoringCategories() {
        return [...this.scoringCategories];
    }
}

// Create and export the manual grading manager instance
const manualGradingManager = new ManualGradingManager();

// Export for ES6 modules
export default manualGradingManager;

// Legacy global access for backward compatibility during transition
if (typeof window !== 'undefined') {
    window.ManualGradingManager = manualGradingManager;

    // Legacy function exports
    window.updateManualScore = () => manualGradingManager.updateTotalScore();
    window.clearManualForm = () => manualGradingManager.clearForm();
    window.testManualGrading = () => manualGradingManager.runTest();
    window.handleManualGradingSubmission = (e) => manualGradingManager.handleFormSubmission(e);
}