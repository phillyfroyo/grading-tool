/**
 * User Menu Functionality
 * Handles user authentication status display and signout
 */

// Load user information on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUserInfo();

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const userMenu = document.querySelector('.user-menu');
        const dropdown = document.getElementById('userDropdown');

        if (!userMenu.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Handle manage profiles button directly
    const manageBtn = document.getElementById('manageProfilesBtn');
    if (manageBtn) {
        console.log('[USER_MENU] Manage profiles button found, adding direct handler');
        manageBtn.addEventListener('click', function(e) {
            console.log('[USER_MENU] Manage profiles button clicked! Opening modal...');
            e.preventDefault();
            e.stopPropagation();

            // Open modal directly
            const modal = document.getElementById('profileManagementModal');
            if (modal) {
                console.log('[USER_MENU] Modal found, showing...');
                modal.style.display = 'block';

                // Load profiles list
                if (window.ProfilesModule && window.ProfilesModule.loadProfilesList) {
                    console.log('[USER_MENU] Loading profiles list...');
                    window.ProfilesModule.loadProfilesList();
                } else {
                    console.error('[USER_MENU] ProfilesModule or loadProfilesList not found');
                }
            } else {
                console.error('[USER_MENU] Profile management modal not found');
            }
        });
    } else {
        console.error('[USER_MENU] Manage profiles button NOT found');
    }
});

/**
 * Load and display user information
 */
async function loadUserInfo() {
    try {
        console.log('[USER_MENU] Fetching auth status...');
        const response = await fetch('/auth/status', {
            method: 'GET',
            credentials: 'include'
        });
        console.log('[USER_MENU] Auth status response:', response.status, response.statusText);

        const data = await response.json();
        console.log('[USER_MENU] Auth status data:', data);
        console.log('[USER_MENU] data.authenticated:', data.authenticated);
        console.log('[USER_MENU] data.user:', data.user);

        const userEmailElement = document.getElementById('userEmail');

        if (data.authenticated && data.user) {
            console.log('[USER_MENU] User authenticated:', data.user.email);
            userEmailElement.textContent = data.user.email;
        } else {
            console.log('[USER_MENU] User not authenticated or no user data');
            console.log('[USER_MENU] authenticated:', data.authenticated, 'user:', data.user);
            userEmailElement.textContent = 'Not logged in';
            userEmailElement.style.color = '#dc3545';
        }
    } catch (error) {
        console.error('[USER_MENU] Error loading user info:', error);
        const userEmailElement = document.getElementById('userEmail');
        userEmailElement.textContent = 'Error loading user';
        userEmailElement.style.color = '#dc3545';
    }
}

/**
 * Toggle the user dropdown menu
 */
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

/**
 * Sign out the current user
 */
async function signOut() {
    try {
        // First check if user is actually authenticated
        const authResponse = await fetch('/auth/status');
        const authData = await authResponse.json();

        if (!authData.authenticated) {
            // User is not authenticated, just redirect to login
            window.location.href = '/login';
            return;
        }

        // User is authenticated, proceed with logout
        const response = await fetch('/auth/logout', {
            method: 'POST'
        });

        if (response.ok) {
            // Redirect to login page
            window.location.href = '/login';
        } else {
            console.error('Error signing out');
            alert('Error signing out. Please try again.');
        }
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Error signing out. Please try again.');
    }
}

// Make functions available globally
window.toggleUserDropdown = toggleUserDropdown;
window.signOut = signOut;