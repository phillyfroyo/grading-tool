import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rubric = JSON.parse(readFileSync(join(__dirname, 'rubric.json'), 'utf8'));

export function formatGradedEssay(studentText, gradingResults) {
  const { meta, scores, total, inline_issues, teacher_notes, encouragement_next_steps } = gradingResults;
  
  // Build formatted text using offset-based pipeline
  const formattedText = renderWithOffsets(studentText, inline_issues || []);
  
  // Generate feedback summary with new format
  const feedbackHtml = generateFeedbackSummary(scores, total, meta, teacher_notes, encouragement_next_steps);
  
  return {
    formattedText: formattedText,
    feedbackSummary: feedbackHtml,
    errors: inline_issues || [],
    overallScore: total?.points || 0
  };
}

function renderWithOffsets(studentText, inlineIssues) {
  if (!inlineIssues || inlineIssues.length === 0) {
    return escapeHtml(studentText);
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

  // Resolve overlaps with fixed priority: grammar > mechanics > spelling > vocab > content > layout
  const priorityOrder = ['grammar', 'mechanics', 'spelling', 'vocabulary', 'content', 'layout'];
  const resolvedIssues = resolveOverlapsFixed(sortedIssues, priorityOrder);

  // Build segments by slicing original string exactly once
  const segments = buildSegments(normalizedText, resolvedIssues);
  
  // Merge adjacent segments of same type
  const mergedSegments = mergeAdjacentSegments(segments);

  // Render to HTML with proper escaping
  return renderSegmentsToHTML(mergedSegments);
}

function findActualOffsets(text, issues) {
  return issues.map(issue => {
    // Handle punctuation/mechanics errors differently - they don't highlight specific text
    if (issue.type === 'mechanics' && (issue.message.includes('Add comma') || issue.message.includes('Add period'))) {
      console.log(`Skipping mechanics instruction: "${issue.message}"`);
      return null; // Skip these - they're instructions, not highlightable errors
    }
    
    // Extract the original text from the message (before the →)
    const messageParts = issue.message.split('→');
    let originalText = messageParts[0].trim();
    
    // Clean up common prefixes/suffixes that aren't part of the actual error
    originalText = originalText.replace(/^(the|a|an)\s+/i, '');
    originalText = originalText.replace(/\s+(the|a|an)$/i, '');
    
    console.log(`Looking for: "${originalText}" in text`);
    
    // Skip if the "error" is actually an instruction
    if (originalText.length < 2 || originalText.toLowerCase().includes('add ') || originalText.toLowerCase().includes('use ')) {
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
  
  for (const current of issues) {
    let shouldAdd = true;
    let trimmedIssue = { ...current };
    
    // Check against all higher priority issues already added
    for (const existing of resolved) {
      const currentPriority = priorityOrder.indexOf(current.type);
      const existingPriority = priorityOrder.indexOf(existing.type);
      
      // If existing has higher priority and overlaps, trim or drop current
      if (existingPriority < currentPriority && overlaps(current.offsets, existing.offsets)) {
        // If current is completely inside existing, drop it
        if (current.offsets.start >= existing.offsets.start && current.offsets.end <= existing.offsets.end) {
          shouldAdd = false;
          break;
        }
        
        // If partial overlap, trim current (simplified: drop for now)
        shouldAdd = false;
        break;
      }
    }
    
    if (shouldAdd) {
      resolved.push(trimmedIssue);
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

    // Add issue segment
    segments.push({
      type: 'issue',
      text: text.slice(issue.offsets.start, issue.offsets.end),
      issue: issue
    });

    cursor = issue.offsets.end;
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

function renderSegmentsToHTML(segments) {
  return segments.map(segment => {
    if (segment.type === 'normal') {
      return escapeHtml(segment.text);
    } else {
      const categoryInfo = rubric.categories[segment.issue.type];
      const color = categoryInfo?.color || '#666';
      const bgColor = categoryInfo?.backgroundColor || '#f5f5f5';
      
      return `<mark data-type="${escapeHtml(segment.issue.type)}" 
                   style="background: ${bgColor}; color: ${color}; padding: 2px 4px; border-radius: 2px;" 
                   title="${escapeHtml(segment.issue.message)}">
                ${escapeHtml(segment.text)}
              </mark>`;
    }
  }).join('');
}


function generateFeedbackSummary(scores, total, meta, teacherNotes, encouragementSteps) {
  const scoreColor = getScoreColor(total?.points || 0);
  
  let html = `
    <div class="grading-summary">
      <h2>Grading Results</h2>
      
      <div class="overall-score" style="color: ${scoreColor}; font-size: 2em; font-weight: bold; text-align: center; margin: 20px 0;">
        ${total?.points || 0}/${total?.out_of || 100} (${total?.band || 'N/A'})
      </div>
      
      <div class="teacher-notes" style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
        <strong>📝 Teacher Notes:</strong> ${escapeHtml(teacherNotes || 'No notes provided')}
      </div>
      
      <div class="stats-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
        <div style="padding: 10px; background: #e3f2fd; border-radius: 4px; text-align: center;">
          <strong>📊 Word Count</strong><br>
          <span style="font-size: 1.2em; color: #1976D2;">${meta?.word_count || 'Not counted'}</span>
        </div>
        <div style="padding: 10px; background: #f3e5f5; border-radius: 4px; text-align: center;">
          <strong>🔗 Transitions</strong><br>
          <span style="font-size: 1.2em; color: #7B1FA2;">${(meta?.transition_words_found || []).length} found</span>
          ${(meta?.transition_words_found || []).length > 0 ? `<br><small>(${(meta.transition_words_found).join(', ')})</small>` : ''}
        </div>
        <div style="padding: 10px; background: #e8f5e8; border-radius: 4px; text-align: center;">
          <strong>📚 Class Vocabulary</strong><br>
          <span style="font-size: 1.2em; color: #388E3C;">
            ${Array.isArray(meta?.class_vocabulary_used) ? meta.class_vocabulary_used.length + ' used' : (meta?.class_vocabulary_used || 'N/A')}
          </span>
          ${Array.isArray(meta?.class_vocabulary_used) && meta.class_vocabulary_used.length > 0 ? `<br><small>(${meta.class_vocabulary_used.join(', ')})</small>` : ''}
        </div>
        <div style="padding: 10px; background: #fff3e0; border-radius: 4px; text-align: center;">
          <strong>📖 Grammar</strong><br>
          <span style="font-size: 1.2em; color: #F57C00;">
            ${Array.isArray(meta?.grammar_structures_used) ? meta.grammar_structures_used.length + ' structures' : (meta?.grammar_structures_used || 'N/A')}
          </span>
          ${Array.isArray(meta?.grammar_structures_used) && meta.grammar_structures_used.length > 0 ? `<br><small>(${meta.grammar_structures_used.slice(0,2).join(', ')}${meta.grammar_structures_used.length > 2 ? '...' : ''})</small>` : ''}
        </div>
      </div>
      
      <div class="category-breakdown">
        <h3>Category Breakdown:</h3>`;
  
  Object.entries(scores || {}).forEach(([category, details]) => {
    const categoryInfo = rubric.categories[category];
    if (!categoryInfo || !details) return;
    
    const percentage = Math.round((details.points / details.out_of) * 100);
    const categoryColor = getScoreColor(percentage);
    
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
  });
  
  html += `
      </div>
      
      ${encouragementSteps && encouragementSteps.length > 0 ? `
      <div class="encouragement" style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">🌟 Next Steps to Improve:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${encouragementSteps.map(step => `<li style="margin: 8px 0; color: #856404;">${escapeHtml(step)}</li>`).join('')}
        </ul>
      </div>` : ''}
      
      <div class="legend" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <h3>📍 Error Highlight Legend:</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">`;
  
  Object.entries(rubric.categories).forEach(([key, category]) => {
    html += `
      <div class="legend-item" style="display: flex; align-items: center; margin: 5px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
        <mark data-type="${key}" style="background: ${category.backgroundColor}; color: ${category.color}; padding: 4px 8px; border-radius: 3px; margin-right: 10px;">
          sample
        </mark>
        <div>
          <strong style="color: ${category.color};">${category.name}</strong><br>
          <small style="color: #666;">${category.description}</small>
        </div>
      </div>`;
  });
  
  html += `
        </div>
      </div>
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