// Embedded rubric data - no file dependencies!
const rubric = {
  "categories": {
    "grammar": {
      "id": "grammar",
      "name": "Grammar", 
      "color": "#FF6B6B",
      "backgroundColor": "#FFE5E5",
      "weight": 15
    },
    "vocabulary": {
      "id": "vocabulary",
      "name": "Vocabulary",
      "color": "#4ECDC4", 
      "backgroundColor": "#E8F8F7",
      "weight": 15
    },
    "spelling": {
      "id": "spelling",
      "name": "Spelling",
      "color": "#45B7D1",
      "backgroundColor": "#E3F2FD", 
      "weight": 10
    },
    "mechanics": {
      "id": "mechanics",
      "name": "Mechanics & Punctuation",
      "color": "#F7B731",
      "backgroundColor": "#FFF8E1",
      "weight": 15
    },
    "fluency": {
      "id": "fluency", 
      "name": "Fluency",
      "color": "#A855F7",
      "backgroundColor": "#F3E8FF",
      "weight": 15
    },
    "layout": {
      "id": "layout",
      "name": "Layout & Follow Specs", 
      "color": "#16A34A",
      "backgroundColor": "#DCFCE7",
      "weight": 15
    },
    "content": {
      "id": "content",
      "name": "Content & Information",
      "color": "#DC2626", 
      "backgroundColor": "#FEE2E2",
      "weight": 15
    }
  }
};

// Simplified color mapping for highlighting
const correctionGuideColors = {
  'grammar': { color: '#FF8C00', backgroundColor: 'transparent', name: 'Grammar' }, // Orange text
  'vocabulary': { color: '#00A36C', backgroundColor: 'transparent', name: 'Vocabulary' }, // Green text
  'mechanics': { color: '#000000', backgroundColor: '#D3D3D3', name: 'Mechanics' }, // Gray highlight
  'mechanics-punctuation': { color: '#000000', backgroundColor: '#D3D3D3', name: 'Mechanics' }, // Gray highlight
  'spelling': { color: '#DC143C', backgroundColor: 'transparent', name: 'Spelling' }, // Red text
  'fluency': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'needs-rephrasing': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'redundancy': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'non-suitable-words': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'professor-comments': { color: '#000000', backgroundColor: '#FACC15', name: "Comments" },
  'delete': { color: '#000000', backgroundColor: 'transparent', name: 'Delete', strikethrough: true } // Black strikethrough
};

export function formatGradedEssay(studentText, gradingResults, options = {}) {
  console.log('\n🎨 FORMATTER CALLED');
  console.log(`Student text length: ${studentText.length}`);
  console.log(`Number of inline issues: ${(gradingResults.inline_issues || []).length}`);
  
  const { meta, scores, total, inline_issues, teacher_notes, encouragement_next_steps } = gradingResults;

  // Normalize text and fix offsets ONCE to ensure consistency
  const normalizedText = studentText.normalize('NFC');
  const correctedIssues = findActualOffsets(normalizedText, inline_issues || []);

  // Build formatted text using corrected issues
  const formattedText = renderWithOffsets(normalizedText, correctedIssues, options);

  // Generate feedback summary with new format
  const feedbackHtml = generateFeedbackSummary(scores, total, meta, teacher_notes, encouragement_next_steps, options);

  return {
    formattedText: formattedText,
    feedbackSummary: feedbackHtml,
    errors: correctedIssues, // Use corrected issues, not original
    overallScore: total?.points || 0,
    segments: options.editable ? buildSegments(normalizedText, correctedIssues) : null
  };
}

function renderWithOffsets(studentText, inlineIssues, options = {}) {
  if (!inlineIssues || inlineIssues.length === 0) {
    const formattedText = options.editable ? 
      `<span class="text-segment" data-segment-id="0">${escapeHtmlWithFormatting(studentText)}</span>` :
      escapeHtmlWithFormatting(studentText);
    
    // Wrap in paragraph tags if needed
    if (formattedText.includes('</p><p>')) {
      return '<p>' + formattedText + '</p>';
    }
    return formattedText;
  }

  // Normalize essay to NFC (do not change whitespace or line breaks)
  const normalizedText = studentText.normalize('NFC');
  
  // Fix GPT's broken offsets by finding the actual text
  const correctedIssues = findActualOffsets(normalizedText, inlineIssues);
  
  // Sort issues by start ASC, end DESC
  const sortedIssues = [...correctedIssues].sort((a, b) => {
    if (a.offsets.start !== b.offsets.start) {
      return a.offsets.start - b.offsets.start;
    }
    return b.offsets.end - a.offsets.end;
  });

  // Resolve overlaps with fixed priority: grammar > mechanics-punctuation > spelling > vocab-structure > etc.
  const priorityOrder = [
    'grammar',
    'mechanics-punctuation', 
    'spelling',
    'vocabulary-structure',
    'needs-rephrasing',
    'redundancy',
    'non-suitable-words',
    'fluency',
    'professor-comments'
  ];
  const resolvedIssues = resolveOverlapsFixed(sortedIssues, priorityOrder);

  // Build segments by slicing original string exactly once
  const segments = buildSegments(normalizedText, resolvedIssues);
  
  // Merge adjacent segments of same type
  const mergedSegments = mergeAdjacentSegments(segments);

  // Render to HTML with proper escaping
  return renderSegmentsToHTML(mergedSegments, options);
}

function findActualOffsets(text, issues) {
  return issues.map(issue => {
    // FIRST: If we have a quote field, use that instead of trusting AI offsets
    if (issue.quote && issue.quote.trim().length > 0) {
      const searchText = issue.quote.trim();
      const issueDesc = issue.message || issue.correction || issue.text;
      console.log(`\n[OFFSET DEBUG] Processing issue: "${issueDesc}"`);
      console.log(`[OFFSET DEBUG] Looking for quote: "${searchText}"`);
      console.log(`[OFFSET DEBUG] AI provided offsets: ${issue.offsets?.start}-${issue.offsets?.end}`);
      if (issue.offsets?.start !== undefined && issue.offsets?.end !== undefined) {
        const aiText = text.substring(issue.offsets.start, issue.offsets.end);
        console.log(`[OFFSET DEBUG] AI offset points to: "${aiText}"`);
      }
      
      // Try exact match first
      let index = text.indexOf(searchText);
      if (index !== -1) {
        console.log(`[OFFSET DEBUG] Found exact quote match at ${index}-${index + searchText.length}`);
        return {
          ...issue,
          offsets: { start: index, end: index + searchText.length }
        };
      } else {
        // Try case-insensitive match
        const lowerText = text.toLowerCase();
        const lowerSearch = searchText.toLowerCase();
        index = lowerText.indexOf(lowerSearch);
        if (index !== -1) {
          console.log(`[OFFSET DEBUG] Found case-insensitive quote match at ${index}-${index + searchText.length}`);
          return {
            ...issue,
            offsets: { start: index, end: index + searchText.length }
          };
        }
        console.log(`[OFFSET DEBUG] Quote not found: "${searchText}"`);
        console.log(`[OFFSET DEBUG] Text preview: "${text.substring(0, 100)}..."`);
      }
    }
    
    // SECOND: Try to use model-provided offsets (only if no quote or quote not found)
    if (issue.offsets && 
        typeof issue.offsets.start === 'number' && 
        typeof issue.offsets.end === 'number' &&
        issue.offsets.start >= 0 && 
        issue.offsets.end <= text.length &&
        issue.offsets.start <= issue.offsets.end) {
      console.log(`Using model offsets: ${issue.offsets.start}-${issue.offsets.end}`);
      return issue; // Use as-is
    }
    
    // Handle comma/period suggestions with caret markers (don't skip them)
    const issueDesc = issue.message || `${issue.text} → ${issue.correction}`;
    if ((issue.type === 'mechanics-punctuation' || issue.type === 'mechanics') && 
        (issueDesc.includes('Add comma') || issueDesc.includes('Add period'))) {
      console.log(`Creating caret marker for: "${issueDesc}"`);
      // Create zero-width span at the position where punctuation should be added
      const caretPosition = issue.offsets?.start || 0;
      return {
        ...issue,
        offsets: { start: caretPosition, end: caretPosition },
        isCaretMarker: true // Flag for special rendering
      };
    }
    
    // UPDATED: Use new unified data structure (text, correction, explanation)
    let originalText;
    if (issue.message) {
      // Legacy format: "original → corrected" - extract just corrected text
      const messageParts = issue.message.split('→');
      originalText = messageParts[0].trim();
    } else {
      // New unified format: separate text field
      originalText = issue.text;
    }
    
    // Don't strip articles - keep original phrase intact for search
    console.log(`Looking for: "${originalText}" in text`);
    
    // Skip only if clearly just an instruction without searchable text
    if (originalText.length < 1 || 
        originalText.toLowerCase().startsWith('add ') || 
        originalText.toLowerCase().startsWith('use ') ||
        originalText.toLowerCase().startsWith('change ')) {
      console.log(`Skipping instruction: "${originalText}"`);
      return null;
    }
    
    // Find the actual position of this text with intelligent word boundary detection
    let bestMatch = null;

    // Strategy 1: Try exact word boundary match first (for complete words)
    if (!originalText.includes(' ') && originalText.length > 0) {
      const escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'i');
      const match = text.match(wordBoundaryRegex);
      if (match) {
        const index = text.search(wordBoundaryRegex);
        bestMatch = { start: index, end: index + match[0].length };
        console.log(`Found complete word boundary match at ${index}-${index + match[0].length}: "${match[0]}"`);
      }
    }

    // Strategy 2: If no complete word match, check if this is a partial word that needs expansion
    if (!bestMatch && !originalText.includes(' ') && originalText.length > 1) {
      const partialMatches = [];
      const lowerText = text.toLowerCase();
      const lowerOriginal = originalText.toLowerCase();

      // Find all occurrences of the partial text
      let searchIndex = 0;
      while (true) {
        const index = lowerText.indexOf(lowerOriginal, searchIndex);
        if (index === -1) break;

        // Check if this is part of a larger word
        const charBefore = index > 0 ? text[index - 1] : ' ';
        const charAfter = index + originalText.length < text.length ? text[index + originalText.length] : ' ';

        if (/\w/.test(charBefore) || /\w/.test(charAfter)) {
          // This is part of a larger word - find the complete word
          const wordStart = text.lastIndexOf(' ', index) + 1;
          const wordEndSpace = text.indexOf(' ', index + originalText.length);
          const wordEnd = wordEndSpace === -1 ? text.length : wordEndSpace;
          const completeWord = text.substring(wordStart, wordEnd).replace(/[^\w]/g, '');

          partialMatches.push({
            start: wordStart,
            end: wordEnd,
            completeWord: completeWord,
            originalIndex: index
          });

          console.log(`Found "${originalText}" as part of word "${completeWord}" at ${wordStart}-${wordEnd}`);
        }

        searchIndex = index + 1;
      }

      // If we found partial matches, choose the most appropriate one
      if (partialMatches.length > 0) {
        // Prefer the match where the partial text is at the beginning or end of the word
        const preferredMatch = partialMatches.find(match => {
          const wordStart = match.start;
          const relativeIndex = match.originalIndex - wordStart;
          const wordLength = match.completeWord.length;
          const partialLength = originalText.length;

          // Prefer if partial text is at start or end of word
          return relativeIndex === 0 || relativeIndex + partialLength === wordLength;
        }) || partialMatches[0]; // Fallback to first match

        bestMatch = {
          start: preferredMatch.start,
          end: preferredMatch.end,
          _expandedFromPartial: true,
          _originalPartial: originalText,
          _expandedWord: preferredMatch.completeWord
        };
        console.log(`Expanded partial word "${originalText}" to complete word "${preferredMatch.completeWord}" at ${preferredMatch.start}-${preferredMatch.end}`);
      }
    }

    // Strategy 3: Fall back to exact string search if no smart matching worked
    if (!bestMatch) {
      let index = text.indexOf(originalText);
      if (index !== -1) {
        bestMatch = { start: index, end: index + originalText.length };
        console.log(`Found exact string match at ${index}-${index + originalText.length}`);
      } else {
        // Try case-insensitive match
        const lowerText = text.toLowerCase();
        const lowerOriginal = originalText.toLowerCase();
        index = lowerText.indexOf(lowerOriginal);
        if (index !== -1) {
          bestMatch = { start: index, end: index + originalText.length };
          console.log(`Found case-insensitive match at ${index}-${index + originalText.length}`);
        } else {
          console.log(`No match found for "${originalText}"`);
          return null; // Skip if we can't find it
        }
      }
    }
    
    // Return the corrected issue
    return {
      ...issue,
      offsets: bestMatch
    };
  }).filter(issue => issue !== null); // Remove null entries
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function resolveOverlapsFixed(issues, priorityOrder) {
  const resolved = [];

  // First, remove exact duplicates (same offsets AND same category)
  const uniqueIssues = [];
  const seenKeys = new Set();

  for (const issue of issues) {
    const issueCategory = issue.category || issue.type || 'unknown';
    const offsetKey = `${issue.offsets.start}-${issue.offsets.end}-${issueCategory}`;

    if (!seenKeys.has(offsetKey)) {
      seenKeys.add(offsetKey);
      uniqueIssues.push(issue);
    } else {
      const issueDesc = issue.message || issue.correction || issue.text;
      console.log(`Removing exact duplicate: ${offsetKey} - ${issueDesc}`);
    }
  }

  // Enable overlapping highlights for compound errors
  for (const current of uniqueIssues) {
    let shouldAdd = true;
    const currentCategory = current.category || current.type || 'unknown';

    // Check against all issues already added
    for (const existing of resolved) {
      if (overlaps(current.offsets, existing.offsets)) {
        const existingCategory = existing.category || existing.type || 'unknown';

        // ALLOW overlapping highlights for different categories (compound errors)
        if (currentCategory !== existingCategory) {
          console.log(`✅ Allowing overlapping compound error: ${currentCategory} + ${existingCategory}`);
          continue; // Skip conflict resolution, allow both
        }

        // For SAME categories, apply priority resolution
        const currentPriority = priorityOrder.indexOf(currentCategory);
        const existingPriority = priorityOrder.indexOf(existingCategory);

        // If existing has higher priority (lower index), drop current
        if (existingPriority >= 0 && (currentPriority < 0 || existingPriority < currentPriority)) {
          console.log(`Dropping lower priority same-category overlap: ${current.message}`);
          shouldAdd = false;
          break;
        }
        // If current has higher priority, remove existing and add current
        else if (currentPriority >= 0 && currentPriority < existingPriority) {
          console.log(`Replacing lower priority same-category issue: ${existing.message} with ${current.message}`);
          const index = resolved.indexOf(existing);
          resolved.splice(index, 1);
        }
        // If same priority and same category, keep the first one
        else if (currentPriority === existingPriority) {
          console.log(`Same priority same-category overlap, keeping first: ${existing.message}`);
          shouldAdd = false;
          break;
        }
      }
    }

    if (shouldAdd) {
      resolved.push(current);
    }
  }

  // Sort by start position, then by priority for overlapping highlights
  return resolved.sort((a, b) => {
    if (a.offsets.start !== b.offsets.start) {
      return a.offsets.start - b.offsets.start;
    }
    // For same start position, sort by priority (higher priority first for nesting)
    const aPriority = priorityOrder.indexOf(a.category || a.type || '');
    const bPriority = priorityOrder.indexOf(b.category || b.type || '');
    return (aPriority >= 0 ? aPriority : 999) - (bPriority >= 0 ? bPriority : 999);
  });
}

function overlaps(range1, range2) {
  return range1.start < range2.end && range1.end > range2.start;
}

function buildSegments(text, issues) {
  // Handle overlapping highlights by creating a more sophisticated segmentation
  if (hasOverlappingIssues(issues)) {
    return buildOverlappingSegments(text, issues);
  }

  // Original non-overlapping logic for backward compatibility
  const segments = [];
  let cursor = 0;

  for (const issue of issues) {
    // Add normal text before this issue
    if (cursor < issue.offsets.start) {
      segments.push({
        type: 'normal',
        text: text.slice(cursor, issue.offsets.start)
      });
    }

    // Handle caret markers (zero-width spans)
    if (issue.isCaretMarker) {
      segments.push({
        type: 'caret',
        text: '', // Zero-width
        issue: issue
      });
      // Don't advance cursor for zero-width markers
    } else {
      // Add regular issue segment
      segments.push({
        type: 'issue',
        text: text.slice(issue.offsets.start, issue.offsets.end),
        issue: issue
      });
      cursor = issue.offsets.end;
    }
  }

  // Add remaining normal text
  if (cursor < text.length) {
    segments.push({
      type: 'normal',
      text: text.slice(cursor)
    });
  }

  return segments;
}

function hasOverlappingIssues(issues) {
  for (let i = 0; i < issues.length; i++) {
    for (let j = i + 1; j < issues.length; j++) {
      if (overlaps(issues[i].offsets, issues[j].offsets)) {
        return true;
      }
    }
  }
  return false;
}

function buildOverlappingSegments(text, issues) {
  console.log('🔄 Building overlapping segments for compound errors');

  // Get all unique positions (start and end points)
  const positions = new Set([0, text.length]);

  for (const issue of issues) {
    if (issue.isCaretMarker) continue; // Skip caret markers for position calculation
    positions.add(issue.offsets.start);
    positions.add(issue.offsets.end);
  }

  const sortedPositions = Array.from(positions).sort((a, b) => a - b);
  const segments = [];

  // Build segments for each position range
  for (let i = 0; i < sortedPositions.length - 1; i++) {
    const start = sortedPositions[i];
    const end = sortedPositions[i + 1];
    const segmentText = text.slice(start, end);

    // Find all issues that cover this segment
    const coveringIssues = issues.filter(issue => {
      if (issue.isCaretMarker) return false;
      return issue.offsets.start <= start && issue.offsets.end >= end;
    });

    // Handle caret markers at this position
    const caretIssues = issues.filter(issue => issue.isCaretMarker && issue.offsets.start === start);

    // Add caret markers first (they're zero-width)
    for (const caretIssue of caretIssues) {
      segments.push({
        type: 'caret',
        text: '',
        issue: caretIssue
      });
    }

    // Add the text segment with its covering issues
    if (coveringIssues.length === 0) {
      // Normal text with no issues
      segments.push({
        type: 'normal',
        text: segmentText
      });
    } else if (coveringIssues.length === 1) {
      // Single issue covering this segment
      segments.push({
        type: 'issue',
        text: segmentText,
        issue: coveringIssues[0]
      });
    } else {
      // Multiple overlapping issues - create nested structure
      segments.push({
        type: 'overlapping',
        text: segmentText,
        issues: coveringIssues,
        primaryIssue: coveringIssues[0] // Use first (highest priority) as primary
      });
    }
  }

  return segments;
}

function mergeAdjacentSegments(segments) {
  const merged = [];
  
  for (const segment of segments) {
    const lastSegment = merged[merged.length - 1];
    
    // Merge with previous if same type and adjacent
    if (lastSegment && 
        lastSegment.type === segment.type && 
        lastSegment.type === 'normal') {
      lastSegment.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  
  return merged;
}

function renderSegmentsToHTML(segments, options = {}) {
  const { editable = false } = options;

  const htmlContent = segments.map((segment, index) => {
    if (segment.type === 'normal') {
      return editable ?
        `<span class="text-segment" data-segment-id="${index}">${escapeHtmlWithFormatting(segment.text)}</span>` :
        escapeHtmlWithFormatting(segment.text);
    } else if (segment.type === 'caret') {
      // Render caret marker for comma/period suggestions
      const issueDesc = segment.issue.message || segment.issue.correction || segment.issue.text;
      return `<span class="caret-marker"
                   data-type="${escapeHtml(segment.issue.category || segment.issue.type || '')}"
                   data-message="${escapeHtml(issueDesc)}"
                   title="${escapeHtml(issueDesc)}"
                   style="color: #DC143C; font-weight: bold; position: relative;">▿</span>`;
    } else if (segment.type === 'overlapping') {
      // Handle overlapping compound errors with nested highlights
      console.log(`🎨 Rendering overlapping segment with ${segment.issues.length} issues:`,
                  segment.issues.map(i => i.category || i.type).join(' + '));

      return renderNestedHighlights(segment.text, segment.issues, index, editable);
    } else {
      // Regular single issue segment
      return renderSingleHighlight(segment.issue, segment.text, index, editable);
    }
  }).join('');

  // Wrap content in paragraph tags if it contains paragraph breaks
  if (htmlContent.includes('</p><p>')) {
    return '<p>' + htmlContent + '</p>';
  }

  return htmlContent;
}

function renderNestedHighlights(text, issues, segmentIndex, editable) {
  // Sort issues by priority (highest priority becomes outermost highlight)
  const priorityOrder = [
    'grammar',
    'mechanics-punctuation',
    'spelling',
    'vocabulary-structure',
    'needs-rephrasing',
    'redundancy',
    'non-suitable-words',
    'fluency',
    'professor-comments'
  ];

  const sortedIssues = [...issues].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.category || a.type || '');
    const bPriority = priorityOrder.indexOf(b.category || b.type || '');
    return (aPriority >= 0 ? aPriority : 999) - (bPriority >= 0 ? bPriority : 999);
  });

  // Build nested HTML structure from outside to inside
  let html = escapeHtmlWithFormatting(text);

  // Apply highlights from lowest priority to highest (inside-out)
  for (let i = sortedIssues.length - 1; i >= 0; i--) {
    const issue = sortedIssues[i];
    const issueCategory = issue.category || issue.type || '';
    const correctionInfo = correctionGuideColors[issueCategory];
    const categoryInfo = correctionInfo || rubric.categories[issueCategory];

    // Create nested mark element
    const color = categoryInfo?.color || '#666';
    const bgColor = categoryInfo?.backgroundColor || '#f5f5f5';
    const textDecoration = categoryInfo?.textDecoration || 'none';

    const editableAttrs = editable ?
      `data-segment-id="${segmentIndex}-${i}" data-editable="true" class="highlighted-segment"` : '';

    // Build style string with conditional properties
    let styleProps = `color: ${color}; text-decoration: ${textDecoration}; position: relative;`;
    if (bgColor && bgColor !== 'transparent') {
      styleProps += ` background: ${bgColor}; padding: 2px 4px; border-radius: 2px; margin: 1px;`;
    }

    // Special styling adjustments for nested highlights
    if (i > 0) {
      // Inner highlights get slightly different styling to be visible
      styleProps += ` box-shadow: inset 0 0 0 1px ${color}; opacity: 0.9;`;
    }

    // Special styling for delete category (strikethrough)
    if (issueCategory === 'delete') {
      styleProps = `color: #000000; text-decoration: line-through; position: relative; font-weight: bold;`;
    }
    // Special styling for coaching-only fluency suggestions
    else if (issue.coaching_only && issueCategory === 'fluency') {
      styleProps = `color: #A855F7; text-decoration: underline dotted; position: relative; opacity: 0.8;`;
    }

    const issueDesc = issue.message || issue.correction || issue.text;
    const coachingAttr = issue.coaching_only ? 'data-coaching-only="true"' : '';

    // Build tooltip showing both correction and explanation
    const correction = issue.correction || issueDesc || '';
    const explanation = issue.explanation || '';
    let tooltip = '';
    tooltip += `Correction: ${correction || 'None'}`;
    if (explanation) {
      tooltip += `\nExplanation: ${explanation}`;
    } else {
      tooltip += `\nExplanation: None`;
    }

    // Keep old notes for backwards compatibility
    let notes = '';
    if (issue.explanation) {
      notes = issue.explanation;
    } else if (issue.notes) {
      notes = issue.notes;
    } else {
      notes = issueDesc || '';
    }

    html = `<mark class="highlight-${issueCategory} highlight nested-highlight"
                 data-type="${escapeHtml(issueCategory)}"
                 data-category="${escapeHtml(issueCategory)}"
                 data-correction="${escapeHtml(correction)}"
                 data-explanation="${escapeHtml(explanation)}"
                 data-message="${escapeHtml(issueDesc)}"
                 data-notes="${escapeHtml(notes)}"
                 data-original-text="${escapeHtml(text)}"
                 data-nesting-level="${i}"
                 ${coachingAttr}
                 ${editableAttrs}
                 style="${styleProps}; cursor: pointer;"
                 title="${escapeHtml(tooltip)}">
              ${html}
            </mark>`;
  }

  return html;
}

function renderSingleHighlight(issue, text, segmentIndex, editable) {
  // Use correction guide colors for inline_issues, fallback to rubric colors
  const issueCategory = issue.category || issue.type || '';
  const correctionInfo = correctionGuideColors[issueCategory];
  const categoryInfo = correctionInfo || rubric.categories[issueCategory];
  const color = categoryInfo?.color || '#666';
  const bgColor = categoryInfo?.backgroundColor || '#f5f5f5';
  const textDecoration = categoryInfo?.textDecoration || 'none';
  const categoryName = categoryInfo?.name || issueCategory;

  const editableAttrs = editable ?
    `data-segment-id="${segmentIndex}" data-editable="true" class="highlighted-segment"` : '';

  // Build style string with conditional properties
  let styleProps = `color: ${color}; text-decoration: ${textDecoration}; position: relative;`;
  if (bgColor && bgColor !== 'transparent') {
    styleProps += ` background: ${bgColor}; padding: 2px 4px; border-radius: 2px;`;
  }

  // Special styling for delete category (strikethrough)
  if (issueCategory === 'delete') {
    styleProps = `color: #000000; text-decoration: line-through; position: relative; font-weight: bold;`;
  }
  // Special styling for coaching-only fluency suggestions
  else if (issue.coaching_only && issueCategory === 'fluency') {
    styleProps = `color: #A855F7; text-decoration: underline dotted; position: relative; opacity: 0.8;`;
  }

  const issueDesc = issue.message || issue.correction || issue.text;
  const coachingAttr = issue.coaching_only ? 'data-coaching-only="true"' : '';

  // Build tooltip showing both correction and explanation
  const correction = issue.correction || issueDesc || '';
  const explanation = issue.explanation || '';
  let tooltip = '';
  tooltip += `Correction: ${correction || 'None'}`;
  if (explanation) {
    tooltip += `\nExplanation: ${explanation}`;
  } else {
    tooltip += `\nExplanation: None`;
  }

  // Keep old notes for backwards compatibility
  let notes = '';
  if (issue.explanation) {
    notes = issue.explanation;
  } else if (issue.notes) {
    notes = issue.notes;
  } else {
    notes = issueDesc || '';
  }

  return `<mark class="highlight-${issueCategory} highlight"
               data-type="${escapeHtml(issueCategory)}"
               data-category="${escapeHtml(issueCategory)}"
               data-correction="${escapeHtml(correction)}"
               data-explanation="${escapeHtml(explanation)}"
               data-message="${escapeHtml(issueDesc)}"
               data-notes="${escapeHtml(notes)}"
               data-original-text="${escapeHtml(text)}"
               ${coachingAttr}
               ${editableAttrs}
               style="${styleProps}; cursor: pointer;"
               title="${escapeHtml(tooltip)}">
            ${escapeHtmlWithFormatting(text)}
          </mark>`;
}


function generateFeedbackSummary(scores, total, meta, teacherNotes, encouragementSteps, options = {}) {
  const { editable = true } = options;
  const scoreColor = getScoreColor(total?.points || 0);
  
  let html = `
    <div class="grading-summary">
      <div class="overall-score" style="color: ${scoreColor}; font-size: 2em; font-weight: bold; text-align: center; margin: 20px 0;">
        ${total?.points || 0}/${total?.out_of || 100}
      </div>
      
      <div class="teacher-notes editable-section" style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; cursor: pointer; border: 2px solid transparent;" onclick="editTeacherNotes(this)" title="Click to edit teacher notes" data-teacher-notes="${escapeHtml(teacherNotes || '')}">
        <strong class="teacher-notes-label">📝 Teacher Notes:</strong> 
        <span class="teacher-notes-content">${escapeHtml(teacherNotes || 'Click to add teacher notes')}</span>
        <span class="edit-indicator" style="font-size: 10px; margin-left: 5px; color: #666;">✎</span>
      </div>
      
      <div class="stats-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
        <div class="editable-stat" style="padding: 10px; background: #e3f2fd; border-radius: 4px; text-align: center; cursor: pointer; border: 2px solid transparent;" onclick="editStat(this, 'word_count')" title="Click to edit">
          <strong>📊 Word Count</strong><br>
          <span class="stat-value" style="font-size: 1.2em; color: #1976D2;">${meta?.word_count || 'Not counted'}</span>
          <span class="edit-indicator" style="font-size: 10px; margin-left: 2px; color: #666;">✎</span>
        </div>
        <div class="editable-stat" style="padding: 10px; background: #f3e5f5; border-radius: 4px; text-align: center; cursor: pointer; border: 2px solid transparent;" onclick="editTransitions(this)" title="Click to edit">
          <strong>🔗 Transitions</strong><br>
          <span class="stat-value" style="font-size: 1.2em; color: #7B1FA2;">${(meta?.transition_words_found || []).length} found</span>
          <span class="edit-indicator" style="font-size: 10px; margin-left: 2px; color: #666;">✎</span>
          ${(meta?.transition_words_found || []).length > 0 ? `<br><small class="stat-detail">(${(meta.transition_words_found).join(', ')})</small>` : ''}
        </div>
        <div class="editable-stat" style="padding: 10px; background: #e8f5e8; border-radius: 4px; text-align: center; cursor: pointer; border: 2px solid transparent;" onclick="editVocabulary(this)" title="Click to edit">
          <strong>📚 Class Vocabulary</strong><br>
          <span class="stat-value" style="font-size: 1.2em; color: #388E3C;">
            ${Array.isArray(meta?.class_vocabulary_used) ? meta.class_vocabulary_used.length + ' used' : (meta?.class_vocabulary_used || 'N/A')}
          </span>
          <span class="edit-indicator" style="font-size: 10px; margin-left: 2px; color: #666;">✎</span>
          ${Array.isArray(meta?.class_vocabulary_used) && meta.class_vocabulary_used.length > 0 ? `<br><small class="stat-detail">(${meta.class_vocabulary_used.join(', ')})</small>` : ''}
        </div>
        <div class="editable-stat" style="padding: 10px; background: #fff3e0; border-radius: 4px; text-align: center; cursor: pointer; border: 2px solid transparent;" onclick="editGrammar(this)" title="Click to edit">
          <strong>📖 Grammar</strong><br>
          <span class="stat-value" style="font-size: 1.2em; color: #F57C00;">
            ${Array.isArray(meta?.grammar_structures_used) ? meta.grammar_structures_used.length + ' structures' : (meta?.grammar_structures_used || 'N/A')}
          </span>
          <span class="edit-indicator" style="font-size: 10px; margin-left: 2px; color: #666;">✎</span>
          ${Array.isArray(meta?.grammar_structures_used) && meta.grammar_structures_used.length > 0 ? `<br><small class="stat-detail">(${meta.grammar_structures_used.slice(0,2).join(', ')}${meta.grammar_structures_used.length > 2 ? '...' : ''})</small>` : ''}
        </div>
      </div>
      
      <div class="category-breakdown">
        <h3>Category Breakdown:</h3>`;
  
  Object.entries(scores || {}).forEach(([category, details]) => {
    const categoryInfo = rubric.categories[category];
    if (!categoryInfo || !details) return;
    
    const percentage = Math.round((details.points / details.out_of) * 100);
    const categoryColor = getScoreColor(percentage);
    
    if (editable) {
      html += `
        <div class="category-feedback" style="margin: 15px 0; padding: 15px;
             border-left: 4px solid ${categoryInfo.color};
             background: ${categoryInfo.backgroundColor};
             border-radius: 0 8px 8px 0;"
             data-category="${category}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
            <strong style="color: ${categoryInfo.color}; font-size: 1.1em; white-space: nowrap; padding-top: 8px;">
              ${categoryInfo.name}
            </strong>
            <div style="flex: 1; background: white; padding: 10px; border-radius: 4px;">
              <textarea class="editable-feedback"
                        data-category="${category}"
                        placeholder="Click to add notes (optional)..."
                        rows="1"
                        style="width: 100%; min-height: 32px; border: 1px solid #ddd; border-radius: 3px; padding: 8px; resize: vertical; font-family: inherit; line-height: 1.4; overflow-y: hidden;">${escapeHtml(details.rationale || '')}</textarea>
            </div>
            <div style="display: flex; align-items: center; gap: 5px; position: relative; white-space: nowrap;">
              <div class="score-input-container" style="position: relative;">
                <input type="number"
                       class="editable-score"
                       data-category="${category}"
                       value="${details.points}"
                       min="0"
                       max="${details.out_of}"
                       style="width: 80px; height: 40px; padding: 8px 30px 8px 8px; border: 2px solid #ddd; border-radius: 6px; text-align: center; font-weight: bold; font-size: 1.2em; color: ${categoryColor};">

                <!-- Large clickable areas for increment/decrement - 50/50 split -->
                <div class="arrow-up-area" data-action="increment" style="position: absolute; top: 0; right: 0; width: 35px; height: 50%; cursor: pointer; z-index: 10; background: transparent;"></div>
                <div class="arrow-down-area" data-action="decrement" style="position: absolute; bottom: 0; right: 0; width: 35px; height: 50%; cursor: pointer; z-index: 10; background: transparent;"></div>
              </div>
              <span style="color: ${categoryColor}; font-weight: bold; font-size: 1.2em;">/${details.out_of}</span>
            </div>
          </div>
        </div>`;
    } else {
      html += `
        <div class="category-feedback" style="margin: 15px 0; padding: 15px; 
             border-left: 4px solid ${categoryInfo.color}; 
             background: ${categoryInfo.backgroundColor}; 
             border-radius: 0 8px 8px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: ${categoryInfo.color}; font-size: 1.1em;">
              ${categoryInfo.name}
            </strong>
            <span class="editable-stat-score" style="color: ${categoryColor}; font-weight: bold; font-size: 1.2em; cursor: pointer; border: 2px solid transparent;"
                  onclick="editStat(this, '${categoryInfo.name} Score')"
                  title="Click to edit score"
                  data-category="${category}">
              ${details.points}/${details.out_of}
            </span>
          </div>
          ${details.rationale ? `<div style="background: white; padding: 10px; border-radius: 4px; line-height: 1.4;">
            ${escapeHtml(details.rationale)}
          </div>` : ''}
        </div>`;
    }
  });
  
  html += `
      </div>

    </div>

    <style>
      /* Hide default arrows since we have our own large clickable areas */
      .editable-score::-webkit-outer-spin-button,
      .editable-score::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      /* Firefox */
      .editable-score[type=number] {
        -moz-appearance: textfield;
      }

      /* Visual feedback for clickable areas */
      .arrow-up-area:hover,
      .arrow-down-area:hover {
        background: rgba(0, 123, 255, 0.1) !important;
      }

      /* Add subtle visual cues */
      .score-input-container:hover .arrow-up-area::after {
        content: '▲';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        color: #666;
        pointer-events: none;
      }

      .score-input-container:hover .arrow-down-area::after {
        content: '▼';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        color: #666;
        pointer-events: none;
      }
    </style>`;

  return html;
}

function getScoreColor(score) {
  // Simple color coding based on score ranges
  if (score >= 90) return '#22C55E'; // Green - Excellent
  if (score >= 80) return '#84CC16'; // Light green - Good  
  if (score >= 70) return '#EAB308'; // Yellow - Satisfactory
  if (score >= 60) return '#F97316'; // Orange - Needs improvement
  return '#EF4444'; // Red - Unsatisfactory
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeHtmlWithFormatting(text) {
  if (!text) return '';
  
  return text
    // First escape HTML characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    // Then preserve formatting
    .replace(/\n\n+/g, '</p><p>')  // Multiple line breaks = paragraph breaks
    .replace(/\n/g, '<br>')        // Single line breaks = line breaks
    .replace(/  +/g, (match) => '&nbsp;'.repeat(match.length)); // Multiple spaces = non-breaking spaces
}

// Export function to generate CSS styles
export function generateCSS() {
  let css = `
    .grading-summary {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    .overall-score {
      text-align: center;
      margin: 20px 0;
    }
    
    .overall-comment {
      text-align: center;
      font-style: italic;
      margin: 15px 0;
      font-size: 1.1em;
    }
    
    .category-breakdown {
      margin: 20px 0;
    }
    
    .legend {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
    }
    
    .formatted-essay {
      font-family: 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.6;
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
    }
  `;
  
  // Add hover effects for errors
  Object.entries(rubric.categories).forEach(([key, category]) => {
    css += `
      .error-${key}:hover {
        background-color: ${category.color} !important;
        color: white !important;
      }
    `;
  });
  
  return css;
}