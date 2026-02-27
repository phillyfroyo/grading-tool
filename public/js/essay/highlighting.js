/**
 * Highlighting Module
 * Handles text highlighting functionality for essays
 */

// ── Instant custom tooltip (replaces slow native title tooltips) ──
(function initHighlightTooltip() {
    if (document.getElementById('highlight-tooltip')) return;
    const tip = document.createElement('div');
    tip.id = 'highlight-tooltip';
    tip.style.cssText = 'position:fixed;z-index:10000;background:#333;color:#fff;padding:6px 10px;border-radius:6px;font-size:13px;line-height:1.4;max-width:300px;pointer-events:none;opacity:0;transition:opacity 0.1s;white-space:pre-wrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);';
    document.body.appendChild(tip);

    document.addEventListener('mouseenter', function(e) {
        if (!e.target || !e.target.closest) return;
        const mark = e.target.closest('mark[data-category]');
        if (!mark || mark.closest('#editModal')) return;
        const correction = mark.dataset.correction || mark.dataset.message || '';
        const explanation = mark.dataset.explanation || '';
        let text = 'Correction: ' + (correction || 'None');
        text += '\nExplanation: ' + (explanation || 'None');
        tip.textContent = text;
        tip.style.opacity = '1';
        positionTip(e);
    }, true);

    document.addEventListener('mousemove', function(e) {
        if (tip.style.opacity === '1') positionTip(e);
    }, true);

    document.addEventListener('mouseleave', function(e) {
        if (!e.target || !e.target.closest) return;
        const mark = e.target.closest('mark[data-category]');
        if (!mark) return;
        tip.style.opacity = '0';
    }, true);

    function positionTip(e) {
        const x = e.clientX + 12;
        const y = e.clientY + 16;
        tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 8) + 'px';
        tip.style.top = Math.min(y, window.innerHeight - tip.offsetHeight - 8) + 'px';
    }
})();

/**
 * Get category data including color and display information
 * @param {string} category - Category name
 * @returns {Object|null} Category data object or null
 */
function getCategoryData(category) {
    const categories = {
        'grammar': { color: '#FF8C00', name: 'Grammar Error' },
        'vocabulary': { color: '#00A36C', name: 'Vocabulary Error' },
        'mechanics': { color: '#D3D3D3', name: 'Mechanics Error' },
        'spelling': { color: '#DC143C', name: 'Spelling Error' },
        'fluency': { color: '#87CEEB', name: 'Fluency Error' },
        'delete': { color: '#000000', name: 'Delete Word' }
    };
    return categories[category] || null;
}

/**
 * Apply a highlight across block boundaries (e.g. paragraph breaks).
 * When surroundContents() fails because the range spans multiple block
 * elements, this helper splits the highlight into separate <mark> elements
 * — one per text segment — linked by a shared data-highlight-group ID.
 *
 * @param {Range} range - Selection range spanning block boundaries
 * @param {HTMLElement} templateMark - A fully-configured <mark> to clone attributes from
 * @param {Function} clickHandler - Click handler function for each mark
 * @returns {HTMLElement} The first (primary) mark element
 */
function applyHighlightAcrossBlocks(range, templateMark, clickHandler) {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Collect text nodes within the range using TreeWalker
    const container = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Only include text nodes that are at least partially within the range
                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);
                if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) >= 0 ||
                    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) <= 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    // Gather segments: { node, startOffset, endOffset }
    const segments = [];
    let node;
    while ((node = walker.nextNode())) {
        let startOffset = 0;
        let endOffset = node.textContent.length;

        // Clamp to range boundaries
        if (node === range.startContainer) {
            startOffset = range.startOffset;
        }
        if (node === range.endContainer) {
            endOffset = range.endOffset;
        }

        const segmentText = node.textContent.substring(startOffset, endOffset);
        // Skip whitespace-only segments
        if (!segmentText.trim()) continue;

        segments.push({ node, startOffset, endOffset });
    }

    if (segments.length === 0) return null;

    // Apply in reverse order to prevent offset invalidation
    const marks = [];
    for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        const mark = document.createElement('mark');

        // Copy attributes from template
        mark.className = templateMark.className;
        mark.style.cssText = templateMark.style.cssText;
        for (const [key, val] of Object.entries(templateMark.dataset)) {
            mark.dataset[key] = val;
        }

        // Set group linkage
        mark.dataset.highlightGroup = groupId;

        // Give each mark a unique ID; the first (index 0) keeps the template's ID
        if (i === 0) {
            mark.id = templateMark.id;
        } else {
            mark.id = `${templateMark.id}-part${i}`;
        }

        // Wrap the text segment
        const segRange = document.createRange();
        segRange.setStart(seg.node, seg.startOffset);
        segRange.setEnd(seg.node, seg.endOffset);
        segRange.surroundContents(mark);

        // Attach click handler that always opens modal for the primary mark
        mark.addEventListener('click', clickHandler);
        mark._hasLiveClickListener = true;

        marks.unshift(mark); // maintain document order
    }

    // The primary mark is the first one in document order
    const primaryMark = marks[0];

    // Store combined original text on the primary mark
    const combinedText = marks.map(m => m.textContent).join('\n\n');
    primaryMark.dataset.originalText = combinedText;

    return primaryMark;
}

/**
 * Apply highlight to selected text
 * @param {Range} range - Selection range
 * @param {string} text - Selected text
 * @param {string} category - Highlight category
 */
function applyHighlight(range, text, category) {
    try {
        const mark = document.createElement('mark');
        mark.className = `highlight-${category}`;
        mark.dataset.category = category;
        mark.dataset.originalText = text;
        mark.style.cursor = 'pointer';

        // Add unique ID for modal reference
        mark.id = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check if "remove all from PDF" checkbox is checked and auto-exclude if so
        const removeAllCheckbox = document.getElementById('highlights-content-remove-all');
        if (removeAllCheckbox && removeAllCheckbox.checked) {
            mark.dataset.excludeFromPdf = 'true';
            console.log('🚫 Auto-excluding new highlight from PDF (checkbox is checked)');
        }

        // Apply visual styling
        updateHighlightVisualStyling(mark, category);

        // Add click handler for editing
        mark.addEventListener('click', function(e) {
            e.stopPropagation();
            editHighlight(this);
        });

        // Use surroundContents for simple ranges; fall back to cross-block helper
        try {
            range.surroundContents(mark);
        } catch (surroundError) {
            console.log('🔄 surroundContents failed, using cross-block highlight method');
            const primaryMark = applyHighlightAcrossBlocks(range, mark, function(e) {
                e.stopPropagation();
                // Always open modal for the primary (first) mark in the group
                const groupId = this.dataset.highlightGroup;
                const first = document.querySelector(`mark[data-highlight-group="${groupId}"]`);
                editHighlight(first || this);
            });
            if (primaryMark) {
                setTimeout(() => {
                    showHighlightEditModal(primaryMark, [category]);
                }, 100);
            }
            return; // skip the normal setTimeout below
        }

        // Auto-open modal for editing the new highlight
        setTimeout(() => {
            showHighlightEditModal(mark, [category]);
        }, 100); // Small delay to ensure DOM is updated

    } catch (error) {
        console.error('Error applying highlight:', error);
        if (window.TextSelectionModule) {
            window.TextSelectionModule.updateSelectionStatus('Error applying highlight. Try selecting plain text only.');
        }
    }
}

/**
 * Apply highlight for batch essays
 * @param {Range} range - Selection range
 * @param {string} text - Selected text
 * @param {string} category - Highlight category
 * @param {number} essayIndex - Essay index
 */
function applyBatchHighlight(range, text, category, essayIndex) {
    try {
        const mark = document.createElement('mark');
        mark.className = `highlight-${category}`;
        mark.dataset.category = category;
        mark.dataset.originalText = text;
        mark.dataset.essayIndex = essayIndex;
        mark.style.cursor = 'pointer';

        // Add unique ID for modal reference
        mark.id = `highlight-${essayIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check if "remove all from PDF" checkbox is checked and auto-exclude if so
        const removeAllCheckbox = document.getElementById(`highlights-tab-${essayIndex}-remove-all`);
        if (removeAllCheckbox && removeAllCheckbox.checked) {
            mark.dataset.excludeFromPdf = 'true';
            console.log(`🚫 Auto-excluding new highlight from PDF for essay ${essayIndex} (checkbox is checked)`);
        }

        // Apply visual styling
        updateHighlightVisualStyling(mark, category);

        // Add click handler for editing
        mark.addEventListener('click', function(e) {
            e.stopPropagation();
            editBatchHighlight(this, essayIndex);
        });

        // Use surroundContents for simple ranges; fall back to cross-block helper
        try {
            range.surroundContents(mark);
        } catch (surroundError) {
            console.log('🔄 surroundContents failed, using cross-block highlight method');
            const primaryMark = applyHighlightAcrossBlocks(range, mark, function(e) {
                e.stopPropagation();
                const groupId = this.dataset.highlightGroup;
                const first = document.querySelector(`mark[data-highlight-group="${groupId}"]`);
                editBatchHighlight(first || this, essayIndex);
            });
            if (primaryMark) {
                setTimeout(() => {
                    showHighlightEditModal(primaryMark, [category]);
                }, 100);
            }
            return;
        }

        // Auto-open modal for editing the new highlight
        setTimeout(() => {
            showHighlightEditModal(mark, [category]);
        }, 100); // Small delay to ensure DOM is updated

    } catch (error) {
        console.error('Error applying highlight:', error);
        if (window.TextSelectionModule) {
            window.TextSelectionModule.updateBatchSelectionStatus(essayIndex, 'Error applying highlight. Try selecting plain text only.');
        }
    }
}

/**
 * Update highlight visual styling
 * @param {HTMLElement} element - Highlight element
 * @param {string} primaryCategory - Primary category
 */
function updateHighlightVisualStyling(element, primaryCategory, allCategories = null) {
    const categoryStyles = {
        grammar: { color: '#FF8C00', backgroundColor: 'rgba(255, 140, 0, 0.3)' },
        vocabulary: { color: '#00A36C', backgroundColor: 'rgba(0, 163, 108, 0.3)' },
        mechanics: { backgroundColor: '#D3D3D3', color: '#000000' },
        spelling: { color: '#DC143C', backgroundColor: 'rgba(220, 20, 60, 0.3)' },
        fluency: { backgroundColor: '#87CEEB', color: '#000000' },
        delete: { textDecoration: 'line-through', color: '#000000', fontWeight: 'bold' }
    };

    // Reset all category-related styles first to prevent style bleed from previous category
    element.style.color = '';
    element.style.backgroundColor = '';
    element.style.textDecoration = '';
    element.style.fontWeight = '';
    element.style.boxShadow = '';
    element.style.borderBottom = '';

    const style = categoryStyles[primaryCategory];
    if (style) {
        Object.assign(element.style, style);
    }

    // Check for multi-category - add visual indicator
    const categories = allCategories || (element.dataset.category ? element.dataset.category.split(',') : [primaryCategory]);
    if (categories.length > 1) {
        // Multi-category highlight: add dashed underline and box shadow to indicate multiple errors
        const secondaryCategory = categories[1];
        const secondaryStyle = categoryStyles[secondaryCategory];
        if (secondaryStyle) {
            const secondaryColor = secondaryStyle.color || '#666';
            element.style.borderBottom = `2px dashed ${secondaryColor}`;
            element.style.boxShadow = `inset 0 0 0 1px ${secondaryColor}`;
        }
    }
}

/**
 * Edit highlight functionality
 * @param {HTMLElement} markElement - Highlight element to edit
 */
function editHighlight(markElement) {
    // Get current categories
    const categories = (markElement.dataset.category || '').split(',').filter(c => c.trim());

    // Show highlight edit modal
    showHighlightEditModal(markElement, categories);
}

/**
 * Edit highlight for batch essays
 * @param {HTMLElement} element - Highlight element
 * @param {number} essayIndex - Essay index
 */
function editBatchHighlight(element, essayIndex) {
    // Similar to editHighlight but with batch-specific handling
    editHighlight(element);
}

// ── Resize-handle state (module-level) ──────────────────────────────────────
let _resizeState = {
    fullText: '',
    elementStart: 0,
    elementEnd: 0,
    originalStart: 0,
    originalEnd: 0,
    container: null,
    element: null,
    isDragging: false,
    activeHandle: null  // 'left' | 'right'
};

/**
 * Escape HTML special characters
 */
function _escHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/**
 * Render the resizable preview inside #highlightedTextDisplay.
 * Words in context are wrapped in <span class="resize-word" data-char-offset="N">.
 * Drag handles appear at the edges of the highlighted region.
 */
function renderResizePreview() {
    const display = document.getElementById('highlightedTextDisplay');
    if (!display) return;

    const { fullText, elementStart, elementEnd, element } = _resizeState;

    // Lock context window on first render; keep it fixed during drag so text doesn't shift
    if (_resizeState.ctxStart == null || !_resizeState.isDragging) {
        const CONTEXT = 300;
        _resizeState.ctxStart = Math.max(0, elementStart - CONTEXT);
        _resizeState.ctxEnd   = Math.min(fullText.length, elementEnd + CONTEXT);
    }
    let ctxStart = _resizeState.ctxStart;
    let ctxEnd   = _resizeState.ctxEnd;

    const leadingText  = fullText.substring(ctxStart, elementStart);
    const highlightTxt = fullText.substring(elementStart, elementEnd);
    const trailingText = fullText.substring(elementEnd, ctxEnd);

    // ── Category style map (modal preview: black text, category-colored background) ──
    const catStyles = {
        grammar:    'background:rgba(255,140,0,0.3);color:#000;',
        vocabulary: 'background:rgba(0,163,108,0.3);color:#000;',
        mechanics:  'background:#D3D3D3;color:#000;',
        spelling:   'background:rgba(220,20,60,0.3);color:#000;',
        fluency:    'background:#87CEEB;color:#000;',
        delete:     'background:rgba(0,0,0,0.15);text-decoration:line-through;color:#000;font-weight:bold;'
    };

    // ── Build style for the active highlight (use modal's live category selection) ──
    const modal = document.getElementById('editModal');
    const modalCats = modal && modal.dataset.selectedCategories
        ? modal.dataset.selectedCategories.split(',').filter(c => c.trim()) : [];
    const categories = modalCats.length > 0 ? modalCats
        : (element ? (element.dataset.category || '').split(',').filter(c => c.trim()) : []);
    const primaryCat = categories[0] || 'grammar';
    let markStyle = catStyles[primaryCat] || '';

    // Multi-category: add secondary category indicators (matches updateHighlightVisualStyling)
    if (categories.length > 1) {
        const secondaryCat = categories[1];
        const secondaryColors = {
            grammar: '#FF8C00', vocabulary: '#00A36C', mechanics: '#000',
            spelling: '#DC143C', fluency: '#000', delete: '#000'
        };
        const secColor = secondaryColors[secondaryCat] || '#666';
        markStyle += `border-bottom:2px dashed ${secColor};box-shadow:inset 0 0 0 1px ${secColor};`;
    }

    // ── Helper: wrap every character in a hit-target span ──
    function wrapChars(text, baseOffset) {
        if (!text) return '';
        let html = '';
        for (let i = 0; i < text.length; i++) {
            html += `<span class="resize-word" data-char-offset="${baseOffset + i}">${_escHTML(text[i])}</span>`;
        }
        return html;
    }

    // ── Assemble HTML ──
    let html = '';
    if (ctxStart > 0) html += '<span style="color:#aaa;">\u2026</span>';
    html += wrapChars(leadingText, ctxStart);
    html += `<mark class="resizable-highlight" style="${markStyle} cursor:default;">`;
    html += `<span class="highlight-handle highlight-handle-left highlight-handle-edge" title="Drag to resize"></span>`;
    html += `<span class="highlight-handle highlight-handle-left highlight-handle-dot" title="Drag to resize"></span>`;
    html += wrapChars(highlightTxt, elementStart);
    html += `<span class="highlight-handle highlight-handle-right highlight-handle-dot" title="Drag to resize"></span>`;
    html += `<span class="highlight-handle highlight-handle-right highlight-handle-edge" title="Drag to resize"></span>`;
    html += `</mark>`;
    html += wrapChars(trailingText, elementEnd);
    if (ctxEnd < fullText.length) html += '<span style="color:#aaa;">\u2026</span>';

    display.innerHTML = html;

    // Center highlight in view, but skip during drag to prevent text motion
    if (!_resizeState.isDragging) {
        requestAnimationFrame(() => {
            const mark = display.querySelector('mark.resizable-highlight');
            if (mark) {
                const markCenter = mark.offsetLeft + mark.offsetWidth / 2;
                display.scrollLeft = markCenter - display.clientWidth / 2;
            }
        });
    }

    setupResizeHandles();
}

/**
 * Attach drag events to the two handle elements inside #highlightedTextDisplay.
 */
function setupResizeHandles() {
    const display = document.getElementById('highlightedTextDisplay');
    if (!display) return;

    const leftHandles  = display.querySelectorAll('.highlight-handle-left');
    const rightHandles = display.querySelectorAll('.highlight-handle-right');

    function onStart(side, e) {
        e.preventDefault();
        _resizeState.isDragging = true;
        _resizeState.activeHandle = side;
        // Add dragging class to all elements on this side
        display.querySelectorAll(`.highlight-handle-${side}`).forEach(el => el.classList.add('dragging'));
        // Lock cursor to ew-resize on ALL elements, disable text selection and scrolling
        if (!document.getElementById('drag-cursor-override')) {
            const style = document.createElement('style');
            style.id = 'drag-cursor-override';
            style.textContent = '* { cursor: ew-resize !important; user-select: none !important; }';
            document.head.appendChild(style);
        }
        // Lock scroll position instead of hiding scrollbar (prevents layout shift)
        _resizeState._lockedScrollLeft = display.scrollLeft;
        _resizeState._scrollLock = () => { display.scrollLeft = _resizeState._lockedScrollLeft; };
        display.addEventListener('scroll', _resizeState._scrollLock);
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onEnd, true);
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', onEnd, true);
    }

    function clientPos(e) {
        if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    let _scrollRAF = null;

    function edgeScroll(e) {
        // Gently scroll when cursor is within 30px of the display edges
        const rect = display.getBoundingClientRect();
        const { x } = clientPos(e);
        const EDGE = 30;
        const SPEED = 3;

        if (x < rect.left + EDGE) {
            display.scrollLeft -= SPEED;
        } else if (x > rect.right - EDGE) {
            display.scrollLeft += SPEED;
        }
    }

    function findNearestWord(cursorX) {
        // Find the .resize-word whose horizontal center is closest to cursorX
        const words = display.querySelectorAll('.resize-word');
        let best = null;
        let bestDist = Infinity;
        for (const w of words) {
            const rect = w.getBoundingClientRect();
            const center = rect.left + rect.width / 2;
            const dist = Math.abs(cursorX - center);
            if (dist < bestDist) {
                bestDist = dist;
                best = w;
            }
        }
        return best;
    }

    function onMove(e) {
        if (!_resizeState.isDragging) return;
        const { x, y } = clientPos(e);

        // Try elementFromPoint first (fast path), fall back to nearest by X
        let el = document.elementFromPoint(x, y);
        if (!el || !el.classList.contains('resize-word')) {
            el = findNearestWord(x);
        }
        if (!el) return;

        const wordOffset = parseInt(el.dataset.charOffset, 10);
        const wordLen    = el.textContent.length;

        if (_resizeState.activeHandle === 'left') {
            const newStart = wordOffset;
            if (newStart < _resizeState.elementEnd) {
                _resizeState.elementStart = newStart;
                renderResizePreview();
            }
        } else {
            const newEnd = wordOffset + wordLen;
            if (newEnd > _resizeState.elementStart) {
                _resizeState.elementEnd = newEnd;
                renderResizePreview();
            }
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        onMove(e);
    }

    function onEnd() {
        _resizeState.isDragging = false;
        display.querySelectorAll('.highlight-handle.dragging').forEach(el => el.classList.remove('dragging'));
        // Restore normal cursor, text selection, and scrolling
        const overrideStyle = document.getElementById('drag-cursor-override');
        if (overrideStyle) overrideStyle.remove();
        if (_resizeState._scrollLock) {
            display.removeEventListener('scroll', _resizeState._scrollLock);
            _resizeState._scrollLock = null;
        }
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onEnd, true);
        document.removeEventListener('touchmove', onTouchMove, true);
        document.removeEventListener('touchend', onEnd, true);

        // Mark as resized if boundaries changed
        if (_resizeState.elementStart !== _resizeState.originalStart ||
            _resizeState.elementEnd   !== _resizeState.originalEnd) {
            const modal = document.getElementById('editModal');
            if (modal) modal.dataset.highlightResized = 'true';
        }
    }

    leftHandles.forEach(h => {
        h.addEventListener('mousedown', (e) => onStart('left', e));
        h.addEventListener('touchstart', (e) => { e.preventDefault(); onStart('left', e); }, { passive: false });
    });
    rightHandles.forEach(h => {
        h.addEventListener('mousedown', (e) => onStart('right', e));
        h.addEventListener('touchstart', (e) => { e.preventDefault(); onStart('right', e); }, { passive: false });
    });

    // Restore active-side dot indicator after re-render
    if (_resizeState.keyboardSide) {
        display.querySelectorAll('.highlight-handle-dot').forEach(d => d.style.opacity = '0.4');
        display.querySelectorAll(`.highlight-handle-${_resizeState.keyboardSide}.highlight-handle-dot`).forEach(d => d.style.opacity = '1');
    }

    // ── Keyboard arrow-key support ──
    // Click the highlight to activate a side, then use arrow keys to adjust by 1 char.
    const mark = display.querySelector('mark.resizable-highlight');
    if (mark) {
        mark.style.cursor = 'pointer';
        mark.addEventListener('mousedown', (e) => {
            // Ignore if this mousedown is on a handle (let drag handle it)
            if (e.target.closest('.highlight-handle')) return;
            e.preventDefault();
            // Determine which side based on click position within the mark
            const rect = mark.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const side = clickX < rect.width / 2 ? 'left' : 'right';
            _resizeState.keyboardSide = side;
            // Visual indicator: highlight the active dot
            display.querySelectorAll('.highlight-handle-dot').forEach(d => d.style.opacity = '0.4');
            display.querySelectorAll(`.highlight-handle-${side}.highlight-handle-dot`).forEach(d => d.style.opacity = '1');
        });
    }

    // Attach keydown on document with capture to intercept before scroll
    if (!document._highlightKeyResizeAttached) {
        document.addEventListener('keydown', (e) => {
            if (!_resizeState.keyboardSide) return;
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            // Don't intercept if focus is in a textarea or input
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            // Only act when the edit modal is visible
            const m = document.getElementById('editModal');
            if (!m || m.style.display === 'none') return;
            e.preventDefault();
            e.stopPropagation();

            const side = _resizeState.keyboardSide;
            const delta = e.key === 'ArrowLeft' ? -1 : 1;

            if (side === 'left') {
                const newStart = _resizeState.elementStart + delta;
                if (newStart >= 0 && newStart < _resizeState.elementEnd) {
                    _resizeState.elementStart = newStart;
                }
            } else {
                const newEnd = _resizeState.elementEnd + delta;
                if (newEnd > _resizeState.elementStart && newEnd <= _resizeState.fullText.length) {
                    _resizeState.elementEnd = newEnd;
                }
            }

            renderResizePreview();

            // Mark as resized if boundaries changed
            if (_resizeState.elementStart !== _resizeState.originalStart ||
                _resizeState.elementEnd   !== _resizeState.originalEnd) {
                if (m) m.dataset.highlightResized = 'true';
            }
        }, true);  // capture phase — fires before the scrollable div handles it
        document._highlightKeyResizeAttached = true;
    }
}

/**
 * After user resizes a highlight, rebuild the <mark> in the actual essay DOM
 * with the new text boundaries.
 */
function rebuildHighlightBoundaries(oldMark, newStart, newEnd, container) {
    // ── 1. Gather data from old mark ──
    const dataset = { ...oldMark.dataset };
    const categories = (dataset.category || '').split(',').filter(c => c.trim());
    const primaryCat = categories[0] || 'grammar';
    const oldId = oldMark.id;
    const oldGroupId = oldMark.dataset.highlightGroup;

    // ── 2. Unwrap old mark (and all group siblings if grouped) ──
    if (oldGroupId) {
        const groupMarks = document.querySelectorAll(`mark[data-highlight-group="${oldGroupId}"]`);
        groupMarks.forEach(m => {
            const p = m.parentNode;
            while (m.firstChild) {
                p.insertBefore(m.firstChild, m);
            }
            p.removeChild(m);
            p.normalize();
        });
    } else {
        const parent = oldMark.parentNode;
        while (oldMark.firstChild) {
            parent.insertBefore(oldMark.firstChild, oldMark);
        }
        parent.removeChild(oldMark);
        parent.normalize();  // merge adjacent text nodes
    }

    // ── 3. Walk text nodes to locate new start/end positions ──
    function findPosition(root, targetOffset) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let charCount = 0;
        let node;
        while ((node = walker.nextNode())) {
            const nodeLen = node.textContent.length;
            if (charCount + nodeLen > targetOffset) {
                return { node, offset: targetOffset - charCount };
            }
            charCount += nodeLen;
        }
        // Edge case: exact end of container
        const walker2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let lastNode = null;
        while ((node = walker2.nextNode())) lastNode = node;
        if (lastNode) return { node: lastNode, offset: lastNode.textContent.length };
        return null;
    }

    const startPos = findPosition(container, newStart);
    const endPos   = findPosition(container, newEnd);
    if (!startPos || !endPos) {
        console.error('Could not find text positions for resized highlight');
        return null;
    }

    // ── 4. Create range and wrap in new mark ──
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    const newMark = document.createElement('mark');
    newMark.id = oldId;
    newMark.className = `highlight-${primaryCat}`;
    newMark.style.cursor = 'pointer';

    // Copy all data attributes (remove old group ID — new wrap may or may not need one)
    for (const [key, value] of Object.entries(dataset)) {
        if (key === 'highlightGroup') continue;
        newMark.dataset[key] = value;
    }
    // Update original text to the new selection
    newMark.dataset.originalText = range.toString();

    try {
        range.surroundContents(newMark);
        // ── 5. Re-apply visual styling ──
        updateHighlightVisualStyling(newMark, primaryCat, categories);
        // ── 6. Re-attach click handler ──
        newMark.addEventListener('click', function(e) {
            e.stopPropagation();
            editHighlight(this);
        });
        newMark._hasLiveClickListener = true;
    } catch (err) {
        console.log('surroundContents failed in resize, using cross-block method');
        // Use cross-block helper for resized highlight that still spans blocks
        const primaryMark = applyHighlightAcrossBlocks(range, newMark, function(e) {
            e.stopPropagation();
            const gid = this.dataset.highlightGroup;
            const first = document.querySelector(`mark[data-highlight-group="${gid}"]`);
            editHighlight(first || this);
        });
        if (primaryMark) {
            updateHighlightVisualStyling(primaryMark, primaryCat, categories);
            // Propagate styling to siblings
            const gid = primaryMark.dataset.highlightGroup;
            if (gid) {
                document.querySelectorAll(`mark[data-highlight-group="${gid}"]`).forEach(sib => {
                    if (sib !== primaryMark) {
                        updateHighlightVisualStyling(sib, primaryCat, categories);
                    }
                });
            }
            // Emit event
            if (window.eventBus) {
                window.eventBus.emit('highlight:updated', {
                    element: primaryMark,
                    categories,
                    correction: primaryMark.dataset.correction,
                    explanation: primaryMark.dataset.explanation
                });
            }
            return primaryMark;
        }
    }

    // ── 7. Emit event for auto-save ──
    if (window.eventBus) {
        window.eventBus.emit('highlight:updated', {
            element: newMark,
            categories,
            correction: newMark.dataset.correction,
            explanation: newMark.dataset.explanation
        });
    }

    return newMark;
}

/**
 * Show highlight edit modal
 * @param {HTMLElement} element - Highlight element
 * @param {Array} currentCategories - Current categories
 */
function showHighlightEditModal(element, currentCategories) {
    console.log('📝 Opening highlight edit modal for element:', element);

    // Ensure element has an ID
    if (!element.id) {
        element.id = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('🆔 Generated ID for element:', element.id);
    }

    // Use the new modal manager
    const modal = document.getElementById('editModal');
    const modalCategoryButtons = document.getElementById('modalCategoryButtons');
    const correctionTextarea = document.getElementById('editCorrection');
    const explanationTextarea = document.getElementById('editExplanation');
    const highlightedTextDisplay = document.getElementById('highlightedTextDisplay');

    if (!modal || !modalCategoryButtons || !correctionTextarea) {
        console.error('Edit modal elements not found');
        return;
    }

    // Display the highlighted text with surrounding context + resize handles
    if (highlightedTextDisplay) {
        const container = element.closest('.formatted-essay-content') || element.parentElement;
        const fullText = container.textContent || '';

        // For grouped highlights, compute span from first to last mark in group
        const groupId = element.dataset.highlightGroup;
        let firstMark = element;
        let lastMark = element;
        if (groupId) {
            const groupMarks = Array.from(document.querySelectorAll(`mark[data-highlight-group="${groupId}"]`));
            if (groupMarks.length > 0) {
                firstMark = groupMarks[0];
                lastMark = groupMarks[groupMarks.length - 1];
            }
        }

        // Compute position via Range (original reliable approach)
        let elementStart = -1;
        try {
            const range = document.createRange();
            range.selectNodeContents(container);
            range.setEnd(firstMark, 0);
            elementStart = range.toString().length;
        } catch (e) {
            elementStart = fullText.indexOf(firstMark.textContent);
        }
        // End position: use lastMark
        let elementEnd = 0;
        try {
            const range2 = document.createRange();
            range2.selectNodeContents(container);
            range2.setEnd(lastMark, lastMark.childNodes.length);
            elementEnd = range2.toString().length;
        } catch (e) {
            const lastText = lastMark.textContent || '';
            elementEnd = elementStart !== -1 ? elementStart + lastText.length : 0;
        }

        // Populate module-level state for resize
        _resizeState.fullText      = fullText;
        _resizeState.elementStart  = elementStart;
        _resizeState.elementEnd    = elementEnd;
        _resizeState.originalStart = elementStart;
        _resizeState.originalEnd   = elementEnd;
        _resizeState.container     = container;
        _resizeState.element       = element;
        _resizeState.ctxStart      = null;
        _resizeState.ctxEnd        = null;
        _resizeState.keyboardSide  = 'right';

        // Reset resize flag
        modal.dataset.highlightResized = '';
    }

    // COMPLETE modal reset to prevent any interference between highlights
    modal.dataset.selectedCategories = '';
    modal.dataset.editingElement = '';

    // Clear any lingering button states from previous edits
    modal.querySelectorAll('.modal-category-btn').forEach(btn => {
        btn.classList.remove('modal-category-selected');
        btn.style.backgroundColor = '';
        btn.style.color = '';
        const checkmark = btn.querySelector('.checkmark');
        if (checkmark) {
            checkmark.remove();
        }
    });

    // Set current categories for this specific edit session
    modal.dataset.selectedCategories = currentCategories.join(',');

    // Now render the preview with correct categories set
    if (highlightedTextDisplay) {
        renderResizePreview();
    }

    // Store reference to the element being edited (AFTER clearing state)
    modal.dataset.editingElement = element.id;
    console.log('✅ Stored editing element ID:', element.id);

    // Clear any previous category button states
    modal.querySelectorAll('.modal-category-btn').forEach(btn => {
        btn.classList.remove('modal-category-selected');
        const category = btn.dataset.category;
        const categoryData = getCategoryData(category);
        if (categoryData) {
            const isMechanics = category === 'mechanics';
            const isFluency = category === 'fluency';
            // Reset to default state
            btn.style.backgroundColor = (isMechanics || isFluency) ? categoryData.color : 'transparent';
            btn.style.color = (isMechanics || isFluency) ? 'black' : categoryData.color;
            // Remove any checkmarks
            const checkmark = btn.querySelector('.checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    });

    // Create category buttons
    const categories = [
        { id: 'grammar', name: 'Grammar Error', color: '#FF8C00' },
        { id: 'vocabulary', name: 'Vocabulary Error', color: '#00A36C' },
        { id: 'mechanics', name: 'Mechanics Error', color: '#D3D3D3' },
        { id: 'spelling', name: 'Spelling Error', color: '#DC143C' },
        { id: 'fluency', name: 'Fluency Error', color: '#87CEEB' },
        { id: 'delete', name: 'Delete Word', color: '#000000' }
    ];

    modalCategoryButtons.innerHTML = categories.map(category => {
        const isSelected = currentCategories.includes(category.id);
        const isMechanics = category.id === 'mechanics';
        const isFluency = category.id === 'fluency';
        const isDelete = category.id === 'delete';

        const bgColor = isSelected
            ? category.color
            : (isMechanics || isFluency ? category.color : 'transparent');
        const textColor = isSelected
            ? 'white'
            : (isMechanics || isFluency ? 'black' : category.color);
        const decoration = isDelete ? 'text-decoration: line-through;' : '';
        const selectedClass = isSelected ? 'modal-category-selected' : '';

        return `
            <button class="modal-category-btn ${selectedClass}" data-category="${category.id}"
                    style="background: ${bgColor}; color: ${textColor}; border: 2px solid ${category.color};
                           padding: 6px 14px; border-radius: 16px; cursor: pointer; font-weight: 600;
                           transition: all 0.2s; font-size: 13px; ${decoration}; position: relative;">
                ${category.name}
                ${isSelected ? '<span class="checkmark" style="position: absolute; top: -4px; right: -4px; background: #28a745; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">✓</span>' : ''}
            </button>
        `;
    }).join('');

    // Add click handlers to category buttons
    modalCategoryButtons.querySelectorAll('.modal-category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            toggleModalCategory(this.dataset.category);
        });
    });

    // Set correction and explanation from element data or empty
    const currentCorrection = element.dataset.correction || element.dataset.message || '';
    const currentExplanation = element.dataset.explanation || ''; // Don't fall back to notes - that contains correction
    correctionTextarea.value = currentCorrection;
    if (explanationTextarea) {
        explanationTextarea.value = currentExplanation;
    }

    // Attach auto-resize input listeners (one-time setup)
    [correctionTextarea, explanationTextarea].forEach(ta => {
        if (!ta || ta.dataset.autoResizeAttached) return;
        ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
        ta.dataset.autoResizeAttached = 'true';
    });

    // SIMPLIFIED APPROACH: Modal is display-only, category selection triggers immediate auto-save
    // Add handlers for all modal buttons - one-time setup to prevent duplicates

    // Close button (X)
    const closeButton = modal.querySelector('.modal-close-btn');
    if (closeButton && !closeButton.dataset.simpleHandlerAttached) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        closeButton.dataset.simpleHandlerAttached = 'true';
    }

    // Save button - saves both categories and notes
    const saveButton = modal.querySelector('.modal-save-btn');
    if (saveButton && !saveButton.dataset.simpleHandlerAttached) {
        saveButton.addEventListener('click', () => {
            const elementId = modal.dataset.editingElement;
            const element = document.getElementById(elementId);
            const selectedCategories = modal.dataset.selectedCategories ? modal.dataset.selectedCategories.split(',').filter(c => c.trim()) : [];

            if (element && selectedCategories.length > 0) {
                console.log('💾 Saving highlight with categories:', selectedCategories);

                // Save categories to element (update both data-category and data-type for compatibility)
                element.dataset.category = selectedCategories.join(',');
                element.dataset.type = selectedCategories[0]; // data-type stores primary category

                // Update className to match new primary category
                // Remove old highlight-* classes and add new one
                element.className = element.className.replace(/highlight-\w+/g, '').trim();
                element.classList.add(`highlight-${selectedCategories[0]}`);

                // Save correction and explanation to element
                const correctionTextarea = document.getElementById('editCorrection');
                const explanationTextarea = document.getElementById('editExplanation');

                console.log('🔍 Save Debug - Textarea Elements:', {
                    correctionTextarea: correctionTextarea,
                    correctionValue: correctionTextarea?.value,
                    correctionValueLength: correctionTextarea?.value?.length,
                    explanationTextarea: explanationTextarea,
                    explanationValue: explanationTextarea?.value,
                    explanationValueLength: explanationTextarea?.value?.length
                });

                if (correctionTextarea) {
                    element.dataset.correction = correctionTextarea.value;
                    element.dataset.message = correctionTextarea.value; // backwards compatibility
                    console.log('💾 Saved correction:', correctionTextarea.value);
                }
                if (explanationTextarea) {
                    element.dataset.explanation = explanationTextarea.value;
                    element.dataset.notes = explanationTextarea.value || correctionTextarea.value; // backwards compatibility
                    console.log('💾 Saved explanation:', explanationTextarea.value);
                }

                console.log('📦 Final dataset values:', {
                    correction: element.dataset.correction,
                    explanation: element.dataset.explanation,
                    message: element.dataset.message,
                    notes: element.dataset.notes
                });

                // Remove native title tooltip (custom instant tooltip reads data attributes directly)
                element.removeAttribute('title');

                // Update visual styling (pass all categories for multi-error styling)
                console.log('🎨 Updating visual styling to:', selectedCategories);
                if (window.HighlightingModule && window.HighlightingModule.updateHighlightVisualStyling) {
                    window.HighlightingModule.updateHighlightVisualStyling(element, selectedCategories[0], selectedCategories);
                } else {
                    // Direct call as fallback
                    updateHighlightVisualStyling(element, selectedCategories[0], selectedCategories);
                }
                console.log('🎨 Style after update:', element.style.cssText);

                // Propagate to group siblings if this is a grouped highlight
                const groupId = element.dataset.highlightGroup;
                if (groupId) {
                    const siblings = document.querySelectorAll(`mark[data-highlight-group="${groupId}"]`);
                    siblings.forEach(sib => {
                        if (sib === element) return;
                        // Copy data attributes (except originalText which stays per-segment)
                        sib.dataset.category = element.dataset.category;
                        sib.dataset.type = element.dataset.type;
                        sib.dataset.correction = element.dataset.correction || '';
                        sib.dataset.message = element.dataset.message || '';
                        sib.dataset.explanation = element.dataset.explanation || '';
                        sib.dataset.notes = element.dataset.notes || '';
                        if (element.dataset.excludeFromPdf) {
                            sib.dataset.excludeFromPdf = element.dataset.excludeFromPdf;
                        }
                        // Update class and visual styling
                        sib.className = sib.className.replace(/highlight-\w+/g, '').trim();
                        sib.classList.add(`highlight-${selectedCategories[0]}`);
                        sib.removeAttribute('title');
                        updateHighlightVisualStyling(sib, selectedCategories[0], selectedCategories);
                    });
                }

                // Emit event for highlights section to refresh
                if (window.eventBus) {
                    console.log('Emitting highlight:updated event from highlighting.js');
                    window.eventBus.emit('highlight:updated', {
                        element,
                        categories: selectedCategories,
                        correction: element.dataset.correction,
                        explanation: element.dataset.explanation
                    });
                }

                // ── Resize: rebuild DOM boundaries if the user dragged handles ──
                if (modal.dataset.highlightResized === 'true' && _resizeState.container) {
                    console.log('🔄 Rebuilding highlight boundaries after resize');
                    const newMark = rebuildHighlightBoundaries(
                        element,
                        _resizeState.elementStart,
                        _resizeState.elementEnd,
                        _resizeState.container
                    );
                    if (newMark) {
                        // Update the editing reference so subsequent saves reference the new element
                        modal.dataset.editingElement = newMark.id;
                    }
                    modal.dataset.highlightResized = '';
                }

                console.log('✅ Save completed');
            }
            modal.style.display = 'none';

            // Auto-clear selection after saving to prevent accidentally re-opening editor
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            }
            // Also clear category selection state
            if (window.TextSelectionModule && window.TextSelectionModule.clearSelection) {
                window.TextSelectionModule.clearSelection();
            } else if (window.clearSelection) {
                window.clearSelection();
            }
            console.log('🧹 Cleared selection after highlight save');
        });
        saveButton.dataset.simpleHandlerAttached = 'true';
    }

    // Remove button - removes the highlight entirely
    const removeButton = modal.querySelector('.modal-remove-btn');
    if (removeButton && !removeButton.dataset.simpleHandlerAttached) {
        removeButton.addEventListener('click', () => {
            const elementId = modal.dataset.editingElement;
            const element = document.getElementById(elementId);
            if (element) {
                removeHighlight(element);
                console.log('🗑️ Highlight removed');
            }
            modal.style.display = 'none';
        });
        removeButton.dataset.simpleHandlerAttached = 'true';
    }

    // Cancel button - closes without any changes
    const cancelButton = modal.querySelector('.modal-cancel-btn');
    if (cancelButton && !cancelButton.dataset.simpleHandlerAttached) {
        cancelButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        cancelButton.dataset.simpleHandlerAttached = 'true';
    }

    // Show the modal using direct display method (highlighting modal has custom logic)
    console.log('📱 Opening highlight edit modal');
    modal.dataset.modalOpenTime = Date.now().toString();
    modal.style.display = 'block';
    modal.style.zIndex = '1000';

    // Center the highlight and auto-size textareas now that the modal is visible
    requestAnimationFrame(() => {
        const htd = document.getElementById('highlightedTextDisplay');
        const mark = htd && htd.querySelector('mark.resizable-highlight');
        if (htd && mark) {
            const markCenter = mark.offsetLeft + mark.offsetWidth / 2;
            htd.scrollLeft = markCenter - htd.clientWidth / 2;
        }
        // Auto-resize textareas to fit existing content
        [document.getElementById('editCorrection'), document.getElementById('editExplanation')].forEach(ta => {
            if (!ta) return;
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
    });

    // Ensure modal is visible and clickable
    const backdrop = modal.querySelector('.modal-content') || modal;
    if (backdrop) {
        backdrop.style.position = 'relative';
        backdrop.style.zIndex = '1001';
    }

    // Make modal draggable if draggable modal functionality is available
    if (window.DraggableModal && window.DraggableModal.makeDraggable) {
        window.DraggableModal.makeDraggable('editModal');
    }
}

/**
 * Toggle category selection in modal
 * @param {string} category - Category to toggle
 */
function toggleModalCategory(category) {
    const modal = document.getElementById('editModal');
    const selectedCategories = modal.dataset.selectedCategories ? modal.dataset.selectedCategories.split(',').filter(c => c.trim()) : [];

    // Toggle category
    const index = selectedCategories.indexOf(category);
    if (index > -1) {
        selectedCategories.splice(index, 1);
    } else {
        selectedCategories.push(category);
    }

    // Update stored categories
    modal.dataset.selectedCategories = selectedCategories.join(',');

    // Update categories in modal state only - do NOT auto-save or close
    // The user will manually click Save when ready
    console.log('🎯 Category toggled, modal remains open for notes editing');

    // Update button styles
    const categoryBtn = modal.querySelector(`[data-category="${category}"]`);
    if (categoryBtn) {
        const isSelected = selectedCategories.includes(category);
        const categories = [
            { id: 'grammar', color: '#FF8C00' },
            { id: 'vocabulary', color: '#00A36C' },
            { id: 'mechanics', color: '#D3D3D3' },
            { id: 'spelling', color: '#DC143C' },
            { id: 'fluency', color: '#87CEEB' },
            { id: 'delete', color: '#000000' }
        ];

        const categoryData = categories.find(c => c.id === category);
        if (categoryData) {
            const isMechanics = category === 'mechanics';
            const isFluency = category === 'fluency';

            if (isSelected) {
                categoryBtn.style.backgroundColor = categoryData.color;
                categoryBtn.style.color = 'white';
                categoryBtn.classList.add('modal-category-selected');
                // Add checkmark if not present
                if (!categoryBtn.querySelector('.checkmark')) {
                    categoryBtn.style.position = 'relative';
                    categoryBtn.innerHTML += '<span class="checkmark" style="position: absolute; top: -4px; right: -4px; background: #28a745; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">✓</span>';
                }
            } else {
                categoryBtn.style.backgroundColor = (isMechanics || isFluency) ? categoryData.color : 'transparent';
                categoryBtn.style.color = (isMechanics || isFluency) ? 'black' : categoryData.color;
                categoryBtn.classList.remove('modal-category-selected');
                // Remove checkmark if present
                const checkmark = categoryBtn.querySelector('.checkmark');
                if (checkmark) {
                    checkmark.remove();
                }
            }
        }
    }

    // Update the preview highlight color in real-time
    if (_resizeState.element) {
        renderResizePreview();
    }
}

/**
 * Remove highlight from element
 * @param {HTMLElement} element - Highlight element to remove
 */
function removeHighlight(element) {
    if (element && element.parentNode) {
        // If this mark belongs to a group, remove ALL marks in the group
        const groupId = element.dataset.highlightGroup;
        if (groupId) {
            const groupMarks = document.querySelectorAll(`mark[data-highlight-group="${groupId}"]`);
            const fullText = Array.from(groupMarks).map(m => m.textContent).join('\n\n');
            groupMarks.forEach(m => {
                if (m.parentNode) {
                    // Unwrap: move child nodes into parent, preserving nested marks
                    const parent = m.parentNode;
                    while (m.firstChild) {
                        parent.insertBefore(m.firstChild, m);
                    }
                    parent.removeChild(m);
                    parent.normalize();
                }
            });
            if (window.eventBus) {
                window.eventBus.emit('highlight:removed', { element, text: fullText });
            }
            return;
        }

        const parent = element.parentNode;
        const text = element.textContent;

        // Unwrap: move child nodes into parent, preserving nested marks from overlapping highlights
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);

        // Normalize the parent to merge adjacent text nodes
        parent.normalize();

        // Emit event for highlight removal
        if (window.eventBus) {
            window.eventBus.emit('highlight:removed', { element, text });
        }
    }
}

/**
 * Remove highlight from the modal (called by remove button)
 * @deprecated Use ModalManager.removeHighlight() instead
 */
function removeHighlightFromModal() {
    console.warn('removeHighlightFromModal is deprecated. Use ModalManager.removeHighlight() instead.');
    if (window.ModalManager) {
        window.ModalManager.removeHighlight('editHighlight');
    }
}

/**
 * Get all highlights in a container
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight elements
 */
function getAllHighlights(container = document) {
    return Array.from(container.querySelectorAll('mark[data-category]'));
}

/**
 * Get highlights by category
 * @param {string} category - Category to filter by
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight elements
 */
function getHighlightsByCategory(category, container = document) {
    return Array.from(container.querySelectorAll(`mark[data-category="${category}"]`));
}

/**
 * Clear all highlights in a container
 * @param {HTMLElement} container - Container element
 */
function clearAllHighlights(container = document) {
    const highlights = getAllHighlights(container);
    highlights.forEach(highlight => removeHighlight(highlight));
}

/**
 * Migrate legacy highlights to new format
 * @param {HTMLElement} container - Container element
 */
function migrateLegacyHighlights(container = document) {
    // Find existing highlights that might need migration
    const existingHighlights = container.querySelectorAll('mark, span[data-category]');
    existingHighlights.forEach(element => {
        if (!element.dataset.category) {
            // Try to determine category from class name or styling
            const className = element.className;
            const category = mapLegacyCategory(className);
            if (category) {
                element.dataset.category = category;
                updateHighlightVisualStyling(element, category);
            }
        }

        // Ensure click handler is attached (use JS expando, not data attribute)
        if (!element._hasLiveClickListener) {
            element.addEventListener('click', function(e) {
                e.stopPropagation();
                const gid = this.dataset.highlightGroup;
                if (gid) {
                    const primary = document.querySelector(`mark[data-highlight-group="${gid}"]`);
                    editHighlight(primary || this);
                } else {
                    editHighlight(this);
                }
            });
            element._hasLiveClickListener = true;
            element.style.cursor = 'pointer';
        }
    });
}

/**
 * Ensure all highlights in container have click handlers
 * @param {HTMLElement} container - Container element
 */
function ensureHighlightClickHandlers(container = document) {
    const highlights = container.querySelectorAll('mark[data-category], mark.highlight');

    highlights.forEach((highlight, index) => {
        // Ensure highlight has required attributes
        if (!highlight.dataset.category) {
            // Try to extract category from class name
            const classMatch = highlight.className.match(/highlight-(\w+)/);
            if (classMatch) {
                highlight.dataset.category = classMatch[1];
            }
        }

        // Use a JS-only expando (not a data attribute) to track live listeners.
        // data-has-click-listener persists in saved HTML but the actual JS listener
        // is lost on innerHTML restore, so we can't trust the data attribute.
        if (!highlight._hasLiveClickListener) {
            highlight.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                // For grouped highlights, always open modal for the primary mark
                const gid = this.dataset.highlightGroup;
                if (gid) {
                    const primary = document.querySelector(`mark[data-highlight-group="${gid}"]`);
                    editHighlight(primary || this);
                } else {
                    editHighlight(this);
                }
            });
            highlight._hasLiveClickListener = true;
            highlight.style.cursor = 'pointer';
        }
        // Strip native title tooltip (custom instant tooltip reads data attributes)
        if (highlight.hasAttribute('title')) highlight.removeAttribute('title');
    });
}

/**
 * Map legacy category names to current format
 * @param {string} oldCategory - Old category name or class
 * @returns {string} New category name
 */
function mapLegacyCategory(oldCategory) {
    const mapping = {
        'highlight-grammar': 'grammar',
        'highlight-vocabulary': 'vocabulary',
        'highlight-mechanics': 'mechanics',
        'highlight-spelling': 'spelling',
        'highlight-fluency': 'fluency',
        'highlight-delete': 'delete',
        // Add more mappings as needed
    };
    return mapping[oldCategory] || oldCategory;
}

/**
 * Export highlights data for saving/loading
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight data objects
 */
function exportHighlightsData(container = document) {
    const highlights = getAllHighlights(container);
    return highlights.map(highlight => ({
        id: highlight.id,
        category: highlight.dataset.category,
        originalText: highlight.dataset.originalText,
        notes: highlight.dataset.notes || '',
        position: getElementTextPosition(highlight)
    }));
}

/**
 * Import highlights data and apply to text
 * @param {Array} highlightsData - Array of highlight data objects
 * @param {HTMLElement} container - Container element
 */
function importHighlightsData(highlightsData, container = document) {
    highlightsData.forEach(data => {
        // Implementation would need to find text positions and apply highlights
        // This is complex and would require text range calculation
        console.log('Importing highlight:', data);
    });
}

/**
 * Get text position of an element within its container
 * @param {HTMLElement} element - Element to get position for
 * @returns {Object} Position object with start and end offsets
 */
function getElementTextPosition(element) {
    const container = element.closest('.formatted-essay-content');
    if (!container) return null;

    const range = document.createRange();
    range.selectNodeContents(container);

    const preCaretRange = range.cloneRange();
    preCaretRange.setEnd(element, 0);
    const start = preCaretRange.toString().length;

    const elementRange = range.cloneRange();
    elementRange.selectNodeContents(element);
    const end = start + elementRange.toString().length;

    return { start, end };
}

// Export functions for module usage
// ── Delegated click handler (safety net for highlights that lost their listeners) ──
// This catches clicks on ANY mark element with data-category, even if the
// direct addEventListener was lost during innerHTML save/restore cycles.
document.addEventListener('click', function(e) {
    if (!e.target || !e.target.closest) return;
    const mark = e.target.closest('mark[data-category], mark[class*="highlight"]');
    if (!mark) return;
    // Only handle clicks inside essay containers, not inside the edit modal preview
    if (mark.closest('#editModal')) return;
    if (!mark.closest('.formatted-essay-content')) return;
    e.stopPropagation();
    e.preventDefault();
    // For grouped highlights, always open modal for the primary (first) mark
    const groupId = mark.dataset.highlightGroup;
    if (groupId) {
        const primary = document.querySelector(`mark[data-highlight-group="${groupId}"]`);
        editHighlight(primary || mark);
    } else {
        editHighlight(mark);
    }
}, true);

window.HighlightingModule = {
    applyHighlight,
    applyHighlightAcrossBlocks,
    applyBatchHighlight,
    updateHighlightVisualStyling,
    editHighlight,
    editBatchHighlight,
    showHighlightEditModal,
    removeHighlight,
    removeHighlightFromModal,
    toggleModalCategory,
    getAllHighlights,
    getHighlightsByCategory,
    clearAllHighlights,
    migrateLegacyHighlights,
    ensureHighlightClickHandlers,
    mapLegacyCategory,
    exportHighlightsData,
    importHighlightsData,
    getElementTextPosition,
    renderResizePreview,
    rebuildHighlightBoundaries
};