/**
 * Profile Management Module
 * Handles loading, updating, and managing class profiles
 */

// Global profiles state
let profiles = [];

/**
 * Load profiles data from the server
 */
async function loadProfilesData() {
    try {
        const response = await fetch('/api/profiles?' + Date.now(), {
            method: 'GET',
            credentials: 'include'
        }); // Add cache buster

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[PROFILES] Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        profiles = data.profiles || [];
        updateProfileDropdown();
    } catch (error) {
        console.error('[PROFILES] Error loading profiles:', error);
    }
}

/**
 * Update the profile dropdown with current profiles
 */
function updateProfileDropdown() {
    // Update GPT tab dropdown
    const select = document.getElementById('classProfile');
    if (select) {
        select.innerHTML = '<option value="">Select a class profile...</option>';
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            select.appendChild(option);
        });
    }

    // Update Claude tab dropdown
    const claudeSelect = document.getElementById('claudeClassProfile');
    if (claudeSelect) {
        claudeSelect.innerHTML = '<option value="">Select a class profile...</option>';
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            claudeSelect.appendChild(option);
        });
    }
}

/**
 * Update the temperature display value for a profile slider.
 * @param {number} value - Temperature value
 * @param {string} profileId - Profile ID for targeting specific display element.
 *   If empty, targets the generic '#profileTemperatureValue' element.
 */
function updateProfileTemperatureDisplay(value, profileId = '') {
    const elementId = profileId ? `profileTemperatureValue-${profileId}` : 'profileTemperatureValue';
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Wrapper for inline oninput handlers in profile form HTML templates,
 * e.g. oninput="updateTemperatureDisplay('abc', this.value)".
 * Arg order is (profileId, value) to match the inline handler convention.
 */
function updateTemperatureDisplay(profileId, value) {
    updateProfileTemperatureDisplay(value, profileId);
}

/**
 * Handle profile selection change
 */
function handleProfileSelectionChange() {
    const profileSelect = document.getElementById('classProfile');
    if (!profileSelect) return;

    profileSelect.addEventListener('change', function(e) {
        const selectedProfileId = e.target.value;
        const promptTextarea = document.getElementById('prompt');
        const promptContainer = document.querySelector('label[for="prompt"]')?.parentElement;
        const temperatureContainer = document.getElementById('temperatureContainer');
        const temperatureSlider = document.getElementById('temperature');

        if (selectedProfileId) {
            const selectedProfile = profiles.find(p => p.id === selectedProfileId);

            // Handle prompt visibility
            if (selectedProfile && selectedProfile.prompt && selectedProfile.prompt.trim()) {
                // Profile has a built-in prompt, populate and hide the prompt field
                if (promptTextarea) promptTextarea.value = selectedProfile.prompt;
                if (promptContainer) {
                    promptContainer.style.display = 'none';
                    promptTextarea.style.display = 'none';
                }
            } else {
                // Profile has no built-in prompt, show the prompt field
                if (promptContainer) {
                    promptContainer.style.display = 'block';
                    promptTextarea.style.display = 'block';
                }
                if (promptTextarea && (promptTextarea.value === '' || profiles.some(p => p.prompt === promptTextarea.value))) {
                    promptTextarea.value = '';
                }
            }

            // Hide temperature slider when profile is selected (profile has default temp)
            if (temperatureContainer) {
                temperatureContainer.style.display = 'none';
            }

            // Set temperature from profile (if available)
            if (selectedProfile && selectedProfile.temperature !== undefined) {
                if (temperatureSlider) {
                    temperatureSlider.value = selectedProfile.temperature;
                }
                updateProfileTemperatureDisplay(selectedProfile.temperature);
            }
        } else {
            // No profile selected, show prompt field and temperature slider
            if (promptContainer) {
                promptContainer.style.display = 'block';
                promptTextarea.style.display = 'block';
            }
            if (promptTextarea) promptTextarea.value = '';
            if (temperatureContainer) temperatureContainer.style.display = 'block';
            if (temperatureSlider) {
                temperatureSlider.value = 0;
                updateProfileTemperatureDisplay(0);
            }
        }
    });
}

/**
 * Load and display the profiles list for management
 */
function loadProfilesList() {
    const container = document.getElementById('profilesList');
    if (!container) return;

    if (profiles.length === 0) {
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <button onclick="showAddNewProfileForm()" id="addNewProfileBtn">Add New Profile</button>
            </div>

            <!-- Add New Profile Form (Initially Hidden) -->
            <div id="addNewProfileForm" style="display: none; border: 2px solid #28a745; padding: 20px; margin-bottom: 20px; border-radius: 4px; background: #f8fff8;">
                ${createProfileFormHTML('new')}
            </div>

            <p style="color: #666; text-align: center; margin-top: 40px;">No profiles found. Click "Add New Profile" to create your first profile.</p>
        `;
        // CRITICAL FIX: Set up form handlers even when there are no profiles
        setupProfileFormHandlers();
        return;
    }

    let html = `
        <div style="margin-bottom: 20px;">
            <button onclick="showAddNewProfileForm()" id="addNewProfileBtn">Add New Profile</button>
        </div>

        <!-- Add New Profile Form (Initially Hidden) -->
        <div id="addNewProfileForm" style="display: none; border: 2px solid #28a745; padding: 20px; margin-bottom: 20px; border-radius: 4px; background: #f8fff8;">
            ${createProfileFormHTML('new')}
        </div>
    `;

    profiles.forEach((profile, index) => {
        html += `
            <div class="profile-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px;">
                <h3>${profile.name}</h3>
                <p><strong>CEFR Level:</strong> ${profile.cefrLevel}</p>
                <p><strong>Temperature:</strong> ${profile.temperature || 0}</p>
                <p><strong>Vocabulary:</strong> ${profile.vocabulary ? profile.vocabulary.length : 0} items</p>
                <p><strong>Grammar:</strong> ${profile.grammar ? profile.grammar.length : 0} items</p>
                <p><strong>Prompt:</strong> ${profile.prompt ? 'Custom prompt defined' : 'No custom prompt'}</p>
                <div style="margin-top: 10px;">
                    <button onclick="toggleProfileEditForm('${profile.id}')">Edit</button>
                    <button onclick="deleteProfile('${profile.id}')" style="background: #dc3545; color: white; margin-left: 10px;">Delete</button>
                </div>

                <!-- Edit Form for this specific profile (Initially Hidden) -->
                <div id="editProfileForm-${profile.id}" style="display: none; border-top: 2px solid #007bff; padding-top: 20px; margin-top: 15px; background: #f8f9ff;">
                    ${createProfileFormHTML(profile.id)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Set up form handlers for all forms
    setupProfileFormHandlers();
}

/**
 * Create HTML for profile form
 * @param {string} profileId - Profile ID for editing, or 'new' for new profile
 * @returns {string} HTML string for the form
 */
function createProfileFormHTML(profileId) {
    const isNew = profileId === 'new';
    const formId = isNew ? 'newProfileForm' : `editProfileForm-${profileId}`;
    const title = isNew ? 'Add New Profile' : 'Edit Profile';
    const buttonText = isNew ? 'Create Profile' : 'Update Profile';
    const cancelFunction = isNew ? 'hideAddNewProfileForm()' : `hideProfileEditForm('${profileId}')`;

    return `
        <h4>${title}</h4>
        <form id="${formId}" data-profile-id="${isNew ? '' : profileId}">
            <!-- Scrollable Content Area -->
            <div style="max-height: 600px; overflow-y: auto; padding: 15px 60px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 15px; background: #fafafa;">
                <div style="margin-bottom: 15px;">
                    <label for="profileName-${profileId}">Profile Name:</label>
                    <input type="text" id="profileName-${profileId}" name="name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileCefr-${profileId}">CEFR Level:</label>
                    <select id="profileCefr-${profileId}" name="cefrLevel" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="">Select CEFR Level</option>
                        <option value="A1">A1 - Beginner</option>
                        <option value="A2">A2 - Elementary</option>
                        <option value="B1">B1 - Intermediate</option>
                        <option value="B2">B2 - Upper Intermediate</option>
                        <option value="C1">C1 - Advanced</option>
                        <option value="C2">C2 - Proficient</option>
                    </select>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileSyllabus-${profileId}">Paste your complete syllabus below and we'll extract the class vocab and grammar:
                        <span class="info-icon" data-tooltip="Paste a full syllabus (or a range of units) into this box and click Extract. GPT will parse out the vocabulary and grammar structures and populate the boxes below. You can review and edit the results before saving. This box is a one-shot tool — its contents are not saved with the profile." style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: lightgray; color: white; text-align: center; line-height: 20px; font-size: 14px; font-style: italic; cursor: pointer; margin-left: 5px; position: relative;">i</span>
                    </label>
                    <div style="margin: 4px 0 8px 0; font-size: 13px; color: #666; font-style: italic;">
                        Note: Our syllabi PDFs have a quirk — dragging to highlight multiple units will sometimes silently skip sections. If your extracted vocab or grammar looks incomplete, try pasting one section at a time into the text box.
                    </div>
                    <textarea id="profileSyllabus-${profileId}" name="syllabusPaste" rows="10" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 200px; max-height: 500px;" placeholder="Paste your syllabus here, then click Extract below..."></textarea>
                    <div style="margin-top: 8px; display: flex; align-items: center; gap: 12px;">
                        <button type="button" id="profileExtractBtn-${profileId}" onclick="handleSyllabusExtract('${profileId}')" style="background: #0066cc; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">Extract vocab and grammar</button>
                        <span id="profileExtractStatus-${profileId}" style="font-size: 13px; color: #666;"></span>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileVocab-${profileId}">Target Vocabulary (one per line or comma-separated):
                        <span class="info-icon" data-tooltip="Paste the vocab taught in class into the box below. One word per line OR comma-separated — both work. GPT will take this into consideration when grading essays." style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: lightgray; color: white; text-align: center; line-height: 20px; font-size: 14px; font-style: italic; cursor: pointer; margin-left: 5px; position: relative;">i</span>
                    </label>
                    <textarea id="profileVocab-${profileId}" name="vocabulary" rows="16" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 320px; max-height: 800px;" placeholder="Enter vocabulary words, one per line or comma-separated"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileGrammar-${profileId}">Target Grammar Structures (one per line; use semicolons if a structure contains commas):
                        <span class="info-icon" data-tooltip="Paste the grammar taught in class into the box below. One structure per line. If a structure contains a comma (e.g. 'not only..., but also...'), separate items with semicolons instead. GPT will take this into consideration when grading essays." style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: lightgray; color: white; text-align: center; line-height: 20px; font-size: 14px; font-style: italic; cursor: pointer; margin-left: 5px; position: relative;">i</span>
                    </label>
                    <textarea id="profileGrammar-${profileId}" name="grammar" rows="16" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 320px; max-height: 800px;" placeholder="Enter grammar structures, one per line"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profilePrompt-${profileId}">Custom Grading Prompt (optional):
                        <span class="info-icon" data-tooltip="In this section, paste the prompt provided to the students during the exam. GPT will take this into consideration when grading essays." style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: lightgray; color: white; text-align: center; line-height: 20px; font-size: 14px; font-style: italic; cursor: pointer; margin-left: 5px; position: relative;">i</span>
                    </label>
                    <textarea id="profilePrompt-${profileId}" name="prompt" rows="12" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 240px; max-height: 600px;" placeholder="Enter custom grading instructions (leave blank to use default)"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileTemperature-${profileId}">Temperature: <span id="profileTemperatureValue-${profileId}">0</span>
                        <span class="info-icon" data-tooltip="Temperature control adjusts how merciful/harsh the grade output is relative to the grading rubric. At a temperature of 0, the AI grades strictly to the rubric. Each increment of 0.5 will add or subtract 5 points out of 100. For example, if the AI returns a 50/100 and you set the temperature to 0.5, the algorithm adjusts it to 55/100. At a temperature of 3.0, that same essay becomes 80/100." style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: lightgray; color: white; text-align: center; line-height: 20px; font-size: 14px; font-style: italic; cursor: pointer; margin-left: 5px; position: relative;">i</span>
                    </label>
                    <input type="range" id="profileTemperature-${profileId}" name="temperature" min="-5" max="5" step="0.5" value="0" style="width: 100%;" oninput="updateTemperatureDisplay('${profileId}', this.value)">
                    <div style="display: flex; justify-content: space-between; margin-top: 5px; color: #666; font-size: 12px;">
                        <span>Harsh</span>
                        <span>Follow the Rubric</span>
                        <span>Merciful</span>
                    </div>
                </div>
            </div>

            <!-- Fixed Buttons Area (Outside Scroll) -->
            <div style="text-align: right; padding: 10px 0; border-top: 1px solid #e0e0e0; background: white;">
                <button type="submit" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">${buttonText}</button>
                <button type="button" onclick="${cancelFunction}" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
        </form>
    `;
}

/**
 * Show the "Add New Profile" form
 */
function showAddNewProfileForm() {
    const form = document.getElementById('addNewProfileForm');
    if (form) {
        form.style.display = 'block';
        document.getElementById('addNewProfileBtn').style.display = 'none';
        // Ensure form handlers are attached (in case they weren't already)
        setupProfileFormHandlers();
    }
}

/**
 * Hide the "Add New Profile" form
 */
function hideAddNewProfileForm() {
    const form = document.getElementById('addNewProfileForm');
    if (form) {
        form.style.display = 'none';
        document.getElementById('addNewProfileBtn').style.display = 'block';
        // Reset form
        const formElement = document.getElementById('newProfileForm');
        if (formElement) formElement.reset();
        updateProfileTemperatureDisplay(0, 'new');
    }
}

/**
 * Toggle profile edit form for a specific profile
 * @param {string} profileId - Profile ID to edit
 */
function toggleProfileEditForm(profileId) {
    const form = document.getElementById(`editProfileForm-${profileId}`);
    if (!form) return;

    if (form.style.display === 'none' || !form.style.display) {
        // Show form and populate with profile data
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            document.getElementById(`profileName-${profileId}`).value = profile.name;
            document.getElementById(`profileCefr-${profileId}`).value = profile.cefrLevel;
            document.getElementById(`profileVocab-${profileId}`).value = profile.vocabulary ? profile.vocabulary.join('\n') : '';
            document.getElementById(`profileGrammar-${profileId}`).value = profile.grammar ? profile.grammar.join('\n') : '';
            document.getElementById(`profilePrompt-${profileId}`).value = profile.prompt || '';
            document.getElementById(`profileTemperature-${profileId}`).value = profile.temperature || 0;
            updateProfileTemperatureDisplay(profile.temperature || 0, profileId);
        }
        form.style.display = 'block';
    } else {
        // Hide form
        form.style.display = 'none';
    }
}

/**
 * Hide profile edit form for a specific profile
 * @param {string} profileId - Profile ID
 */
function hideProfileEditForm(profileId) {
    const form = document.getElementById(`editProfileForm-${profileId}`);
    if (form) {
        form.style.display = 'none';
    }
}

/**
 * Close the profile management modal
 */
function closeProfileManagementModal() {
    const modal = document.getElementById('profileManagementModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Setup profile modal event handlers
 */
function setupProfileModalHandlers() {
    const modal = document.getElementById('profileManagementModal');
    if (modal) {
        // Close on backdrop click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeProfileManagementModal();
            }
        });
    }
}

/**
 * Delete a profile
 * @param {string} profileId - Profile ID to delete
 */
async function deleteProfile(profileId) {
    if (!confirm('Are you sure you want to delete this profile?')) {
        return;
    }

    try {
        const response = await fetch(`/api/profiles/${profileId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove from local array
            profiles = profiles.filter(p => p.id !== profileId);
            updateProfileDropdown();

            // Remove the profile item from DOM instead of full refresh
            const profileItem = document.querySelector(`[onclick*="deleteProfile('${profileId}')"]`)?.closest('.profile-item');
            if (profileItem) {
                profileItem.remove();
            }
        } else {
            showError('Error deleting profile', 'Delete Error');
        }
    } catch (error) {
        console.error('Error deleting profile:', error);
        showError('Error deleting profile', 'Delete Error');
    }
}

/**
 * Set up form handlers for all profile forms in the current view
 */
function setupProfileFormHandlers() {
    // Set up all temperature sliders
    const tempSliders = document.querySelectorAll('[id^="profileTemperature-"]');
    tempSliders.forEach(slider => {
        const profileId = slider.id.replace('profileTemperature-', '');
        slider.addEventListener('input', function(e) {
            updateProfileTemperatureDisplay(e.target.value, profileId);
        });
    });

    // Set up all form submissions
    const forms = document.querySelectorAll('[id^="newProfileForm"], [id^="editProfileForm-"]');
    forms.forEach(form => {
        form.addEventListener('submit', handleNewProfileFormSubmission);
    });
}

/**
 * Handle the "Extract vocab and grammar" button on the class profile form.
 *
 * Sends the pasted syllabus text to POST /api/profiles/extract-syllabus,
 * then populates the vocabulary and grammar textareas with the result
 * (joined with newlines so the existing parser handles them correctly).
 *
 * If either textarea already has content, confirms with the user before
 * overwriting.
 *
 * @param {string} profileId - The profile ID suffix used in form field IDs
 */
async function handleSyllabusExtract(profileId) {
    const syllabusTextarea = document.getElementById(`profileSyllabus-${profileId}`);
    const vocabTextarea = document.getElementById(`profileVocab-${profileId}`);
    const grammarTextarea = document.getElementById(`profileGrammar-${profileId}`);
    const button = document.getElementById(`profileExtractBtn-${profileId}`);
    const status = document.getElementById(`profileExtractStatus-${profileId}`);

    if (!syllabusTextarea || !vocabTextarea || !grammarTextarea || !button || !status) {
        console.error('[SYLLABUS_EXTRACT] Missing DOM elements for profile', profileId);
        return;
    }

    const syllabusText = syllabusTextarea.value.trim();
    if (!syllabusText) {
        status.textContent = 'Please paste your syllabus text first.';
        status.style.color = '#c00';
        return;
    }

    // If either textarea already has content, confirm before overwriting.
    const hasExistingContent = vocabTextarea.value.trim() || grammarTextarea.value.trim();
    if (hasExistingContent) {
        const confirmed = await new Promise((resolve) => {
            showConfirmation(
                'Extracting will replace the current vocabulary and grammar in this profile. Continue?',
                () => resolve(true),
                () => resolve(false),
                'Replace existing vocab and grammar?'
            );
        });
        if (!confirmed) return;
    }

    // Run the extraction.
    button.disabled = true;
    button.style.cursor = 'not-allowed';
    button.style.opacity = '0.6';
    const originalButtonText = button.textContent;
    button.textContent = 'Extracting...';
    status.textContent = 'GPT is parsing your syllabus — this takes a few seconds.';
    status.style.color = '#666';

    try {
        const response = await fetch('/api/profiles/extract-syllabus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ syllabusText }),
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const vocabulary = Array.isArray(data.vocabulary) ? data.vocabulary : [];
        const grammar = Array.isArray(data.grammar) ? data.grammar : [];

        // Populate the textareas. Join with newlines so each item is on its own
        // line — the form-submission parser (split on newlines + commas for vocab,
        // newlines + semicolons for grammar) will handle these correctly on save.
        vocabTextarea.value = vocabulary.join('\n');
        grammarTextarea.value = grammar.join('\n');

        status.textContent = `Extracted ${vocabulary.length} vocab items and ${grammar.length} grammar structures. Review below and save when ready.`;
        status.style.color = '#0a7b0a';
    } catch (err) {
        console.error('[SYLLABUS_EXTRACT] Extraction failed:', err);
        status.textContent = `Extraction failed: ${err.message}. Your existing vocab and grammar were not changed.`;
        status.style.color = '#c00';
    } finally {
        button.disabled = false;
        button.style.cursor = 'pointer';
        button.style.opacity = '1';
        button.textContent = originalButtonText;
    }
}

/**
 * Handle new profile form structure submission
 * @param {Event} e - Form submission event
 */
async function handleNewProfileFormSubmission(e) {
    e.preventDefault();
    console.log('[PROFILES] Form submission triggered');

    const form = e.target;
    const formData = new FormData(form);
    const profileId = form.dataset.profileId;
    console.log('[PROFILES] Form data collected, profileId:', profileId);

    const profileData = {
        name: formData.get('name'),
        cefrLevel: formData.get('cefrLevel'),
        // Vocabulary accepts newline OR comma as delimiter (vocab words never contain commas).
        // Grammar accepts newline OR semicolon — commas are intentionally not split because
        // grammar structures may legitimately contain commas (e.g., "not only..., but also...").
        // Both parsers also strip surrounding quotes in case a user pastes a quoted list from a syllabus.
        vocabulary: formData.get('vocabulary').split(/[\n,]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean),
        grammar: formData.get('grammar').split(/[\n;]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean),
        prompt: formData.get('prompt'),
        temperature: (() => {
            const temp = parseFloat(formData.get('temperature'));
            return (isNaN(temp) || !isFinite(temp)) ? 0 : temp;
        })()
    };

    console.log('🔍 [PROFILE_SAVE] Temperature from form:', formData.get('temperature'));
    console.log('🔍 [PROFILE_SAVE] Parsed temperature:', profileData.temperature);
    console.log('🔍 [PROFILE_SAVE] Full profile data:', profileData);

    // Check if prompt is empty and show confirmation
    if (!profileData.prompt || !profileData.prompt.trim()) {
        return new Promise((resolve) => {
            showConfirmation(
                'The prompt field is empty. Are you sure you want to continue?',
                async () => {
                    // User confirmed, proceed with save
                    await saveProfileData(profileData, profileId, form);
                    resolve();
                },
                () => {
                    // User cancelled, do nothing
                    resolve();
                },
                'Empty Prompt Warning'
            );
        });
    }

    // Prompt is not empty, proceed with save
    await saveProfileData(profileData, profileId, form);
}

/**
 * Save profile data to server
 * @param {Object} profileData - Profile data to save
 * @param {string} profileId - Profile ID (if editing)
 * @param {HTMLElement} form - Form element
 */
async function saveProfileData(profileData, profileId, form) {
    try {
        const url = profileId ? `/api/profiles/${profileId}` : '/api/profiles';
        const method = profileId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            const savedProfile = await response.json();

            // Validate that the profile was actually saved
            if (!savedProfile || !savedProfile.id) {
                throw new Error('Profile save response is missing expected data');
            }

            // Update the local profiles array
            if (profileId) {
                const profileIndex = profiles.findIndex(p => p.id === profileId);
                if (profileIndex !== -1) {
                    profiles[profileIndex] = savedProfile;
                }
            } else {
                profiles.push(savedProfile);
            }

            // Update dropdown and list UI
            updateProfileDropdown();
            loadProfilesList();

            // Hide the form only after confirming save
            if (profileId) {
                hideProfileEditForm(profileId);
            } else {
                hideAddNewProfileForm();
            }

        } else {
            console.error('❌ Profile save failed:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('[PROFILES] Error response body:', errorText);
            try {
                const errorData = JSON.parse(errorText);
                console.error('[PROFILES] Parsed error:', errorData);
                if (errorData.redirect === '/login') {
                    console.error('[PROFILES] Authentication required - redirecting to login');
                    window.location.href = '/login';
                    return;
                }
                showError('Error saving profile: ' + (errorData.error || errorData.message || response.status), 'Save Error');
            } catch {
                showError('Error saving profile: ' + response.status, 'Save Error');
            }
        }
    } catch (error) {
        console.error('❌ Profile save error:', error);
        showError('Error saving profile: ' + error.message, 'Save Error');
    }
}

/**
 * Initialize profile management
 */
async function initializeProfiles() {
    // Check auth status first before loading profiles
    try {
        const authResponse = await fetch('/auth/status');
        const authData = await authResponse.json();

        if (authData.authenticated) {
            // Only load profiles if authenticated
            loadProfilesData();
        } else {
            console.log('[PROFILES] User not authenticated, skipping profile load');
        }
    } catch (error) {
        console.error('[PROFILES] Error checking auth status:', error);
    }

    // Set up profile selection handler
    handleProfileSelectionChange();

    // Set up profile modal handlers
    setupProfileModalHandlers();

    // Tooltips for .info-icon elements — hybrid hover + click behavior.
    //
    // Hover (desktop): popup appears below-right of the icon. Dismisses when
    //   cursor leaves the icon, unless the cursor moves onto the popup itself
    //   (so users can read longer tooltips without them vanishing).
    // Click (mobile/touch): popup appears centered on screen. Click again or
    //   click elsewhere to dismiss. Matches the previous click-only behavior.
    //
    // Both modes use the same .info-tooltip-popup element so only one tooltip
    // is ever visible at a time.
    let hoverDismissTimer = null;

    function removeAnyTooltip() {
        const existing = document.querySelector('.info-tooltip-popup');
        if (existing) existing.remove();
        if (hoverDismissTimer) {
            clearTimeout(hoverDismissTimer);
            hoverDismissTimer = null;
        }
    }

    function createTooltipPopup(text, mode, icon) {
        const popup = document.createElement('div');
        popup.className = 'info-tooltip-popup';
        popup.dataset.mode = mode; // 'hover' or 'click' — used to avoid mixing behaviors
        popup.textContent = text;

        if (mode === 'hover') {
            // Position just below and slightly right of the icon.
            const rect = icon.getBoundingClientRect();
            const top = rect.bottom + 8;
            const left = rect.left;
            popup.style.cssText =
                'position:fixed;top:' + top + 'px;left:' + left + 'px;' +
                'background:#333;color:#fff;padding:10px 14px;border-radius:6px;font-size:13px;' +
                'font-style:normal;font-weight:400;line-height:1.5;max-width:280px;z-index:10000;' +
                'box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:auto;';
        } else {
            // Click mode: centered on screen, matches previous behavior.
            popup.style.cssText =
                'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
                'background:#333;color:#fff;padding:14px 18px;border-radius:6px;font-size:14px;' +
                'font-style:normal;font-weight:400;line-height:1.6;width:320px;z-index:10000;' +
                'box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:auto;';
        }

        // If the cursor moves onto the popup, cancel any pending hover dismissal
        // so the user can read longer tooltips without them vanishing.
        popup.addEventListener('mouseenter', function() {
            if (hoverDismissTimer) {
                clearTimeout(hoverDismissTimer);
                hoverDismissTimer = null;
            }
        });
        // Leaving the popup itself dismisses it immediately (hover mode only —
        // click-mode popups are dismissed by clicking elsewhere).
        popup.addEventListener('mouseleave', function() {
            if (popup.dataset.mode === 'hover') {
                removeAnyTooltip();
            }
        });

        document.body.appendChild(popup);
        return popup;
    }

    // Hover-in: show tooltip next to the icon.
    document.addEventListener('mouseover', function(e) {
        const icon = e.target.closest('.info-icon[data-tooltip]');
        if (!icon) return;

        // If a tooltip is already showing for this exact icon, do nothing.
        const existing = document.querySelector('.info-tooltip-popup');
        if (existing && existing.dataset.forIcon === icon.dataset.tooltip) return;

        removeAnyTooltip();
        const popup = createTooltipPopup(icon.dataset.tooltip, 'hover', icon);
        popup.dataset.forIcon = icon.dataset.tooltip;
    });

    // Hover-out: schedule dismissal after a short grace period, giving the
    // user time to move the cursor onto the popup if they want to read it.
    document.addEventListener('mouseout', function(e) {
        const icon = e.target.closest('.info-icon[data-tooltip]');
        if (!icon) return;

        const popup = document.querySelector('.info-tooltip-popup');
        if (!popup || popup.dataset.mode !== 'hover') return;

        if (hoverDismissTimer) clearTimeout(hoverDismissTimer);
        hoverDismissTimer = setTimeout(function() {
            // Only dismiss if the cursor isn't currently over the popup.
            if (!popup.matches(':hover')) {
                removeAnyTooltip();
            }
        }, 150);
    });

    // Click: show centered tooltip (for mobile/touch). Also dismisses any
    // existing tooltip when clicking elsewhere in the document.
    document.addEventListener('click', function(e) {
        const icon = e.target.closest('.info-icon[data-tooltip]');

        removeAnyTooltip();

        if (!icon) return;
        e.preventDefault();
        e.stopPropagation();

        const popup = createTooltipPopup(icon.dataset.tooltip, 'click', icon);
        popup.dataset.forIcon = icon.dataset.tooltip;
    });
}

// Export functions for use in other modules
window.ProfilesModule = {
    loadProfilesData,
    updateProfileDropdown,
    updateTemperatureDisplay,
    updateProfileTemperatureDisplay,
    loadProfilesList,
    deleteProfile,
    initializeProfiles,
    getProfiles: () => profiles
};

// Make functions available globally for inline onclick/oninput handlers
// in profile form HTML templates generated by createProfileFormHTML()
// and loadProfilesList().
window.updateTemperatureDisplay = updateTemperatureDisplay;
window.deleteProfile = deleteProfile;
window.showAddNewProfileForm = showAddNewProfileForm;
window.hideAddNewProfileForm = hideAddNewProfileForm;
window.toggleProfileEditForm = toggleProfileEditForm;
window.hideProfileEditForm = hideProfileEditForm;
window.closeProfileManagementModal = closeProfileManagementModal;
window.handleSyllabusExtract = handleSyllabusExtract;