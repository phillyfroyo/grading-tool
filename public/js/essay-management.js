/**
 * Essay Management Module
 * Handles multiple essay management, form validation, and UI interactions
 */

// Global essay state
let essayCount = 1;

/**
 * Add another essay input to the form
 */
function addAnotherEssay() {
    const container = document.getElementById('essaysContainer');
    if (!container) return;

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
                   style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; width: 300px; font-size: 22px; height: 60px; box-sizing: border-box;">
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

        if (studentText) {
            essays.push({
                studentText: studentText,
                studentName: studentName
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

/**
 * Setup essay management UI
 */
function setupEssayManagement() {
    // Initialize remove buttons visibility
    updateRemoveButtons();

    // Add event listener for adding essays
    const addEssayBtn = document.getElementById('addEssayBtn');
    if (addEssayBtn) {
        addEssayBtn.addEventListener('click', addAnotherEssay);
    }
}

/**
 * Update loading display based on essay count
 * @param {Array} essays - Array of essays
 */
function updateLoadingDisplay(essays) {
    const loadingDiv = document.getElementById('loading');
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
    document.getElementById('results').style.display = 'none';

    const gradeButton = document.getElementById('gradeButton');
    if (gradeButton) {
        gradeButton.disabled = true;
    }
}

/**
 * Reset loading state
 */
function resetLoadingState() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }

    const gradeButton = document.getElementById('gradeButton');
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