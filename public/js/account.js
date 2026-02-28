/**
 * Account Page - My Essays
 * Renders saved essays in the same accordion style as batch results on the main page.
 */

var allEssays = [];
var profileNames = {};

// --- Init ---
document.addEventListener('DOMContentLoaded', async function () {
    try {
        var authResp = await fetch('/auth/status', { credentials: 'include' });
        var authData = await authResp.json();
        if (!authData.authenticated) { window.location.href = '/login'; return; }

        var emailEl = document.getElementById('userEmail');
        if (emailEl && authData.user) emailEl.textContent = authData.user.email;

        await Promise.all([loadProfiles(), loadEssays()]);
        renderEssays();
    } catch (e) {
        console.error('[ACCOUNT] Init error:', e);
        window.location.href = '/login';
    }
});

async function loadProfiles() {
    try {
        var resp = await fetch('/api/profiles', { credentials: 'include' });
        console.log('[ACCOUNT] Profiles response status:', resp.status);
        var data = await resp.json();
        console.log('[ACCOUNT] Profiles data:', data);
        var list = Array.isArray(data) ? data : data.profiles || [];
        list.forEach(function (p) { profileNames[p.id] = { name: p.name, cefrLevel: p.cefrLevel }; });
    } catch (e) { console.error('[ACCOUNT] Profiles error:', e); }
    console.log('[ACCOUNT] Loaded profiles:', Object.keys(profileNames).length);
}

async function loadEssays() {
    try {
        var resp = await fetch('/api/saved-essays', { credentials: 'include' });
        var data = await resp.json();
        allEssays = data.essays || [];
    } catch (e) { console.error('[ACCOUNT] Essays error:', e); allEssays = []; }
}

// --- Render ---
function renderEssays() {
    var container = document.getElementById('essaysContent');
    if (!container) return;

    // Group essays by classProfileId
    var groups = {};
    var noProfile = [];
    allEssays.forEach(function (essay) {
        var pid = essay.classProfileId;
        if (pid) {
            if (!groups[pid]) groups[pid] = [];
            groups[pid].push(essay);
        } else {
            noProfile.push(essay);
        }
    });

    // Start with every known profile (even those with 0 essays)
    profileGroupCounter = 0;
    var html = '';
    Object.keys(profileNames).forEach(function (profileId) {
        var profile = profileNames[profileId];
        var label = profile.name + ' (' + profile.cefrLevel + ')';
        var essays = groups[profileId] || [];
        html += renderProfileGroup(label, essays);
    });

    // Render essays whose profileId doesn't match any known profile
    Object.keys(groups).forEach(function (profileId) {
        if (!profileNames[profileId]) {
            html += renderProfileGroup('Unknown Profile', groups[profileId]);
        }
    });

    // Render essays with no profile
    if (noProfile.length > 0) {
        html += renderProfileGroup('No Class Profile', noProfile);
    }

    // If no profiles exist and no essays, show empty state
    if (!html) {
        container.innerHTML =
            '<div class="empty-state">' +
            '<p>No saved essays yet</p>' +
            '<small>Grade an essay and click "Save Essay" to save it here.</small>' +
            '</div>';
        return;
    }

    container.innerHTML = html;
}

// Track which profile groups are open
var openProfiles = {};
var profileGroupCounter = 0;

function renderProfileGroup(label, essays) {
    var groupId = 'profile-group-' + (profileGroupCounter++);
    var countLabel = essays.length === 0 ? '(none)' : essays.length + ' essay' + (essays.length !== 1 ? 's' : '');
    var isOpen = openProfiles[label] || false;

    var html = '<div class="profile-group">';

    // Clickable profile header
    html += '<div class="profile-group-header" onclick="toggleProfileGroup(\'' + groupId + '\', \'' + esc(label).replace(/'/g, "\\'") + '\')">';
    html += '  <span class="profile-group-arrow' + (isOpen ? ' open' : '') + '" id="arrow-' + groupId + '">&#9660;</span>';
    html += '  <span class="profile-group-label">' + esc(label) + '</span>';
    html += '  <span class="profile-group-count">' + countLabel + '</span>';
    html += '</div>';

    // Collapsible profile body
    html += '<div class="profile-group-body" id="body-' + groupId + '" style="' + (isOpen ? 'max-height: 10000px;' : 'max-height: 0;') + '">';

    if (essays.length === 0) {
        html += '<div class="no-essays-placeholder">No saved essays yet</div>';
    } else {
        essays.forEach(function (essay) {
            var date = new Date(essay.createdAt);
            var dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            var uid = essay.id;

            html += '<div class="saved-essay-row" id="row-' + uid + '">';

            // --- Header (clickable to expand) ---
            html += '<div class="saved-essay-header" onclick="event.stopPropagation(); toggleSavedEssay(\'' + uid + '\')">';
            html += '  <div class="saved-essay-header-left">';
            html += '    <span class="saved-essay-arrow" id="arrow-' + uid + '">&#9660;</span>';
            html += '    <span class="saved-essay-status">&#10003;</span>';
            html += '    <span class="saved-essay-name">' + esc(essay.studentName) + '</span>';
            html += '    <span class="saved-essay-date">' + dateStr + '</span>';
            html += '  </div>';
            html += '  <div class="saved-essay-header-right" id="actions-' + uid + '">';
            html += '    <button class="saved-essay-edit-btn" onclick="event.stopPropagation(); enterEditMode(\'' + uid + '\')">Edit</button>';
            html += '    <button class="saved-essay-delete-btn" onclick="event.stopPropagation(); confirmDeleteEssay(\'' + uid + '\')">Delete</button>';
            html += '  </div>';
            html += '</div>';

            // --- Collapsible content ---
            html += '<div class="saved-essay-content" id="content-' + uid + '">';
            html += '  <div class="saved-essay-content-inner" id="inner-' + uid + '">Loading...</div>';
            html += '</div>';

            html += '</div>';
        });
    }

    html += '</div>'; // end profile-group-body
    html += '</div>'; // end profile-group
    return html;
}

function toggleProfileGroup(groupId, label) {
    var body = document.getElementById('body-' + groupId);
    var arrow = document.getElementById('arrow-' + groupId);
    if (!body) return;

    var isClosed = !body.style.maxHeight || body.style.maxHeight === '0px';

    if (isClosed) {
        body.style.maxHeight = '10000px';
        if (arrow) arrow.classList.add('open');
        openProfiles[label] = true;
    } else {
        body.style.maxHeight = '0px';
        if (arrow) arrow.classList.remove('open');
        openProfiles[label] = false;
    }
}

// --- Toggle expand/collapse ---
function toggleSavedEssay(uid) {
    var content = document.getElementById('content-' + uid);
    var arrow = document.getElementById('arrow-' + uid);
    if (!content) return;

    var isClosed = !content.style.maxHeight || content.style.maxHeight === '0px';

    if (isClosed) {
        // Populate content on first open
        var inner = document.getElementById('inner-' + uid);
        if (inner && inner.textContent === 'Loading...') {
            var essay = allEssays.find(function (e) { return e.id === uid; });
            if (essay) {
                inner.innerHTML = essay.renderedHTML;
                reattachHighlightHandlers(inner);
            }
        }
        content.style.maxHeight = '10000px';
        if (arrow) arrow.classList.add('open');
    } else {
        content.style.maxHeight = '0px';
        if (arrow) arrow.classList.remove('open');
    }
}

// --- Highlight tooltip reattachment ---
function reattachHighlightHandlers(container) {
    var highlights = container.querySelectorAll(
        'span[style*="background"], span[class*="highlight"], span[style*="color"], ' +
        'mark[data-type], mark.highlighted-segment, mark[data-category]'
    );
    highlights.forEach(function (el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            var correction = el.getAttribute('data-correction') || el.getAttribute('title') || '';
            var explanation = el.getAttribute('data-explanation') || '';
            if (correction || explanation) showHighlightTooltip(el, correction, explanation);
        });
    });
}

function showHighlightTooltip(el, correction, explanation) {
    var existing = document.querySelector('.account-highlight-tooltip');
    if (existing) existing.remove();

    var tooltip = document.createElement('div');
    tooltip.className = 'account-highlight-tooltip';
    var html = '';
    if (correction) html += '<div style="margin-bottom:6px;"><strong>Correction:</strong> ' + esc(correction) + '</div>';
    if (explanation) html += '<div><strong>Explanation:</strong> ' + esc(explanation) + '</div>';
    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);

    var rect = el.getBoundingClientRect();
    tooltip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';

    setTimeout(function () {
        document.addEventListener('click', function handler(e) {
            if (!tooltip.contains(e.target)) {
                tooltip.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

// --- Delete ---
function confirmDeleteEssay(uid) {
    if (!confirm('Delete this saved essay? This cannot be undone.')) return;
    deleteEssay(uid);
}

async function deleteEssay(uid) {
    try {
        var resp = await fetch('/api/saved-essays/' + uid, { method: 'DELETE', credentials: 'include' });
        var result = await resp.json();
        if (result.success) {
            allEssays = allEssays.filter(function (e) { return e.id !== uid; });
            renderEssays();
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (e) {
        console.error('[ACCOUNT] Delete error:', e);
        alert('Failed to delete essay: ' + e.message);
    }
}

// --- User dropdown ---
function toggleUserDropdown() {
    var dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Close dropdown on click outside
document.addEventListener('click', function (e) {
    var dropdown = document.getElementById('userDropdown');
    var emailEl = document.getElementById('userEmail');
    if (dropdown && emailEl && !emailEl.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// --- Sign out ---
async function signOut() {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) { /* ignore */ }
    window.location.href = '/login';
}

// --- Edit mode ---
var editOriginalHTML = {};   // uid → original innerHTML for cancel
var editingUid = null;       // currently editing uid (one at a time)

function enterEditMode(uid) {
    // Only one essay editable at a time
    if (editingUid) {
        alert('Please save or cancel your current edit first.');
        return;
    }

    // Expand essay if collapsed
    var content = document.getElementById('content-' + uid);
    var arrow = document.getElementById('arrow-' + uid);
    if (content && (!content.style.maxHeight || content.style.maxHeight === '0px')) {
        // Populate if first open
        var inner = document.getElementById('inner-' + uid);
        if (inner && inner.textContent === 'Loading...') {
            var essay = allEssays.find(function (e) { return e.id === uid; });
            if (essay) {
                inner.innerHTML = essay.renderedHTML;
            }
        }
        content.style.maxHeight = '10000px';
        if (arrow) arrow.classList.add('open');
    }

    var inner = document.getElementById('inner-' + uid);
    if (!inner) return;

    editingUid = uid;
    editOriginalHTML[uid] = inner.innerHTML;

    // Mark row as editing
    var row = document.getElementById('row-' + uid);
    if (row) row.classList.add('editing');

    // Add category bar above essay content
    var catBar = document.createElement('div');
    catBar.className = 'edit-category-bar';
    catBar.id = 'catbar-' + uid;
    var buttonsHTML = window.CategorySelectionModule
        ? window.CategorySelectionModule.createCategoryButtons('')
        : '';
    catBar.innerHTML = buttonsHTML +
        '<span class="edit-status-msg" id="selectionStatus">Select text, then pick a category</span>';
    // Insert bar before inner content
    inner.parentNode.insertBefore(catBar, inner);

    // Initialize editing modules on this container
    initEditingModules(inner);

    // Setup score listeners
    setupScoreListeners(inner);

    // Swap buttons to Save / Cancel
    var actions = document.getElementById('actions-' + uid);
    if (actions) {
        actions.innerHTML =
            '<button class="saved-essay-save-btn" onclick="event.stopPropagation(); saveEdits(\'' + uid + '\')">Save Changes</button>' +
            '<button class="saved-essay-cancel-btn" onclick="event.stopPropagation(); cancelEdit(\'' + uid + '\')">Cancel</button>';
    }
}

function initEditingModules(container) {
    // Attach click handlers to existing highlights → opens edit modal
    if (window.HighlightingModule) {
        window.HighlightingModule.ensureHighlightClickHandlers(container);
    }

    // Enable text selection for new highlights
    var essayContent = container.querySelector('.formatted-essay-content');
    if (essayContent && window.TextSelectionModule) {
        essayContent.addEventListener('mouseup', window.TextSelectionModule.handleTextSelection);
    }

    // Setup category button click handlers
    if (window.CategorySelectionModule) {
        window.CategorySelectionModule.setupCategoryButtons();
    }

    // Migrate any legacy highlights
    if (window.HighlightingModule) {
        window.HighlightingModule.migrateLegacyHighlights(container);
    }
}

function setupScoreListeners(container) {
    container.querySelectorAll('.editable-score').forEach(function (input) {
        // Skip if already wired
        if (input._accountListenerAdded) return;
        input._accountListenerAdded = true;

        input.addEventListener('input', function () {
            var newPoints = parseFloat(this.value) || 0;
            var maxPoints = parseFloat(this.max) || 15;
            if (newPoints < 0) this.value = 0;
            if (newPoints > maxPoints) this.value = maxPoints;
            recalcTotalScore(container);
        });
    });

    container.querySelectorAll('.arrow-up-area, .arrow-down-area').forEach(function (arrow) {
        if (arrow._accountListenerAdded) return;
        arrow._accountListenerAdded = true;

        arrow.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            var input = this.parentElement.querySelector('.editable-score');
            if (!input) return;
            var cur = parseFloat(input.value) || 0;
            var max = parseFloat(input.max) || 15;
            var min = parseFloat(input.min) || 0;
            var newVal;
            if (this.classList.contains('arrow-up-area')) {
                newVal = Math.min(cur + 1, max);
            } else {
                newVal = Math.max(cur - 1, min);
            }
            if (newVal !== cur) {
                input.value = newVal;
                input.dispatchEvent(new Event('input'));
            }
        });
    });
}

function recalcTotalScore(container) {
    var total = 0;
    var maxTotal = 0;
    container.querySelectorAll('.editable-score').forEach(function (input) {
        total += parseFloat(input.value) || 0;
        maxTotal += parseFloat(input.max) || 15;
    });
    // Update total display — look for common total score selectors
    var totalEl = container.querySelector('.total-score-value, .overall-score-value');
    if (totalEl) {
        totalEl.textContent = total + '/' + maxTotal;
    }
    // Also try the percentage display
    var pctEl = container.querySelector('.total-score-percentage');
    if (pctEl && maxTotal > 0) {
        pctEl.textContent = Math.round((total / maxTotal) * 100) + '%';
    }
}

async function saveEdits(uid) {
    var inner = document.getElementById('inner-' + uid);
    if (!inner) return;

    // Remove category bar before capturing HTML
    var catBar = document.getElementById('catbar-' + uid);
    if (catBar) catBar.remove();

    // Sync score input values to their attributes so they persist in HTML
    inner.querySelectorAll('.editable-score').forEach(function (input) {
        input.setAttribute('value', input.value);
    });

    var updatedHTML = inner.innerHTML;

    // Show saving state
    var actions = document.getElementById('actions-' + uid);
    if (actions) {
        actions.innerHTML = '<span style="font-size:12px;color:#666;">Saving...</span>';
    }

    try {
        var resp = await fetch('/api/saved-essays/' + uid, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ renderedHTML: updatedHTML })
        });
        var result = await resp.json();
        if (!result.success) throw new Error(result.error || 'Save failed');

        // Update local data
        var essay = allEssays.find(function (e) { return e.id === uid; });
        if (essay) essay.renderedHTML = updatedHTML;

        // Exit edit mode
        exitEditMode(uid);

        // Re-attach read-only highlight handlers
        reattachHighlightHandlers(inner);

        // Show success feedback
        showEditFeedback(uid, 'Changes saved', 'success');
    } catch (e) {
        console.error('[ACCOUNT] Save error:', e);
        // Restore category bar so user can keep editing
        if (!document.getElementById('catbar-' + uid)) {
            var newBar = document.createElement('div');
            newBar.className = 'edit-category-bar';
            newBar.id = 'catbar-' + uid;
            var buttonsHTML = window.CategorySelectionModule
                ? window.CategorySelectionModule.createCategoryButtons('')
                : '';
            newBar.innerHTML = buttonsHTML +
                '<span class="edit-status-msg" id="selectionStatus">Select text, then pick a category</span>';
            inner.parentNode.insertBefore(newBar, inner);
            if (window.CategorySelectionModule) {
                window.CategorySelectionModule.setupCategoryButtons();
            }
        }
        // Restore save/cancel buttons
        if (actions) {
            actions.innerHTML =
                '<button class="saved-essay-save-btn" onclick="event.stopPropagation(); saveEdits(\'' + uid + '\')">Save Changes</button>' +
                '<button class="saved-essay-cancel-btn" onclick="event.stopPropagation(); cancelEdit(\'' + uid + '\')">Cancel</button>';
        }
        showEditFeedback(uid, 'Save failed: ' + e.message, 'error');
    }
}

function cancelEdit(uid) {
    var inner = document.getElementById('inner-' + uid);
    if (!inner) return;

    // Remove category bar
    var catBar = document.getElementById('catbar-' + uid);
    if (catBar) catBar.remove();

    // Restore original HTML
    if (editOriginalHTML[uid] !== undefined) {
        inner.innerHTML = editOriginalHTML[uid];
    }

    exitEditMode(uid);

    // Re-attach read-only handlers
    reattachHighlightHandlers(inner);
}

function exitEditMode(uid) {
    editingUid = null;
    delete editOriginalHTML[uid];

    // Remove editing class
    var row = document.getElementById('row-' + uid);
    if (row) row.classList.remove('editing');

    // Clear text selection module state
    if (window.TextSelectionModule) {
        window.TextSelectionModule.clearSelection();
    }

    // Restore Edit / Delete buttons
    var actions = document.getElementById('actions-' + uid);
    if (actions) {
        actions.innerHTML =
            '<button class="saved-essay-edit-btn" onclick="event.stopPropagation(); enterEditMode(\'' + uid + '\')">Edit</button>' +
            '<button class="saved-essay-delete-btn" onclick="event.stopPropagation(); confirmDeleteEssay(\'' + uid + '\')">Delete</button>';
    }
}

function showEditFeedback(uid, message, type) {
    var actions = document.getElementById('actions-' + uid);
    if (!actions) return;
    var fb = document.createElement('span');
    fb.className = 'edit-feedback ' + type;
    fb.textContent = message;
    actions.appendChild(fb);
    setTimeout(function () { fb.remove(); }, 3000);
}

// --- Util ---
function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
