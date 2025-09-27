/**
 * Manual Grading Module
 * Handles manual grading interface, display, and functionality
 */

/**
 * Display manual grading results using GPT grader format
 * @param {Object} result - Manual grading result object
 */
function displayManualGradingResults(result) {
    const resultsDiv = document.getElementById('manualResults');
    if (!resultsDiv) return;

    console.log('🎯 DISPLAY MANUAL RESULTS CALLED');
    console.log('Manual result:', result);

    // Convert manual result to GPT-compatible format for formatting
    const gradingResults = {
        scores: result.scores,
        total: {
            points: result.totalScore,
            out_of: result.totalMax
        },
        meta: {
            word_count: countWords(result.essayText),
            transition_words_found: [],
            class_vocabulary_used: [],
            grammar_structures_used: []
        },
        teacher_notes: result.overallFeedback || 'Manual grading notes',
        encouragement_next_steps: 'Keep up the good work!',
        inline_issues: []
    };

    console.log('📤 MAKING FORMAT REQUEST FOR MANUAL GRADING...');
    const requestPayload = {
        studentText: result.essayText,
        gradingResults: gradingResults,
        studentName: result.studentName,
        editable: true
    };

    // Format the essay with color coding using the same endpoint as GPT grader
    fetch('/format?cacheBust=' + Date.now(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(requestPayload)
    })
    .then(response => {
        console.log('📥 FORMAT RESPONSE STATUS:', response.status);
        return response.json();
    })
    .then(formatted => {
        console.log('✅ FORMAT RESPONSE RECEIVED:', formatted);

        // Use shared grading display component
        if (window.GradingDisplayModule && window.GradingDisplayModule.createSingleEssayHTML) {
            console.log('✅ Using shared createSingleEssayHTML function');
            resultsDiv.innerHTML = window.GradingDisplayModule.createSingleEssayHTML(result.studentName, formatted);
        } else {
            console.error('❌ CRITICAL: Shared components not available!');
            resultsDiv.innerHTML = createManualEssayHTML(result.studentName, formatted, result);
        }

        resultsDiv.style.display = 'block';

        // Add direct event listener for PDF export button as fallback
        const exportButton = resultsDiv.querySelector('[data-action="export-pdf"]');
        if (exportButton) {
            console.log('📝 Adding direct event listener to manual PDF export button');
            exportButton.addEventListener('click', (event) => {
                console.log('📝 Manual PDF export button clicked directly!');
                event.preventDefault();
                if (window.PDFExportModule && window.PDFExportModule.exportManualToPDF) {
                    console.log('📝 Calling PDFExportModule.exportManualToPDF');
                    window.PDFExportModule.exportManualToPDF();
                } else {
                    console.error('❌ PDFExportModule.exportManualToPDF not found');
                    alert('PDF export is not available. Please refresh the page and try again.');
                }
            });
        } else {
            console.error('❌ Export button not found in manual results');
        }

        // Add event listeners for editable elements
        if (window.GradingDisplayModule && window.GradingDisplayModule.setupEditableElements) {
            console.log('🔄 Using shared editable elements setup');
            const gradingResult = {
                scores: result.scores,
                total: { points: result.totalScore, out_of: result.totalMax }
            };
            const originalData = {
                studentText: result.essayText,
                studentName: result.studentName
            };
            window.GradingDisplayModule.setupEditableElements(gradingResult, originalData);
        }

        // Initialize essay editing functionality if available
        setTimeout(() => {
            if (window.EssayEditingModule) {
                window.EssayEditingModule.initializeEssayEditing();
            }

            // Ensure all existing highlights have click handlers for modal reopening
            if (window.HighlightingModule) {
                window.HighlightingModule.ensureHighlightClickHandlers();
            }
        }, 100);
    })
    .catch(error => {
        console.error('❌ FORMATTING ERROR:', error);
        displayManualGradingResultsBasic(result);
    });
}

/**
 * Create HTML for manual essay display (fallback)
 * @param {string} studentName - Student name
 * @param {Object} formatted - Formatted essay data from /format endpoint
 * @param {Object} result - Original manual grading result
 * @returns {string} HTML string
 */
function createManualEssayHTML(studentName, formatted, result) {
    return `
        <h2>Manual Grading Results for ${studentName}</h2>
        ${formatted.feedbackSummary}
        <h3 style="margin: 20px 0 10px 0;">Color-Coded Essay:</h3>
        <div id="essayContainer" style="border: 1px solid #ddd; border-radius: 4px;">
            <!-- Category selector bar -->
            <div id="categoryBar" style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;">
                <div style="margin-bottom: 5px; font-weight: bold; font-size: 14px;">Select category then highlight text, or highlight text then select category:</div>
                <div id="categoryButtons" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${createManualCategoryButtons()}
                    <button id="clearSelectionBtn" onclick="clearSelection()" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>
                </div>
                <div id="selectionStatus" style="margin-top: 8px; font-size: 12px; color: #666; min-height: 16px;"></div>
            </div>
            <!-- Essay text area -->
            <div class="formatted-essay-content" style="padding: 15px; line-height: 1.6; user-select: text;">
                ${formatted.formattedText}
            </div>
            <!-- Color Legend -->
            ${createManualColorLegend()}
        </div>
        <div style="margin-top: 20px;">
            <button data-action="export-pdf">Export to PDF</button>
        </div>
    `;
}

/**
 * Fallback display for manual grading results (if formatting fails)
 * @param {Object} result - Manual grading result object
 */
function displayManualGradingResultsBasic(result) {
    const resultsDiv = document.getElementById('manualResults');
    if (!resultsDiv) return;

    const scoreColor = getScoreColor(result.percentage);

    resultsDiv.innerHTML = `
        <div class="error" style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; border: 1px solid #f5c6cb; margin-bottom: 20px;">
            <h3>Unable to format essay properly</h3>
            <p>The essay formatting service is unavailable, showing basic results instead.</p>
        </div>

        <div class="grading-summary">
            <h2>Manual Grading Results for ${result.studentName}</h2>

            <div class="overall-score" style="color: ${scoreColor}; font-size: 2em; font-weight: bold; text-align: center; margin: 20px 0;">
                ${result.totalScore}/${result.totalMax} (${result.percentage}%)
            </div>

            <div class="teacher-notes" style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <strong>📝 Teacher Notes:</strong> ${result.overallFeedback || 'No notes provided'}
            </div>

            <div class="category-breakdown">
                <h3>Category Breakdown:</h3>
                ${Object.entries(result.scores).map(([category, score]) => {
                    const feedback = result.feedback[category] || 'No specific feedback provided.';
                    const categoryPercentage = Math.round((score.points / score.out_of) * 100);
                    const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');

                    return `
                        <div class="category-item" style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${scoreColor};">
                            <h4>${categoryName}: <span class="editable-stat-score" style="cursor: pointer; border: 2px solid transparent;" onclick="editStat(this, '${categoryName} Score')" title="Click to edit score" data-category="${category}">${score.points}/${score.out_of}</span> (${categoryPercentage}%)</h4>
                            <p>${feedback}</p>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="essay-text" style="margin: 25px 0;">
                <h3>Essay Text:</h3>
                <div style="padding: 20px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; white-space: pre-wrap; line-height: 1.6;">
                    ${escapeHtml(result.essayText)}
                </div>
            </div>
        </div>
    `;

    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Clear manual grading results
 */
function clearManualResults() {
    const resultsDiv = document.getElementById('manualResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
    }
}

/**
 * Export manual results to PDF
 */
function exportManualResults() {
    if (typeof window.PDFExportModule !== 'undefined' && window.PDFExportModule.exportManualToPDF) {
        window.PDFExportModule.exportManualToPDF();
    } else if (typeof window.PDFExportModule !== 'undefined' && window.PDFExportModule.exportToPDF) {
        // Fallback to regular export if manual export not available
        window.PDFExportModule.exportToPDF();
    } else {
        alert('PDF export functionality is not available.');
    }
}

/**
 * Helper function to count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get score color based on percentage
 * @param {number} percentage - Score percentage
 * @returns {string} Color code
 */
function getScoreColor(percentage) {
    if (percentage >= 90) return '#28a745'; // Green
    if (percentage >= 80) return '#20c997'; // Teal
    if (percentage >= 70) return '#ffc107'; // Yellow
    if (percentage >= 60) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create category buttons for manual grading (matching GPT format)
 * @returns {string} HTML string for category buttons
 */
function createManualCategoryButtons() {
    return `
        <button class="category-btn" data-category="grammar" style="background: transparent; color: #FF8C00; border: 2px solid #FF8C00; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Grammar Error</button>
        <button class="category-btn" data-category="vocabulary" style="background: transparent; color: #00A36C; border: 2px solid #00A36C; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Vocabulary Error</button>
        <button class="category-btn" data-category="mechanics" style="background: #D3D3D3; color: #000000; border: 2px solid #D3D3D3; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Mechanics Error</button>
        <button class="category-btn" data-category="spelling" style="background: transparent; color: #DC143C; border: 2px solid #DC143C; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Spelling Error</button>
        <button class="category-btn" data-category="fluency" style="background: #87CEEB; color: #000000; border: 2px solid #87CEEB; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Fluency Error</button>
        <button class="category-btn" data-category="delete" style="background: transparent; color: #000000; border: 2px solid #000000; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; text-decoration: line-through; transition: all 0.2s;">Delete Word</button>
    `;
}

/**
 * Create color legend for manual grading (matching GPT format)
 * @returns {string} HTML string for color legend
 */
function createManualColorLegend() {
    return `
        <div style="padding: 10px 15px; border-top: 1px solid #ddd; background: #f9f9f9; font-size: 12px;">
            <strong>Highlight Meanings:</strong>
            <span style="color: #FF8C00; font-weight: bold; margin-left: 10px;">grammar</span>
            <span style="color: #00A36C; font-weight: bold; margin-left: 15px;">vocabulary</span>
            <span style="color: #DC143C; font-weight: bold; margin-left: 15px;">spelling</span>
            <span style="background: #D3D3D3; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 15px;">mechanics</span>
            <span style="background: #87CEEB; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 15px;">fluency</span>
            <span style="color: #000; text-decoration: line-through; font-weight: bold; margin-left: 15px;">delete</span>
        </div>
    `;
}

// Test function for manual grading
function testManualGrading() {
    alert('TEST FUNCTION CALLED - VERSION 11 NEW CACHE');
    console.log('🧪 TESTING MANUAL GRADING DISPLAY V11 NEW CACHE...');

    const testResult = {
        studentName: "Test Student",
        essayText: "This is a test essay. It has multiple sentences. This helps us test the formatting and display functionality.",
        scores: {
            content: { points: 12, out_of: 15 },
            organization: { points: 10, out_of: 15 },
            language: { points: 8, out_of: 15 },
            vocabulary: { points: 11, out_of: 15 },
            grammar: { points: 9, out_of: 15 },
            mechanics: { points: 13, out_of: 15 },
            spelling: { points: 7, out_of: 10 }
        },
        feedback: {
            content: "Good content overall.",
            organization: "Could improve organization.",
            language: "Language use needs work.",
            vocabulary: "Nice vocabulary choices.",
            grammar: "Some grammar issues.",
            mechanics: "Excellent mechanics.",
            spelling: "Minor spelling errors."
        },
        overallFeedback: "This is a test of the manual grading system. The student shows promise.",
        totalScore: 80,
        totalMax: 100,
        percentage: 80,
        isManual: true,
        timestamp: new Date().toISOString()
    };

    displayManualGradingResults(testResult);
}

// Export functions for module usage
window.ManualGradingModule = {
    displayManualGradingResults,
    createManualEssayHTML,
    displayManualGradingResultsBasic,
    clearManualResults,
    exportManualResults,
    countWords,
    getScoreColor,
    escapeHtml,
    createManualCategoryButtons,
    createManualColorLegend,
    testManualGrading
};