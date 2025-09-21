/**
 * Essay Formatter Module
 * Handles essay text formatting and display utilities
 */

/**
 * Format essay text for display
 * @param {string} text - Raw essay text
 * @returns {string} Formatted HTML
 */
function formatEssayText(text) {
    if (!text) return '';

    // Basic text formatting - convert line breaks to paragraphs
    return text
        .split('\n\n')
        .filter(paragraph => paragraph.trim())
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

/**
 * Format essay text with segments for highlighting
 * @param {string} text - Raw essay text
 * @returns {string} Formatted HTML with segment wrappers
 */
function formatEssayTextWithSegments(text) {
    if (!text) return '';

    // Split text into sentences and wrap each in a segment
    const sentences = splitIntoSentences(text);
    return sentences.map((sentence, index) =>
        `<span class="text-segment" data-segment-id="${index}">${escapeHtml(sentence)}</span>`
    ).join(' ');
}

/**
 * Split text into sentences
 * @param {string} text - Text to split
 * @returns {Array} Array of sentences
 */
function splitIntoSentences(text) {
    if (!text) return [];

    // Simple sentence splitting - can be enhanced with more sophisticated logic
    return text
        .split(/(?<=[.!?])\s+/)
        .filter(sentence => sentence.trim())
        .map(sentence => sentence.trim());
}

/**
 * Clean text from highlights and formatting
 * @param {string} html - HTML text with highlights
 * @returns {string} Clean text
 */
function cleanTextFromHighlights(html) {
    if (!html) return '';

    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove all highlighting elements but keep their text content
    const highlights = temp.querySelectorAll('mark');
    highlights.forEach(highlight => {
        const text = highlight.textContent;
        highlight.replaceWith(text);
    });

    return temp.textContent || temp.innerText || '';
}

/**
 * Convert HTML to plain text
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function htmlToPlainText(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Unescape HTML entities
 * @param {string} html - HTML to unescape
 * @returns {string} Unescaped text
 */
function unescapeHtml(html) {
    if (!html) return '';

    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
    if (!text) return 0;

    // Clean text and split by whitespace
    const cleanText = htmlToPlainText(text);
    return cleanText.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count sentences in text
 * @param {string} text - Text to count sentences in
 * @returns {number} Sentence count
 */
function countSentences(text) {
    if (!text) return 0;

    const cleanText = htmlToPlainText(text);
    return splitIntoSentences(cleanText).length;
}

/**
 * Count paragraphs in text
 * @param {string} text - Text to count paragraphs in
 * @returns {number} Paragraph count
 */
function countParagraphs(text) {
    if (!text) return 0;

    const cleanText = htmlToPlainText(text);
    return cleanText.split(/\n\s*\n/).filter(para => para.trim()).length;
}

/**
 * Get text statistics
 * @param {string} text - Text to analyze
 * @returns {Object} Statistics object
 */
function getTextStatistics(text) {
    const cleanText = htmlToPlainText(text);

    return {
        words: countWords(text),
        sentences: countSentences(text),
        paragraphs: countParagraphs(text),
        characters: cleanText.length,
        charactersNoSpaces: cleanText.replace(/\s/g, '').length,
        averageWordsPerSentence: Math.round(countWords(text) / Math.max(countSentences(text), 1)),
        averageSentencesPerParagraph: Math.round(countSentences(text) / Math.max(countParagraphs(text), 1))
    };
}

/**
 * Format text with line numbers
 * @param {string} text - Text to format
 * @returns {string} Formatted HTML with line numbers
 */
function formatTextWithLineNumbers(text) {
    if (!text) return '';

    const lines = text.split('\n');
    return lines.map((line, index) =>
        `<div class="line-numbered" data-line="${index + 1}">
            <span class="line-number">${index + 1}:</span>
            <span class="line-content">${escapeHtml(line)}</span>
        </div>`
    ).join('');
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text;

    const cleanText = htmlToPlainText(text);
    return cleanText.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Highlight search terms in text
 * @param {string} text - Text to search in
 * @param {string} searchTerm - Term to highlight
 * @param {string} className - CSS class for highlighting
 * @returns {string} Text with highlighted search terms
 */
function highlightSearchTerms(text, searchTerm, className = 'search-highlight') {
    if (!text || !searchTerm) return text;

    const escapedTerm = escapeHtml(searchTerm);
    const regex = new RegExp(`(${escapedTerm})`, 'gi');

    return text.replace(regex, `<span class="${className}">$1</span>`);
}

/**
 * Create a text preview with context around a position
 * @param {string} text - Full text
 * @param {number} position - Character position
 * @param {number} contextLength - Length of context on each side
 * @returns {Object} Preview object with text and relative position
 */
function createTextPreview(text, position, contextLength = 50) {
    if (!text || position < 0) return { text: '', start: 0, end: 0 };

    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);

    const preview = text.substring(start, end);
    const relativePosition = position - start;

    return {
        text: preview,
        start: start,
        end: end,
        relativePosition: relativePosition
    };
}

// Export functions for module usage
window.EssayFormatterModule = {
    formatEssayText,
    formatEssayTextWithSegments,
    splitIntoSentences,
    cleanTextFromHighlights,
    htmlToPlainText,
    escapeHtml,
    unescapeHtml,
    countWords,
    countSentences,
    countParagraphs,
    getTextStatistics,
    formatTextWithLineNumbers,
    truncateText,
    highlightSearchTerms,
    createTextPreview
};