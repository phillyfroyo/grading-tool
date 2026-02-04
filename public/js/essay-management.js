/**
 * Essay Management Module
 * Handles multiple essay management, form validation, and UI interactions
 */

// Global essay state
let essayCount = 1;

/**
 * Add another essay input to the form
 * @param {number} count - Number of essays to add (default: 1)
 */
function addAnotherEssay(count = 1) {
    const container = document.getElementById('essaysContainer');
    if (!container) return;

    // Ensure count is a positive integer
    count = Math.max(1, Math.min(50, parseInt(count) || 1));

    for (let i = 0; i < count; i++) {
        const newIndex = essayCount;

        const essayDiv = document.createElement('div');
        essayDiv.className = 'essay-entry';
        essayDiv.setAttribute('data-essay-index', newIndex);
        essayDiv.style.marginTop = '20px';
        essayDiv.style.borderTop = '1px solid #ddd';
        essayDiv.style.paddingTop = '15px';

        essayDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <label style="margin: 0; font-weight: 500;">Essay ${newIndex + 1}:</label>
                <input type="text" class="student-name" placeholder="Student name" required
                       style="padding: 10px; border: 2px solid #ddd; border-radius: 6px; width: 220px; font-size: 16px; height: 42px; box-sizing: border-box;">
                <input type="text" class="student-nickname" placeholder="Nickname (optional)"
                       style="padding: 10px; border: 2px solid #ddd; border-radius: 6px; width: 150px; font-size: 16px; height: 42px; box-sizing: border-box;">
                <button type="button" class="remove-essay-btn" onclick="removeEssay(${newIndex})"
                        style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                    Remove
                </button>
            </div>
            <textarea class="student-text" name="studentText" rows="15" required
                      placeholder="Paste the student's essay here..."></textarea>
        `;

        container.appendChild(essayDiv);
        essayCount++;
    }

    // Show remove buttons for all essays when there's more than one
    updateRemoveButtons();
}

/**
 * Remove an essay by index
 * @param {number} index - Essay index to remove
 */
function removeEssay(index) {
    const essayToRemove = document.querySelector(`[data-essay-index="${index}"]`);
    if (essayToRemove) {
        essayToRemove.remove();
        // Renumber remaining essays
        renumberEssays();
        updateRemoveButtons();
    }
}

/**
 * Renumber essays after removal
 */
function renumberEssays() {
    const essays = document.querySelectorAll('.essay-entry');
    essays.forEach((essay, index) => {
        essay.setAttribute('data-essay-index', index);
        const label = essay.querySelector('label');
        if (label) {
            label.textContent = `Essay ${index + 1}:`;
        }
        const removeBtn = essay.querySelector('.remove-essay-btn');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeEssay(${index})`);
        }
    });
    essayCount = essays.length;
}

/**
 * Update visibility of remove buttons based on essay count
 */
function updateRemoveButtons() {
    const essays = document.querySelectorAll('.essay-entry');
    const showRemoveButtons = essays.length > 1;

    essays.forEach(essay => {
        const removeBtn = essay.querySelector('.remove-essay-btn');
        if (removeBtn) {
            removeBtn.style.display = showRemoveButtons ? 'inline-block' : 'none';
        }
    });
}

/**
 * Display student names progressively during batch grading
 * @param {Array} essays - Array of essay objects
 */
function displayStudentNamesProgressively(essays) {
    const progressiveNamesContainer = document.getElementById('progressive-names');
    if (!progressiveNamesContainer) return;

    essays.forEach((essay, index) => {
        setTimeout(() => {
            const nameDiv = document.createElement('div');
            nameDiv.style.cssText = `
                display: flex;
                align-items: center;
                margin: 8px 0;
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 4px;
                font-weight: 500;
            `;
            nameDiv.id = `student-progress-${index}`;

            nameDiv.innerHTML = `
                <span style="flex-grow: 1;">${essay.studentName}</span>
                <span class="loading-indicator" style="margin-left: 10px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                    </svg>
                </span>
            `;

            progressiveNamesContainer.appendChild(nameDiv);
        }, 500 + (index * 500)); // Start at 500ms, then every 500ms
    });
}

/**
 * Mark a student as complete in the progress display
 * @param {number} index - Student index
 * @param {boolean} success - Whether the operation was successful
 */
function markStudentComplete(index, success = true) {
    const studentDiv = document.getElementById(`student-progress-${index}`);
    if (!studentDiv) return;

    const loadingIndicator = studentDiv.querySelector('.loading-indicator');
    if (!loadingIndicator) return;

    if (success) {
        loadingIndicator.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"></path>
            </svg>
        `;
    } else {
        loadingIndicator.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M15 9l-6 6M9 9l6 6"></path>
            </svg>
        `;
    }
}

/**
 * Collect all essays from the form
 * @returns {Array} Array of essay objects
 */
function collectEssaysFromForm() {
    const essays = [];
    const essayEntries = document.querySelectorAll('.essay-entry');

    essayEntries.forEach((entry, index) => {
        const studentText = entry.querySelector('.student-text')?.value.trim();
        const studentName = entry.querySelector('.student-name')?.value.trim() || `Student ${index + 1}`;
        const studentNickname = entry.querySelector('.student-nickname')?.value.trim() || '';

        if (studentText) {
            essays.push({
                studentText: studentText,
                studentName: studentName,
                studentNickname: studentNickname
            });
        }
    });

    return essays;
}

/**
 * Validate essay form before submission
 * @returns {Object} Validation result with isValid boolean and essays array
 */
function validateEssayForm() {
    const essays = collectEssaysFromForm();

    if (essays.length === 0) {
        showError('Please enter at least one essay to grade.', 'No Essays Found');
        return { isValid: false, essays: [] };
    }

    return { isValid: true, essays };
}

// Claude essay state
let claudeEssayCount = 1;

/**
 * Add another essay input to the Claude form
 */
function addClaudeEssay(count = 1) {
    const container = document.getElementById('claudeEssaysContainer');
    if (!container) return;

    count = Math.max(1, Math.min(50, parseInt(count) || 1));

    for (let i = 0; i < count; i++) {
        const newIndex = claudeEssayCount;
        const essayDiv = document.createElement('div');
        essayDiv.className = 'essay-entry';
        essayDiv.setAttribute('data-essay-index', newIndex);
        essayDiv.style.marginTop = '20px';
        essayDiv.style.borderTop = '1px solid #ddd';
        essayDiv.style.paddingTop = '15px';

        essayDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <label style="margin: 0; font-weight: 500;">Essay ${newIndex + 1}:</label>
                <input type="text" class="student-name" placeholder="Student name" required
                       style="padding: 10px; border: 2px solid #ddd; border-radius: 6px; width: 220px; font-size: 16px; height: 42px; box-sizing: border-box;">
                <input type="text" class="student-nickname" placeholder="Nickname (optional)"
                       style="padding: 10px; border: 2px solid #ddd; border-radius: 6px; width: 150px; font-size: 16px; height: 42px; box-sizing: border-box;">
                <button type="button" class="remove-essay-btn" onclick="removeClaudeEssay(${newIndex})"
                        style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                    Remove
                </button>
            </div>
            <textarea class="student-text" name="studentText" rows="15" required
                      placeholder="Paste the student's essay here..."></textarea>
        `;

        container.appendChild(essayDiv);
        claudeEssayCount++;
    }
    updateClaudeRemoveButtons();
}

/**
 * Remove a Claude essay by index
 */
function removeClaudeEssay(index) {
    const container = document.getElementById('claudeEssaysContainer');
    if (!container) return;
    const essayToRemove = container.querySelector(`[data-essay-index="${index}"]`);
    if (essayToRemove) {
        essayToRemove.remove();
        renumberClaudeEssays();
        updateClaudeRemoveButtons();
    }
}

/**
 * Renumber Claude essays after removal
 */
function renumberClaudeEssays() {
    const container = document.getElementById('claudeEssaysContainer');
    if (!container) return;
    const essays = container.querySelectorAll('.essay-entry');
    essays.forEach((essay, index) => {
        essay.setAttribute('data-essay-index', index);
        const label = essay.querySelector('label');
        if (label) label.textContent = `Essay ${index + 1}:`;
        const removeBtn = essay.querySelector('.remove-essay-btn');
        if (removeBtn) removeBtn.setAttribute('onclick', `removeClaudeEssay(${index})`);
    });
    claudeEssayCount = essays.length;
}

/**
 * Update visibility of remove buttons for Claude essays
 */
function updateClaudeRemoveButtons() {
    const container = document.getElementById('claudeEssaysContainer');
    if (!container) return;
    const essays = container.querySelectorAll('.essay-entry');
    const showRemoveButtons = essays.length > 1;
    essays.forEach(essay => {
        const removeBtn = essay.querySelector('.remove-essay-btn');
        if (removeBtn) removeBtn.style.display = showRemoveButtons ? 'inline-block' : 'none';
    });
}

/**
 * Setup essay management UI
 */
function setupEssayManagement() {
    // Initialize remove buttons visibility
    updateRemoveButtons();
    updateClaudeRemoveButtons();

    // Add event listener for adding essays with count
    const addEssayBtn = document.getElementById('addEssayBtn');
    const essayCountInput = document.getElementById('essayCountInput');

    if (addEssayBtn && essayCountInput) {
        addEssayBtn.addEventListener('click', () => {
            const count = parseInt(essayCountInput.value) || 1;
            addAnotherEssay(count);
        });
    }

    // Add listeners for arrow click areas
    document.querySelectorAll('.essay-counter-arrow').forEach(arrow => {
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();

            const input = document.getElementById(this.dataset.target);
            if (input) {
                const currentValue = parseInt(input.value) || 1;
                const max = parseInt(input.max) || 50;
                const min = parseInt(input.min) || 1;

                let newValue;
                if (this.classList.contains('arrow-up-area')) {
                    newValue = Math.min(currentValue + 1, max);
                } else if (this.classList.contains('arrow-down-area')) {
                    newValue = Math.max(currentValue - 1, min);
                }

                if (newValue !== currentValue) {
                    input.value = newValue;
                }
            }
        });
    });

    // Validate input on blur (when user leaves the field)
    // Using blur instead of input so users can clear the field to type a new number
    if (essayCountInput) {
        essayCountInput.addEventListener('blur', () => {
            let value = parseInt(essayCountInput.value);
            if (isNaN(value) || value < 1) {
                essayCountInput.value = 1;
            } else if (value > 50) {
                essayCountInput.value = 50;
            }
        });
    }

    // Add event listener for Claude adding essays with count
    const claudeAddEssayBtn = document.getElementById('claudeAddEssayBtn');
    const claudeEssayCountInput = document.getElementById('claudeEssayCountInput');

    if (claudeAddEssayBtn && claudeEssayCountInput) {
        claudeAddEssayBtn.addEventListener('click', () => {
            const count = parseInt(claudeEssayCountInput.value) || 1;
            addClaudeEssay(count);
        });
    }

    // Validate Claude input on blur (when user leaves the field)
    // Using blur instead of input so users can clear the field to type a new number
    if (claudeEssayCountInput) {
        claudeEssayCountInput.addEventListener('blur', () => {
            let value = parseInt(claudeEssayCountInput.value);
            if (isNaN(value) || value < 1) {
                claudeEssayCountInput.value = 1;
            } else if (value > 50) {
                claudeEssayCountInput.value = 50;
            }
        });
    }
}

/**
 * Update loading display based on essay count
 * @param {Array} essays - Array of essays
 */
function updateLoadingDisplay(essays) {
    // Find elements in the active tab
    const activeTab = document.querySelector('.tab-content.active');
    const loadingDiv = activeTab ? activeTab.querySelector('#loading') : document.getElementById('loading');
    if (!loadingDiv) return;

    if (essays.length === 1) {
        loadingDiv.innerHTML = '<p>Grading essay... This may take a few moments.</p>';
    } else {
        loadingDiv.innerHTML = `
            <p>Grading ${essays.length} essays... This may take a few moments.</p>
            <div id="progressive-names" style="margin-top: 15px;"></div>
        `;
    }

    loadingDiv.style.display = 'block';
    const resultsDiv = activeTab ? activeTab.querySelector('#results') : document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
    }

    // Disable the grade button in the active form
    const gradeButton = activeTab ? activeTab.querySelector('button[type="submit"]') : document.getElementById('gradeButton');
    if (gradeButton) {
        gradeButton.disabled = true;
    }
}

/**
 * Reset loading state
 */
function resetLoadingState() {
    // Find elements in the active tab
    const activeTab = document.querySelector('.tab-content.active');
    const loadingDiv = activeTab ? activeTab.querySelector('#loading') : document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }

    const gradeButton = activeTab ? activeTab.querySelector('button[type="submit"]') : document.getElementById('gradeButton');
    if (gradeButton) {
        gradeButton.disabled = false;
    }
}

// CSS for spinning animation
const spinAnimationCSS = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
`;

// Add CSS to document if not already present
if (!document.getElementById('essay-management-styles')) {
    const style = document.createElement('style');
    style.id = 'essay-management-styles';
    style.textContent = spinAnimationCSS;
    document.head.appendChild(style);
}

// Export functions for use in other modules
window.EssayManagementModule = {
    addAnotherEssay,
    removeEssay,
    renumberEssays,
    updateRemoveButtons,
    displayStudentNamesProgressively,
    markStudentComplete,
    collectEssaysFromForm,
    validateEssayForm,
    setupEssayManagement,
    updateLoadingDisplay,
    resetLoadingState
};