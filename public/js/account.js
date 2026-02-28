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

function renderProfileGroup(label, essays) {
    var html = '<div class="profile-group">';
    html += '<div class="profile-group-header">' + esc(label) + ' &mdash; ' + essays.length + ' essay' + (essays.length !== 1 ? 's' : '') + '</div>';

    if (essays.length === 0) {
        html += '<div style="padding: 12px 18px; color: #999; font-size: 14px; font-style: italic;">No saved essays yet</div>';
        html += '</div>';
        return html;
    }

    essays.forEach(function (essay, idx) {
        var date = new Date(essay.createdAt);
        var dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        var uid = essay.id; // unique ID for DOM ids

        html += '<div class="saved-essay-row" id="row-' + uid + '">';

        // --- Header (clickable to expand) ---
        html += '<div class="saved-essay-header" onclick="toggleSavedEssay(\'' + uid + '\')">';
        html += '  <div class="saved-essay-header-left">';
        html += '    <span class="saved-essay-arrow" id="arrow-' + uid + '">&#9660;</span>';
        html += '    <span class="saved-essay-status">&#10003;</span>';
        html += '    <span class="saved-essay-name">' + esc(essay.studentName) + '</span>';
        html += '    <span class="saved-essay-date">' + dateStr + '</span>';
        html += '  </div>';
        html += '  <div class="saved-essay-header-right">';
        html += '    <button class="saved-essay-delete-btn" onclick="event.stopPropagation(); confirmDeleteEssay(\'' + uid + '\')">Delete</button>';
        html += '  </div>';
        html += '</div>';

        // --- Collapsible content ---
        html += '<div class="saved-essay-content" id="content-' + uid + '">';
        html += '  <div class="saved-essay-content-inner" id="inner-' + uid + '">Loading...</div>';
        html += '</div>';

        html += '</div>'; // end row
    });

    html += '</div>';
    return html;
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

// --- Sign out ---
async function signOut() {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) { /* ignore */ }
    window.location.href = '/login';
}

// --- Util ---
function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
