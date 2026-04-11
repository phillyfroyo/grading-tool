/**
 * Tab Management Module
 * Handles switching between GPT and Manual grading tabs
 */

/**
 * Switch between different tabs in the interface
 * @param {string} tabName - Name of the tab to switch to
 */
function switchTab(tabName) {
    // Clean up any leftover debug elements
    const existingDebugDiv = document.getElementById('debug-message');
    if (existingDebugDiv) {
        existingDebugDiv.remove();
    }

    // Remove active class from all tab contents and buttons
    const allTabs = document.querySelectorAll('.tab-content');
    const allButtons = document.querySelectorAll('.tab-button');

    allTabs.forEach(tab => {
        tab.classList.remove('active');
    });

    allButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content and activate button
    const targetId = tabName + '-content';
    const selectedTab = document.getElementById(targetId);

    if (selectedTab) {
        selectedTab.classList.add('active');
    } else {
        console.error('❌ Could not find tab with ID:', targetId);
    }

    // Add active class to selected tab button
    const buttonSelector = `.tab-button[data-tab="${tabName}"]`;
    const selectedButton = document.querySelector(buttonSelector);

    if (selectedButton) {
        selectedButton.classList.add('active');
    } else {
        console.error('❌ Could not find button with selector:', buttonSelector);
    }

    // Load specific tab content if needed
    if (tabName === 'profiles' && window.ProfilesModule) {
        window.ProfilesModule.loadProfilesList();
    }
}

/**
 * Initialize tab functionality
 */
function initializeTabs() {
    console.log('🔧 Initializing tab functionality...');

    // Add click event listeners to tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Set initial tab state
    switchTab('gpt-grader');

    console.log('✅ Tab functionality initialized');
}

/**
 * Setup tab switching functionality
 */
function setupTabSwitching() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab') || this.textContent.toLowerCase();
            switchTab(tabName);
        });
    });

    // Set initial tab state
    switchTab('gpt-grader');
}

// Export functions for module usage
window.TabManagementModule = {
    switchTab,
    initializeTabs,
    setupTabSwitching
};