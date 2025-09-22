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
});

/**
 * Load and display user information
 */
async function loadUserInfo() {
    try {
        console.log('[USER_MENU] Fetching auth status...');
        const response = await fetch('/auth/status');
        console.log('[USER_MENU] Auth status response:', response.status, response.statusText);

        const data = await response.json();
        console.log('[USER_MENU] Auth status data:', data);

        const userEmailElement = document.getElementById('userEmail');

        if (data.authenticated && data.user) {
            console.log('[USER_MENU] User authenticated:', data.user.email);
            userEmailElement.textContent = data.user.email;
        } else {
            console.log('[USER_MENU] User not authenticated or no user data');
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