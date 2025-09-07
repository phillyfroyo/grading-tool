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
  'vocabulary-structure': { color: '#00A36C', backgroundColor: 'transparent', name: 'Vocabulary' }, // Green text
  'mechanics': { color: '#000000', backgroundColor: '#D3D3D3', name: 'Mechanics' }, // Gray highlight
  'mechanics-punctuation': { color: '#000000', backgroundColor: '#D3D3D3', name: 'Mechanics' }, // Gray highlight
  'spelling': { color: '#DC143C', backgroundColor: 'transparent', name: 'Spelling' }, // Red text
  'fluency': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'needs-rephrasing': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'redundancy': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'non-suitable-words': { color: '#000000', backgroundColor: '#87CEEB', name: 'Fluency' }, // Blue highlight
  'professor-comments': { color: '#000000', backgroundColor: '#FACC15', name: "Comments" }
};

export function formatGradedEssay(studentText, gradingResults, options = {}) {
  console.log('\n🎨 FORMATTER CALLED');
  console.log(`Student text length: ${studentText.length}`);
  console.log(`Number of inline issues: ${(gradingResults.inline_issues || []).length}`);
  
  const { meta, scores, total, inline_issues, teacher_notes, encouragement_next_steps } = gradingResults;
  
  // Build formatted text using offset-based pipeline
  const formattedText = renderWithOffsets(studentText, inline_issues || [], options);
  
  // Generate feedback summary with new format
  const feedbackHtml = generateFeedbackSummary(scores, total, meta, teacher_notes, encouragement_next_steps, options);
  
  return {
    formattedText: formattedText,
    feedbackSummary: feedbackHtml,
    errors: inline_issues || [],
    overallScore: total?.points || 0,
    segments: options.editable ? buildSegments(studentText.normalize('NFC'), findActualOffsets(studentText.normalize('NFC'), inline_issues || [])) : null
  };
}

function renderWithOffsets(studentText, inlineIssues, options = {}) {
  if (!inlineIssues || inlineIssues.length === 0) {
    return options.editable ? 
      `<span class="text-segment" data-segment-id="0">${escapeHtml(studentText)}</span>` :
      escapeHtml(studentText);
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
      const issueDesc = issue.message || `${issue.text} → ${issue.correction}`;
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
      // Legacy format: "original → corrected"  
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
    
    // Find the actual position of this text
    let bestMatch = null;
    
    // Try exact match first
    let index = text.indexOf(originalText);
    if (index !== -1) {
      bestMatch = { start: index, end: index + originalText.length };
      console.log(`Found exact match at ${index}-${index + originalText.length}`);
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
  
  // First, remove exact duplicates (same offsets)
  const uniqueIssues = [];
  const seenOffsets = new Set();
  
  for (const issue of issues) {
    const offsetKey = `${issue.offsets.start}-${issue.offsets.end}`;
    if (!seenOffsets.has(offsetKey)) {
      seenOffsets.add(offsetKey);
      uniqueIssues.push(issue);
    } else {
      const issueDesc = issue.message || `${issue.text} → ${issue.correction}`;
      console.log(`Removing duplicate highlight at ${offsetKey}: ${issueDesc}`);
    }
  }
  
  // Then resolve overlaps by priority
  for (const current of uniqueIssues) {
    let shouldAdd = true;
    
    // Check against all issues already added
    for (const existing of resolved) {
      if (overlaps(current.offsets, existing.offsets)) {
        const currentPriority = priorityOrder.indexOf(current.type);
        const existingPriority = priorityOrder.indexOf(existing.type);
        
        // If existing has higher priority (lower index), drop current
        if (existingPriority >= 0 && (currentPriority < 0 || existingPriority < currentPriority)) {
          console.log(`Dropping overlapping issue: ${current.message} (conflicts with ${existing.message})`);
          shouldAdd = false;
          break;
        }
        // If current has higher priority, remove existing and add current
        else if (currentPriority >= 0 && currentPriority < existingPriority) {
          console.log(`Replacing lower priority issue: ${existing.message} with ${current.message}`);
          const index = resolved.indexOf(existing);
          resolved.splice(index, 1);
        }
        // If same priority, keep the first one
        else if (currentPriority === existingPriority) {
          console.log(`Same priority overlap, keeping first: ${existing.message}`);
          shouldAdd = false;
          break;
        }
      }
    }
    
    if (shouldAdd) {
      resolved.push(current);
    }
  }
  
  return resolved.sort((a, b) => a.offsets.start - b.offsets.start);
}

function overlaps(range1, range2) {
  return range1.start < range2.end && range1.end > range2.start;
}

function buildSegments(text, issues) {
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
  
  return segments.map((segment, index) => {
    if (segment.type === 'normal') {
      return editable ? 
        `<span class="text-segment" data-segment-id="${index}">${escapeHtml(segment.text)}</span>` :
        escapeHtml(segment.text);
    } else if (segment.type === 'caret') {
      // Render caret marker for comma/period suggestions
      const issueDesc = segment.issue.message || `${segment.issue.text} → ${segment.issue.correction}`;
      return `<span class="caret-marker" 
                   data-type="${escapeHtml(segment.issue.category || segment.issue.type || '')}"
                   data-message="${escapeHtml(issueDesc)}"
                   title="${escapeHtml(issueDesc)}"
                   style="color: #DC143C; font-weight: bold; position: relative;">▿</span>`;
    } else {
      // Use correction guide colors for inline_issues, fallback to rubric colors
      const issueCategory = segment.issue.category || segment.issue.type || '';
      const correctionInfo = correctionGuideColors[issueCategory];
      const categoryInfo = correctionInfo || rubric.categories[issueCategory];
      const color = categoryInfo?.color || '#666';
      const bgColor = categoryInfo?.backgroundColor || '#f5f5f5';
      const textDecoration = categoryInfo?.textDecoration || 'none';
      const categoryName = categoryInfo?.name || issueCategory;
      
      const editableAttrs = editable ? 
        `data-segment-id="${index}" data-editable="true" class="highlighted-segment"` : '';
      
      // Build style string with conditional properties
      let styleProps = `color: ${color}; text-decoration: ${textDecoration}; position: relative;`;
      if (bgColor && bgColor !== 'transparent') {
        styleProps += ` background: ${bgColor}; padding: 2px 4px; border-radius: 2px;`;
      }
      
      // Special styling for coaching-only fluency suggestions
      if (segment.issue.coaching_only && issueCategory === 'fluency') {
        styleProps = `color: #A855F7; text-decoration: underline dotted; position: relative; opacity: 0.8;`;
      }
      
      const issueDesc = segment.issue.message || `${segment.issue.text} → ${segment.issue.correction}`;
      const coachingAttr = segment.issue.coaching_only ? 'data-coaching-only="true"' : '';
      return `<mark data-type="${escapeHtml(issueCategory)}" 
                   data-message="${escapeHtml(issueDesc)}"
                   ${coachingAttr}
                   ${editableAttrs}
                   style="${styleProps}" 
                   title="${escapeHtml(issueDesc)}">
                ${escapeHtml(segment.text)}
                ${editable ? `<span class="edit-indicator" style="font-size: 10px; margin-left: 2px;">✎</span>` : ''}
              </mark>`;
    }
  }).join('');
}


function generateFeedbackSummary(scores, total, meta, teacherNotes, encouragementSteps, options = {}) {
  const { editable = true } = options;
  const scoreColor = getScoreColor(total?.points || 0);
  
  let html = `
    <div class="grading-summary">
      <h2>Grading Results</h2>
      
      <div class="overall-score" style="color: ${scoreColor}; font-size: 2em; font-weight: bold; text-align: center; margin: 20px 0;">
        ${total?.points || 0}/${total?.out_of || 100}
      </div>
      
      <div class="teacher-notes editable-section" style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; cursor: pointer; border: 2px solid transparent;" onclick="editTeacherNotes(this)" title="Click to edit teacher notes">
        <strong>📝 Teacher Notes:</strong> <span class="teacher-notes-content">${escapeHtml(teacherNotes || 'No notes provided')}</span>
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: ${categoryInfo.color}; font-size: 1.1em;">
              ${categoryInfo.name}
            </strong>
            <div style="display: flex; align-items: center; gap: 5px;">
              <input type="number" 
                     class="editable-score" 
                     data-category="${category}"
                     value="${details.points}" 
                     min="0" 
                     max="${details.out_of}"
                     style="width: 60px; padding: 4px; border: 1px solid #ddd; border-radius: 3px; text-align: center; font-weight: bold; color: ${categoryColor};">
              <span style="color: ${categoryColor}; font-weight: bold; font-size: 1.2em;">/${details.out_of}</span>
            </div>
          </div>
          <div style="background: white; padding: 10px; border-radius: 4px; line-height: 1.4;">
            <textarea class="editable-feedback" 
                      data-category="${category}"
                      style="width: 100%; min-height: 80px; border: 1px solid #ddd; border-radius: 3px; padding: 8px; resize: vertical; font-family: inherit; line-height: 1.4;">${escapeHtml(details.rationale || 'No feedback provided')}</textarea>
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
            <span style="color: ${categoryColor}; font-weight: bold; font-size: 1.2em;">
              ${details.points}/${details.out_of}
            </span>
          </div>
          <div style="background: white; padding: 10px; border-radius: 4px; line-height: 1.4;">
            ${escapeHtml(details.rationale || 'No feedback provided')}
          </div>
        </div>`;
    }
  });
  
  html += `
      </div>
      
      ${encouragementSteps ? `
      <div class="encouragement" style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">🌟 Next Steps to Improve:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${Array.isArray(encouragementSteps) 
            ? encouragementSteps.map(step => `<li style="margin: 8px 0; color: #856404;">${escapeHtml(step)}</li>`).join('')
            : `<li style="margin: 8px 0; color: #856404;">${escapeHtml(encouragementSteps)}</li>`}
        </ul>
      </div>` : ''}
    </div>`;
  
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