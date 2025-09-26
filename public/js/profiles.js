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
        console.log('🔄 Loading profiles data...');
        const response = await fetch('/api/profiles?' + Date.now()); // Add cache buster
        console.log('[PROFILES] Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[PROFILES] Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[PROFILES] Raw API response:', data);
        console.log('[PROFILES] data.profiles exists?', !!data.profiles);
        console.log('[PROFILES] data.profiles length:', data.profiles ? data.profiles.length : 'undefined');
        profiles = data.profiles || [];
        console.log('📊 Loaded profiles:', profiles.length);
        updateProfileDropdown();
    } catch (error) {
        console.error('[PROFILES] Error loading profiles:', error);
    }
}

/**
 * Update the profile dropdown with current profiles
 */
function updateProfileDropdown() {
    const select = document.getElementById('classProfile');
    if (!select) return;

    select.innerHTML = '<option value="">Select a class profile...</option>';
    profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name + ' (' + profile.cefrLevel + ')';
        select.appendChild(option);
    });
}

/**
 * Update temperature display value
 * @param {number} value - Temperature value
 */
function updateTemperatureDisplay(value) {
    const element = document.getElementById('temperatureValue');
    if (element) {
        element.textContent = value;
    }
}

/**
 * Update profile temperature display value
 * @param {number} value - Temperature value
 * @param {string} profileId - Profile ID for targeting specific display element
 */
function updateProfileTemperatureDisplay(value, profileId = '') {
    const elementId = profileId ? `profileTemperatureValue-${profileId}` : 'profileTemperatureValue';
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Update temperature display when slider changes (for modal forms)
 */
function updateTemperatureDisplay(profileId, value) {
    const elementId = `profileTemperatureValue-${profileId}`;
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
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
                updateTemperatureDisplay(selectedProfile.temperature);
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
                updateTemperatureDisplay(0);
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
                <h3>${profile.name} (${profile.cefrLevel})</h3>
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
            <div style="max-height: 600px; overflow-y: auto; padding: 15px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 15px; background: #fafafa;">
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
                    <label for="profileVocab-${profileId}">Target Vocabulary (one per line):</label>
                    <textarea id="profileVocab-${profileId}" name="vocabulary" rows="16" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 320px; max-height: 800px;" placeholder="Enter vocabulary words, one per line"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileGrammar-${profileId}">Target Grammar Structures (one per line):</label>
                    <textarea id="profileGrammar-${profileId}" name="grammar" rows="16" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 320px; max-height: 800px;" placeholder="Enter grammar structures, one per line"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profilePrompt-${profileId}">Custom Grading Prompt (optional):</label>
                    <textarea id="profilePrompt-${profileId}" name="prompt" rows="12" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 240px; max-height: 600px;" placeholder="Enter custom grading instructions (leave blank to use default)"></textarea>
                </div>

                <div style="margin-bottom: 15px;">
                    <label for="profileTemperature-${profileId}">Temperature: <span id="profileTemperatureValue-${profileId}">0</span></label>
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
 * Show profile form for creating or editing a profile
 * @param {string} profileId - Profile ID to edit, or null for new profile
 */
function showProfileForm(profileId = null) {
    const form = document.getElementById('profileForm');
    const formElement = document.getElementById('profileFormElement');
    const formTitle = document.getElementById('profileFormTitle');

    if (!form || !formElement) return;

    if (profileId) {
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            document.getElementById('profileName').value = profile.name;
            document.getElementById('profileCefr').value = profile.cefrLevel;
            document.getElementById('profileVocab').value = profile.vocabulary ? profile.vocabulary.join('\n') : '';
            document.getElementById('profileGrammar').value = profile.grammar ? profile.grammar.join('\n') : '';
            document.getElementById('profilePrompt').value = profile.prompt || '';
            document.getElementById('profileTemperature').value = profile.temperature || 0;
            updateProfileTemperatureDisplay(profile.temperature || 0);
            formElement.dataset.profileId = profileId;
            if (formTitle) formTitle.textContent = 'Edit Profile';
        }
    } else {
        // Clear form for new profile
        formElement.reset();
        updateProfileTemperatureDisplay(0);
        delete formElement.dataset.profileId;
        if (formTitle) formTitle.textContent = 'Add New Profile';
    }

    form.style.display = 'block';
}

/**
 * Hide profile form
 */
function hideProfileForm() {
    const form = document.getElementById('profileForm');
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
        vocabulary: formData.get('vocabulary').split('\n').filter(item => item.trim()),
        grammar: formData.get('grammar').split('\n').filter(item => item.trim()),
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

        console.log('[PROFILES] Saving profile:', method, url, profileData);
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        console.log('[PROFILES] Save response status:', response.status, response.statusText);
        if (response.ok) {
            const savedProfile = await response.json();
            console.log('✅ Profile saved successfully:', savedProfile);

            // Validate that the profile was actually saved
            if (!savedProfile || !savedProfile.id) {
                throw new Error('Profile save response is missing expected data');
            }

            console.log('📊 Current profiles array before update:', profiles);

            // Update the local profiles array
            if (profileId) {
                const profileIndex = profiles.findIndex(p => p.id === profileId);
                if (profileIndex !== -1) {
                    profiles[profileIndex] = savedProfile;
                }
            } else {
                profiles.push(savedProfile);
            }

            console.log('📊 Current profiles array after update:', profiles);

            // Update dropdown only (avoid circular refresh)
            updateProfileDropdown();

            // Refresh the profiles list UI to show the changes
            loadProfilesList();

            // Reload profiles from server to ensure sync with retry logic
            let retryCount = 0;
            const maxRetries = 3;
            let profileLoaded = false;

            while (retryCount < maxRetries && !profileLoaded) {
                if (retryCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
                }
                await loadProfilesData();

                // Verify the profile exists in the loaded data
                profileLoaded = profiles.some(p => p.id === savedProfile.id);

                if (!profileLoaded) {
                    console.log(`[PROFILES] Retry ${retryCount + 1}: Profile not found in loaded data, retrying...`);
                    retryCount++;
                } else {
                    console.log('[PROFILES] Profile confirmed in loaded data');
                }
            }

            if (!profileLoaded) {
                console.warn('[PROFILES] Profile may not have persisted properly');
                showError('Profile saved but may require refresh', 'Warning');
            }

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

    // Set up profile form submission handler (legacy modal form)
    const profileForm = document.getElementById('profileFormElement');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileFormSubmission);
    }

    // Set up temperature slider for legacy modal form
    const profileTempSlider = document.getElementById('profileTemperature');
    if (profileTempSlider) {
        profileTempSlider.addEventListener('input', function(e) {
            updateProfileTemperatureDisplay(e.target.value);
        });
    }
}

/**
 * Handle profile form submission
 * @param {Event} e - Form submission event
 */
async function handleProfileFormSubmission(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const profileId = e.target.dataset.profileId;

    const profileData = {
        name: formData.get('name'),
        cefrLevel: formData.get('cefrLevel'),
        vocabulary: formData.get('vocabulary').split('\n').filter(item => item.trim()),
        grammar: formData.get('grammar').split('\n').filter(item => item.trim()),
        prompt: formData.get('prompt'),
        temperature: (() => {
            const temp = parseFloat(formData.get('temperature'));
            return (isNaN(temp) || !isFinite(temp)) ? 0 : temp;
        })()
    };

    try {
        const url = profileId ? `/api/profiles/${profileId}` : '/api/profiles';
        const method = profileId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            const savedProfile = await response.json();
            console.log('✅ Profile saved successfully:', savedProfile);
            console.log('📊 Current profiles array before update:', profiles);

            // Update the local profiles array immediately for UI feedback
            if (profileId) {
                const profileIndex = profiles.findIndex(p => p.id === profileId);
                console.log('📍 Looking for profile to update:', profileId, 'at index:', profileIndex);
                if (profileIndex !== -1) {
                    console.log('📍 Before update:', profiles[profileIndex].name, profiles[profileIndex].temperature);
                    profiles[profileIndex] = savedProfile;
                    console.log('📍 After update:', profiles[profileIndex].name, profiles[profileIndex].temperature);
                    console.log('🔄 Updated local profiles array with saved data');
                }
            } else {
                profiles.push(savedProfile);
            }

            console.log('📊 Current profiles array after update:', profiles);
            console.log('🔄 Refreshing UI components...');

            // Reload profiles from server to ensure sync
            await loadProfilesData();

            loadProfilesList();
            updateProfileDropdown();

            // If editing an existing profile, show the saved data in form and close after delay
            if (profileId) {
                console.log('🔄 Using saved profile data to refresh form:', savedProfile);
                document.getElementById('profileName').value = savedProfile.name;
                document.getElementById('profileCefr').value = savedProfile.cefrLevel;
                document.getElementById('profileVocab').value = savedProfile.vocabulary.join('\n');
                document.getElementById('profileGrammar').value = savedProfile.grammar.join('\n');
                document.getElementById('profilePrompt').value = savedProfile.prompt || '';
                document.getElementById('profileTemperature').value = savedProfile.temperature || 0;
                updateProfileTemperatureDisplay(savedProfile.temperature || 0);

                // Close the form after a short delay to show the updated values
                setTimeout(() => {
                    hideProfileForm();
                    console.log('✅ Profile edit form closed');
                }, 1000);
            } else {
                // For new profiles, close the form immediately
                hideProfileForm();
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

// Export functions for use in other modules
window.ProfilesModule = {
    loadProfilesData,
    updateProfileDropdown,
    updateTemperatureDisplay,
    updateProfileTemperatureDisplay,
    loadProfilesList,
    showProfileForm,
    hideProfileForm,
    deleteProfile,
    initializeProfiles,
    getProfiles: () => profiles
};

// Make updateTemperatureDisplay available globally for inline handlers
window.updateTemperatureDisplay = updateTemperatureDisplay;

// Make functions available globally for onclick handlers
window.showProfileForm = showProfileForm;
window.hideProfileForm = hideProfileForm;
window.deleteProfile = deleteProfile;
window.showAddNewProfileForm = showAddNewProfileForm;
window.hideAddNewProfileForm = hideAddNewProfileForm;
window.toggleProfileEditForm = toggleProfileEditForm;
window.hideProfileEditForm = hideProfileEditForm;
window.closeProfileManagementModal = closeProfileManagementModal;