/**
 * PDF Export Module
 * Handles PDF generation and export functionality for essays and grading results
 */

/**
 * Export single essay to PDF
 */
function exportToPDF() {
    console.log('🎯 EXPORT TO PDF CALLED');

    const resultsDiv = document.getElementById('results');
    if (!resultsDiv || resultsDiv.style.display === 'none' || !resultsDiv.innerHTML.trim()) {
        alert('No results to export. Please grade an essay first.');
        return;
    }

    console.log('📋 Results div found:', resultsDiv);
    console.log('📋 Results div content length:', resultsDiv.innerHTML.length);
    console.log('📋 Results div content preview:', resultsDiv.innerHTML.substring(0, 300));

    // Get student name from the heading
    const heading = resultsDiv.querySelector('h2');
    console.log('📋 Heading found:', heading);
    console.log('📋 Heading text:', heading ? heading.textContent : 'No heading found');

    const studentName = heading ? heading.textContent.replace('Grading Results for ', '') : 'Student';

    // Create export content
    const exportContent = createExportContent(resultsDiv, studentName);
    console.log('📋 Export content created:', exportContent);
    console.log('📋 Export content HTML length:', exportContent.innerHTML.length);
    console.log('📋 Export content HTML preview:', exportContent.innerHTML.substring(0, 500));
    console.log('📋 Export content outer HTML preview:', exportContent.outerHTML.substring(0, 500));

    // Check if html2pdf is available
    if (!isHTML2PDFLoaded()) {
        alert('PDF export library is not loaded. Please try again in a moment.');
        return;
    }

    // Export using html2pdf with simple options
    const opt = {
        margin: 0.5,
        filename: `${studentName}_grading_results.pdf`,
        image: { type: 'jpeg', quality: 0.8 },
        html2canvas: {
            scale: 1,
            allowTaint: true,
            backgroundColor: '#ffffff'
        },
        jsPDF: {
            unit: 'in',
            format: 'letter',
            orientation: 'portrait'
        }
    };

    console.log('📋 Starting PDF generation with options:', opt);

    // Use browser's print dialog instead of problematic html2pdf
    console.log('📋 Opening print dialog for PDF generation...');
    openPrintDialog(resultsDiv, studentName);
}

/**
 * Open browser print dialog for PDF generation
 * @param {HTMLElement} resultsDiv - Results container
 * @param {string} studentName - Student name
 */
function openPrintDialog(resultsDiv, studentName) {
    console.log('📋 Preparing content for print dialog...');

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (!printWindow) {
        console.log('Print window blocked by browser. Using iframe method...');
        // Use alternative method - create a hidden iframe
        createPrintIframe(resultsDiv, studentName);
        return;
    }

    // Get the content to print
    const printContent = createPrintContent(resultsDiv, studentName);

    // Write content to the new window
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Graded Essay - ${studentName}</title>
            <style>
                /* Force background colors for printing */
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @media print {
                    @page {
                        margin: 0.5in;
                        size: letter;
                        /* Force removal of all headers and footers */
                        @top-left { content: ""; }
                        @top-center { content: ""; }
                        @top-right { content: ""; }
                        @bottom-left { content: ""; }
                        @bottom-center { content: ""; }
                        @bottom-right { content: ""; }
                        @top-left-corner { content: ""; }
                        @top-right-corner { content: ""; }
                        @bottom-left-corner { content: ""; }
                        @bottom-right-corner { content: ""; }
                    }
                    /* Hide any browser-generated content */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .no-print { display: none !important; }
                    /* Force highlight backgrounds to print */
                    mark {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Ensure yellow category headers print with background */
                    .category-header-yellow {
                        background: #FFFF99 !important;
                        background-color: #FFFF99 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
                @media screen {
                    body { margin: 20px; }
                    .print-instructions {
                        background: #e3f2fd;
                        border: 1px solid #2196f3;
                        padding: 15px;
                        margin-bottom: 20px;
                        border-radius: 4px;
                    }
                }
                body {
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #000;
                    background: white;
                }
                h1 { font-size: 20px; margin: 0 0 10px 0; }
                h2 { font-size: 18px; margin: 15px 0 10px 0; }
                h3 { font-size: 16px; margin: 12px 0 8px 0; }
                .grading-summary { margin: 20px 0; }
                .overall-score {
                    font-size: 18px;
                    font-weight: normal;
                    text-align: left;
                    margin: 10px 0;
                    padding: 0;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                }
                .teacher-notes-section {
                    margin: 15px 0;
                    padding: 0;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    border-left: none;
                }
                .teacher-notes-section h3 {
                    margin-top: 0;
                    color: #000;
                    font-size: 16px;
                    font-weight: normal;
                }
                /* STRONGER PAGE BREAK PROTECTION FOR SCORE SECTIONS */
                .score-section {
                    margin: 10px 0 !important;
                    padding: 5px 0 !important;
                    background: transparent !important;
                    border-radius: 0 !important;
                    border-left: none !important;

                    /* Multiple page break rules for maximum protection */
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-before: auto !important;
                    page-break-after: auto !important;

                    /* CSS Grid/Flexbox alternative protection */
                    display: block !important;
                    overflow: visible !important;

                    /* Webkit specific rules */
                    -webkit-column-break-inside: avoid !important;
                    column-break-inside: avoid !important;
                }

                /* COMPREHENSIVE PROTECTION FOR ALL SCORE SECTION CONTENT */
                .score-section *,
                .score-section h3,
                .score-section h4,
                .score-section p,
                .score-section div,
                .score-section ul,
                .score-section li {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-before: avoid !important;
                    break-before: avoid !important;
                    -webkit-column-break-inside: avoid !important;
                    column-break-inside: avoid !important;
                }

                /* Keep score section headers with their content */
                .score-section h3,
                .score-section h4 {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                    orphans: 3 !important;
                    widows: 3 !important;
                }

                /* Category Breakdown section specific protection - ALL categories */
                .score-section:has(*:contains("Content & Information")),
                .score-section:has(*:contains("Organization")),
                .score-section:has(*:contains("Language Use")),
                .score-section:has(*:contains("Mechanics")),
                .score-section:has(*:contains("Spelling")),
                .score-section:has(*:contains("Grammar")),
                .score-section:has(*:contains("Vocabulary")),
                .score-section:has(*:contains("Fluency")) {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    display: block !important;
                    overflow: visible !important;
                    /* Force container behavior */
                    contain: layout !important;
                }
                /* NUCLEAR OPTION: Remove ALL formatting from category sections */
                .score-section, .score-section *, .category, .category *,
                .score-box, .score-box *, .inner-box, .inner-box *,
                [class*="score"], [class*="score"] *, [class*="category"], [class*="category"] *,
                div[style], div[style] *, span[style], span[style] * {
                    background: transparent !important;
                    background-color: transparent !important;
                    background-image: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    color: black !important;
                    font-weight: normal !important;
                    font-style: normal !important;
                    text-decoration: none !important;
                    outline: none !important;
                }
                /* Force override any inline styles */
                *[style] {
                    background: transparent !important;
                    background-color: transparent !important;
                    border: none !important;
                    color: black !important;
                }

                /* OVERRIDE RULE ABOVE - Force yellow background on category headers - MUST BE AFTER */
                .category-header-yellow,
                p.category-header-yellow,
                .category-score-yellow,
                *[style].category-header-yellow {
                    background: #FFFF99 !important;
                    background-color: #FFFF99 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    font-weight: bold !important;
                    padding: 2px 4px !important;
                }
                /* Only allow specific margins for plain categories */
                .plain-category {
                    margin: 8px 0 !important;
                    background: transparent !important;
                    border: none !important;
                }
                .plain-category p:not(.category-header-yellow) {
                    margin: 5px 0 !important;
                    background: transparent !important;
                    border: none !important;
                    color: black !important;
                    font-weight: normal !important;
                }
                .plain-category p:last-child {
                    margin: 5px 0 10px 20px !important;
                }
                .teacher-notes {
                    background: #f0f8ff;
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                }
                .essay-content, .formatted-essay-content {
                    background: #fafafa;
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                    font-family: 'Times New Roman', serif;
                    line-height: 1.8;
                    font-size: 14px;
                    text-align: left;
                    width: 100%;
                    box-sizing: border-box;
                    overflow: visible;
                    white-space: normal;
                }
                /* CONTROL SECTION SPACING AND KEEP SECTIONS TOGETHER */

                /* SIMPLIFIED: Just normal margins, no forced page breaks for sections */
                .grading-summary,
                .category-breakdown,
                .essay-section,
                .color-coded-essay-section {
                    margin: 15px 0 !important;
                }

                /* Normal margins for all major sections */
                .overall-score,
                .teacher-notes-section {
                    margin: 15px 0 !important;
                }

                /* Keep essay with its title - stronger rules */
                h3:has(+ .essay-content),
                h3:has(+ .formatted-essay-content) {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                    margin-bottom: 10px !important;
                }

                /* Color-Coded Essay section specific spacing */
                h3:contains("Color-Coded Essay"),
                h3:contains("Color-coded Essay"),
                h3:contains("color-coded essay"),
                h2:contains("Color-Coded Essay"),
                h2:contains("Color-coded Essay") {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                    margin-bottom: 10px !important;
                    margin-top: 15px !important;
                }

                /* Ensure color-coded essay section follows immediately after category breakdown */
                .formatted-essay-content {
                    page-break-before: avoid !important;
                    break-before: avoid !important;
                    margin-top: 15px !important;
                }

                /* Group entire essay display blocks together */
                .essay-display {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    margin: 20px 0 !important;
                }

                /* Create tight grouping for color-coded essay components */
                *:contains("Color-Coded Essay") ~ .formatted-essay-content,
                *:contains("Color-coded Essay") ~ .formatted-essay-content {
                    page-break-before: avoid !important;
                    break-before: avoid !important;
                    margin-top: 10px !important;
                }

                /* MINIMAL page break rules - only for headers */
                h1, h2, h3 {
                    page-break-after: avoid !important;
                }
                /* UNIVERSAL CATEGORY PROTECTION - Catch any category content */
                /* Any element containing category names should stay together */
                *:contains("Content & Information"),
                *:contains("Organization"),
                *:contains("Language Use"),
                *:contains("Mechanics"),
                *:contains("Grammar"),
                *:contains("Vocabulary"),
                *:contains("Spelling"),
                *:contains("Fluency") {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }

                /* Additional comprehensive page break rules */
                /* Category breakdown sections - keep each category together */
                div:contains("Grammar"), div:contains("Vocabulary"), div:contains("Mechanics"),
                div:contains("Spelling"), div:contains("Fluency") {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                /* Prevent orphaned category titles */
                h3 + div, h3 + p, h3 + .score-section {
                    page-break-before: avoid;
                    break-before: avoid;
                }
                /* Keep color-coded essay components together */
                [data-section*="essay"], [class*="essay"] {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                /* Reset any problematic positioning */
                .essay-content *, .formatted-essay-content * {
                    position: static !important;
                    float: none !important;
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                    text-indent: 0 !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
                /* Ensure paragraphs start properly */
                .essay-content p, .formatted-essay-content p {
                    margin: 0 0 1em 0 !important;
                    padding: 0 !important;
                    text-indent: 0 !important;
                    text-align: left !important;
                }
                /* Ensure color-coded essay section is visible */
                .essay-display, [class*="essay-content"] {
                    display: block !important;
                    visibility: visible !important;
                    position: static !important;
                    top: auto !important;
                    left: auto !important;
                    transform: none !important;
                }
                /* Remove interactive elements for print */
                button, .category-btn, .editable-section {
                    display: none !important;
                }
                /* Clean up highlight colors for print with numbers */
                mark[data-highlight-number] {
                    background: #ffeb3b !important;
                    color: #000 !important;
                    padding: 1px 2px;
                    position: relative;
                    margin-right: 2px;
                }
                mark[data-highlight-number]::after {
                    content: attr(data-highlight-number);
                    color: #0066cc;
                    font-size: 10px;
                    font-weight: bold;
                    vertical-align: super;
                    margin-left: 1px;
                }
                /* Ensure all highlights are visible with appropriate category colors */
                mark[data-category="grammar"], mark[data-type="grammar"] {
                    background: transparent !important;
                    color: #FF8C00 !important;
                    border: none !important;
                    font-weight: bold !important;
                }
                mark[data-category="vocabulary"], mark[data-type="vocabulary"] {
                    background: transparent !important;
                    color: #00A36C !important;
                    border: none !important;
                    font-weight: bold !important;
                }
                mark[data-category="spelling"], mark[data-type="spelling"] {
                    background: transparent !important;
                    color: #DC143C !important;
                    border: none !important;
                    font-weight: bold !important;
                }
                mark[data-category="mechanics"], mark[data-type="mechanics"] {
                    background: #D3D3D3 !important;
                    color: #000000 !important;
                    border: none !important;
                    padding: 1px 2px !important;
                    border-radius: 2px !important;
                }
                mark[data-category="fluency"], mark[data-type="fluency"] {
                    background: #87CEEB !important;
                    color: #000000 !important;
                    border: none !important;
                    padding: 1px 2px !important;
                    border-radius: 2px !important;
                }
                mark[data-category="delete"], mark[data-type="delete"] {
                    background: transparent !important;
                    color: #000000 !important;
                    border: none !important;
                    text-decoration: line-through !important;
                    padding: 0 !important;
                }
                /* Legend labels with colors */
                .legend-grammar { color: #FF8C00 !important; font-weight: bold !important; }
                .legend-vocabulary { color: #00A36C !important; font-weight: bold !important; }
                .legend-spelling { color: #DC143C !important; font-weight: bold !important; }
                .legend-mechanics { background: #D3D3D3 !important; color: #000000 !important; padding: 2px 4px !important; }
                .legend-fluency { background: #87CEEB !important; color: #000000 !important; padding: 2px 4px !important; }
                .legend-delete { text-decoration: line-through !important; color: #000000 !important; }
                /* Fallback for any mark elements */
                mark {
                    background: transparent !important;
                    color: #000 !important;
                    padding: 0 !important;
                    border: none !important;
                    position: static !important;
                    float: none !important;
                    margin: 0 !important;
                    display: inline !important;
                    vertical-align: baseline !important;
                }
                /* Fix any text nodes that might have weird spacing */
                .essay-content, .formatted-essay-content {
                    text-align: justify;
                    text-justify: inter-word;
                }
                /* Ensure first line starts at top */
                .essay-content > *:first-child, .formatted-essay-content > *:first-child {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                }
                .highlights-legend {
                    margin-top: 20px;
                    page-break-inside: avoid;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 20px;
                    break-before: avoid;
                    page-break-before: avoid;
                }
                .highlights-legend h3 {
                    border-bottom: 2px solid #333;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                    font-size: 20px;
                }
                .highlight-entry {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border-left: 4px solid var(--category-color, #667eea);
                    position: relative;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .highlight-entry.grammar-error {
                    border-left-color: #FF8C00;
                }
                .highlight-entry.vocabulary-error {
                    border-left-color: #00A36C;
                }
                .highlight-entry.spelling-error {
                    border-left-color: #DC143C;
                }
                .highlight-entry.mechanics-error {
                    border-left-color: #D3D3D3;
                }
                .highlight-entry.fluency-error {
                    border-left-color: #87CEEB;
                }
                .highlight-entry.delete-error {
                    border-left-color: #000000;
                }
                .highlight-number-text {
                    font-weight: bold;
                    color: #333;
                    margin-right: 8px;
                }
                .correction-text {
                    margin-top: 8px;
                    font-style: italic;
                    color: #555;
                    padding-left: 20px;
                }
                /* Hide specific sections from PDF */
                .word-count-section,
                .transitions-section,
                .vocabulary-section,
                .class-vocab-section,
                .grammar-section,
                [data-section="word-count"],
                [data-section="transitions"],
                [data-section="vocabulary"],
                [data-section="class-vocab"],
                [data-section="grammar"] {
                    display: none !important;
                }
                /* Hide elements containing specific text patterns */
                *:contains("Word Count:"),
                *:contains("Transitions:"),
                *:contains("Class Vocabulary:"),
                *:contains("Grammar Structures:") {
                    display: none !important;
                }

                /* YELLOW HIGHLIGHTING FOR CATEGORY HEADERS - MUST BE LAST WITH HIGHEST SPECIFICITY */
                .category-header-yellow,
                p.category-header-yellow,
                *[style].category-header-yellow,
                .plain-category p.category-header-yellow {
                    background: #FFFF99 !important;
                    background-color: #FFFF99 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    font-weight: bold !important;
                    padding: 2px 4px !important;
                }
            </style>
        </head>
        <body>
            <div class="print-instructions no-print">
                <strong>📄 Print Instructions:</strong>
                <br>• Press Ctrl+P (Windows) or Cmd+P (Mac) to open print dialog
                <br>• Select "Save as PDF" as destination
                <br>• Click "Save" to download the PDF
                <br>• This window will close automatically after printing
            </div>

            ${printContent}

            <script>
                // Auto-open print dialog after a short delay
                setTimeout(() => {
                    window.print();
                }, 500);

                // Close window after printing (most browsers)
                window.addEventListener('afterprint', () => {
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                });
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();

    console.log('✅ Print window opened successfully');
}

/**
 * Alternative print method using iframe (fallback for blocked popups)
 * @param {HTMLElement} resultsDiv - Results container
 * @param {string} studentName - Student name
 */
function createPrintIframe(resultsDiv, studentName) {
    console.log('📋 Creating print iframe as fallback...');

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    // Get the content to print
    const printContent = createPrintContent(resultsDiv, studentName);

    // Write content to iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const fullContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Graded Essay - ${studentName}</title>
            <style>
                /* Force background colors for printing */
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @page {
                    margin: 0.5in;
                    size: letter;
                    /* Force removal of all headers and footers */
                    @top-left { content: ""; }
                    @top-center { content: ""; }
                    @top-right { content: ""; }
                    @bottom-left { content: ""; }
                    @bottom-center { content: ""; }
                    @bottom-right { content: ""; }
                    @top-left-corner { content: ""; }
                    @top-right-corner { content: ""; }
                    @bottom-left-corner { content: ""; }
                    @bottom-right-corner { content: ""; }
                }
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #000;
                    background: white;
                }
                .no-print { display: none !important; }
                /* Include all the same styles as the popup version */
                ${document.querySelector('style')?.textContent || ''}
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `;

    iframeDoc.open();
    iframeDoc.write(fullContent);
    iframeDoc.close();

    // Wait a moment for content to load, then print
    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            console.log('✅ Print dialog opened via iframe');
        } catch (error) {
            console.error('Failed to print via iframe:', error);
            // Final fallback - direct browser print of current page
            window.print();
        }

        // Clean up iframe after printing
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
}

/**
 * Process highlights in the content for PDF export
 * @param {HTMLElement} content - Content element to process
 * @returns {Array} Array of highlight data objects
 */
function processHighlightsForPDF(content) {
    // Get all highlights but exclude those in the color legend
    const allHighlights = content.querySelectorAll('mark[data-category], mark[data-type]');
    const highlights = Array.from(allHighlights).filter(mark => {
        // Exclude marks that are inside the color legend
        return !mark.closest('.color-legend');
    });
    console.log('🔍 Looking for highlights with mark[data-category], mark[data-type]:', allHighlights.length, 'total,', highlights.length, 'after filtering out legend');

    // Debug: Check what mark elements exist
    const allMarks = content.querySelectorAll('mark');
    console.log('🔍 Found total mark elements:', allMarks.length);

    // Also check for span elements with highlighting classes
    const highlightSpans = content.querySelectorAll('span[data-category], span.highlight, span[class*="highlight"]');
    console.log('🔍 Found span highlights:', highlightSpans.length);
    if (highlightSpans.length > 0) {
        highlightSpans.forEach((span, index) => {
            console.log(`📝 Highlight span ${index}:`, {
                attributes: Array.from(span.attributes).map(attr => `${attr.name}="${attr.value}"`),
                text: span.textContent.substring(0, 50),
                classes: span.className
            });
        });
    }
    if (allMarks.length > 0) {
        allMarks.forEach((mark, index) => {
            console.log(`🏷️ Mark ${index}:`, {
                attributes: Array.from(mark.attributes).map(attr => `${attr.name}="${attr.value}"`),
                text: mark.textContent.substring(0, 50),
                classes: mark.className,
                hasDataCategory: !!mark.dataset.category,
                hasDataType: !!mark.dataset.type,
                dataCategory: mark.dataset.category,
                dataType: mark.dataset.type
            });
        });
    }

    const highlightsData = [];
    let highlightNumber = 1;

    highlights.forEach(mark => {
        // Get highlight information
        const categories = (mark.dataset.category || mark.dataset.type || 'highlight').split(',').map(c => c.trim());
        const notes = mark.dataset.notes || mark.dataset.message || mark.title || '';
        const originalText = mark.dataset.originalText || mark.textContent || '';

        // Only process highlights that have notes/explanations for numbering
        if (notes && notes.trim() && !notes.toLowerCase().includes('click to edit')) {
            // Add number to the highlight
            mark.setAttribute('data-highlight-number', highlightNumber);

            // Store highlight data
            highlightsData.push({
                number: highlightNumber,
                text: originalText.trim(),
                categories: categories,
                notes: notes.trim()
            });

            highlightNumber++;
        }

        // Keep category/type attributes for styling but clean up interactive attributes
        mark.removeAttribute('onclick');
        mark.removeAttribute('data-notes');
        mark.removeAttribute('data-message');
        mark.removeAttribute('title');
        mark.removeAttribute('onmouseover');
        mark.removeAttribute('onmouseout');
        mark.style.cursor = 'default';

        // Remove any event listeners
        const newMark = mark.cloneNode(true);
        if (mark.parentNode) {
            mark.parentNode.replaceChild(newMark, mark);
        }
    });

    console.log('📝 Processed', highlightsData.length, 'highlights for PDF');
    return highlightsData;
}

/**
 * Create highlights legend HTML
 * @param {Array} highlightsData - Array of highlight data objects
 * @returns {string} HTML for highlights legend
 */
function createHighlightsLegend(highlightsData) {
    if (!highlightsData.length) return '';

    let legendHTML = `
        <div class="highlights-legend">
            <h3>Highlights and Corrections</h3>
            <p style="margin-bottom: 20px; font-style: italic; color: #666;">
                The following numbered highlights correspond to corrections and feedback in the essay above.
            </p>
    `;

    highlightsData.forEach(highlight => {
        // Format categories properly
        const categoryNames = highlight.categories.map(cat => getCategoryDisplayName(cat));
        let categoryText = '';

        if (categoryNames.length === 1) {
            categoryText = categoryNames[0];
        } else if (categoryNames.length === 2) {
            categoryText = categoryNames.join(' & ') + ' Error';
        } else if (categoryNames.length > 2) {
            const lastCategory = categoryNames.pop();
            categoryText = categoryNames.join(', ') + ', & ' + lastCategory + ' Error';
        }

        // Determine CSS class for color coding
        const primaryCategory = highlight.categories[0].toLowerCase();
        const cssClass = primaryCategory + '-error';

        // Create the entry text with improved formatting
        let entryText = `<span class="highlight-number-text">${highlight.number}.</span> You wrote "${highlight.text}" - ${categoryText}`;

        // Add correction ONLY if meaningful notes exist (exclude "no notes" message)
        let correctionText = '';
        if (highlight.notes &&
            highlight.notes.trim() &&
            highlight.notes.trim() !== '' &&
            !highlight.notes.includes('**no notes have been entered**')) {

            if (!highlight.notes.includes('→')) {
                correctionText = `<div class="correction-text"><strong>Correction:</strong> ${highlight.notes}</div>`;
            } else {
                // Extract correction from arrow format (e.g., "wekend→weekend")
                const parts = highlight.notes.split('→');
                if (parts.length === 2 && parts[1].trim()) {
                    correctionText = `<div class="correction-text"><strong>Correction:</strong> ${parts[1].trim()}</div>`;
                }
            }
        }
        // If no meaningful notes, correctionText remains empty - NO correction line will appear

        legendHTML += `
            <div class="highlight-entry ${cssClass}">
                <div style="line-height: 1.6; font-size: 14px;">
                    ${entryText}
                    ${correctionText}
                </div>
            </div>
        `;
    });

    legendHTML += `</div>`;
    return legendHTML;
}

/**
 * Enhance content for better PDF formatting
 * @param {HTMLElement} content - Content element to enhance (clone)
 * @param {string} studentName - Student name
 * @param {HTMLElement} originalContent - Original content element for data extraction
 * @returns {string} Enhanced HTML content
 */
function enhanceContentForPDF(content, studentName, originalContent = null) {
    // Create a working copy in DOM for safer manipulation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content.innerHTML;

    // Copy textarea values from original to cloned elements by matching data attributes
    const originalTextareas = content.querySelectorAll('textarea');
    originalTextareas.forEach((original) => {
        // Find matching textarea in clone by data-category attribute
        const category = original.dataset.category;
        if (category) {
            const clonedTextarea = tempDiv.querySelector(`textarea[data-category="${category}"]`);
            if (clonedTextarea) {
                clonedTextarea.value = original.value;
                clonedTextarea.textContent = original.value;
                clonedTextarea.innerHTML = original.value;
                console.log(`📝 Copied textarea value for category ${category}: "${original.value}"`);
            }
        } else {
            // Fallback: match by class or id if no data-category
            const className = original.className;
            const id = original.id;
            let clonedTextarea = null;

            if (id) {
                clonedTextarea = tempDiv.querySelector(`textarea#${id}`);
            } else if (className) {
                clonedTextarea = tempDiv.querySelector(`textarea.${className.split(' ')[0]}`);
            }

            if (clonedTextarea) {
                clonedTextarea.value = original.value;
                clonedTextarea.textContent = original.value;
                clonedTextarea.innerHTML = original.value;
                console.log(`📝 Copied textarea value for ${id || className}: "${original.value}"`);
            }
        }
    });

    // Copy input values from original to cloned elements (for score inputs)
    const originalInputs = content.querySelectorAll('input[type="number"], .editable-score');
    originalInputs.forEach((original) => {
        // Find matching input in clone by id first, then by class/attributes
        let clonedInput = null;

        // Try multiple ways to find the matching cloned input
        if (original.id) {
            clonedInput = tempDiv.querySelector(`#${original.id}`);
        } else if (original.dataset.category) {
            clonedInput = tempDiv.querySelector(`.editable-score[data-category="${original.dataset.category}"]`) ||
                         tempDiv.querySelector(`input[data-category="${original.dataset.category}"]`);
        } else if (original.className) {
            clonedInput = tempDiv.querySelector(`.${original.className.split(' ')[0]}`);
        }

        if (clonedInput) {
            clonedInput.value = original.value;
            clonedInput.setAttribute('value', original.value);
            console.log(`🔢 Copied input value for ${original.id || original.className}: "${original.value}"`);
        }
    });

    // Remove all no-print elements (including color legend)
    tempDiv.querySelectorAll('.no-print').forEach(element => element.remove());

    // Remove "Grading Results for [student name]" heading
    const resultsHeading = tempDiv.querySelector('h2');
    if (resultsHeading && resultsHeading.textContent.includes('Grading Results for')) {
        resultsHeading.remove();
    }

    // Extract and process teacher notes - ENHANCED WITH MULTIPLE FALLBACKS
    let teacherNotesSection = '';

    // Try multiple selectors to find teacher notes
    const teacherNotesElement = tempDiv.querySelector('.teacher-notes') ||
                               tempDiv.querySelector('[class*="teacher-notes"]') ||
                               tempDiv.querySelector('[data-section="teacher-notes"]');

    console.log('🔍 Looking for teacher notes element:', !!teacherNotesElement);

    // Also check the original content (not just the clone) for saved data
    // Use originalContent if provided, otherwise fall back to content
    const sourceForOriginal = originalContent || content;
    const originalTeacherNotes = sourceForOriginal.querySelector('.teacher-notes');
    const savedNotesFromDataset = originalTeacherNotes?.dataset?.teacherNotes;
    console.log('📊 Saved notes from dataset:', savedNotesFromDataset);

    // Check window.currentGradingData as another fallback
    const globalTeacherNotes = window.currentGradingData?.teacher_notes;
    console.log('🌐 Global teacher notes:', globalTeacherNotes);

    let notesText = '';

    if (teacherNotesElement) {
        console.log('📝 Found teacher notes element:', teacherNotesElement.innerHTML);
        // Remove pencil icons and edit indicators
        teacherNotesElement.querySelectorAll('.edit-indicator').forEach(el => el.remove());
        teacherNotesElement.querySelectorAll('span').forEach(el => {
            if (el.textContent.includes('✎')) {
                el.remove();
            }
        });

        // Check if notes are in a .teacher-notes-content span (edited notes) or directly in the element (GPT notes)
        const notesContentSpan = teacherNotesElement.querySelector('.teacher-notes-content');

        if (notesContentSpan) {
            // For edited notes, get content from the span
            notesText = notesContentSpan.textContent?.trim() || '';
            console.log('📝 Found teacher notes in content span:', `"${notesText}"`);
        } else {
            // For GPT notes, get content directly from the element
            notesText = teacherNotesElement.textContent?.replace(/📝\s*Teacher Notes:\s*/i, '').replace(/✎/g, '').trim();
            console.log('📝 Found teacher notes in element text:', `"${notesText}"`);
        }
    }

    // Fallback to dataset if no notes found
    if ((!notesText || notesText === 'No notes provided') && savedNotesFromDataset) {
        notesText = savedNotesFromDataset;
        console.log('📂 Using saved notes from dataset:', notesText);
    }

    // Fallback to global data if still no notes
    if ((!notesText || notesText === 'No notes provided') && globalTeacherNotes) {
        notesText = globalTeacherNotes;
        console.log('🌍 Using global teacher notes:', notesText);
    }

    if (notesText && notesText !== 'No notes provided' && notesText !== 'Manual grading notes') {
        console.log('✅ Teacher notes passed validation, creating section');
        teacherNotesSection = `
            <div class="teacher-notes-section" style="margin: 10px 0 !important; padding: 0 !important; background: transparent !important; border: none !important;">
                <p style="margin: 10px 0 !important; padding: 0 !important; line-height: 1.6 !important; color: black !important; font-weight: normal !important; background: transparent !important; border: none !important;">${notesText}</p>
            </div>
        `;
        // Remove the original teacher notes element if it exists to prevent duplication
        if (teacherNotesElement) {
            teacherNotesElement.remove();
        }
    } else {
        console.log('⚠️ No valid teacher notes found after checking all sources');
    }

    // Simplify overall score to plain text with Grade: prefix and no color
    const overallScoreElement = tempDiv.querySelector('.overall-score');
    if (overallScoreElement) {
        const scoreMatch = overallScoreElement.textContent.match(/([\d.]+)\/([\d.]+)/);
        if (scoreMatch) {
            const parts = scoreMatch[0].split('/');
            const score = parseFloat(parts[0]);
            const total = parseFloat(parts[1]);

            // Replace with extra large plain text, no percentage, no color
            overallScoreElement.innerHTML = `<p style="margin: 15px 0; font-weight: normal; color: black; font-size: 40px;">Grade: ${score}/${total}</p>`;

            // Remove all styling classes and inline styles
            overallScoreElement.className = '';
            overallScoreElement.removeAttribute('style');
        }
    }

    // Remove "Next Steps to Improve" sections
    tempDiv.querySelectorAll('.next-steps').forEach(el => el.remove());
    tempDiv.querySelectorAll('h3, h4, h5, h6').forEach(heading => {
        if (heading.textContent.includes('Next Steps to Improve')) {
            heading.remove();
        }
    });

    // Remove category selector bars (interactive elements not needed in PDF)
    tempDiv.querySelectorAll('#categoryBar, [id^="categoryBar-"]').forEach(el => el.remove());
    tempDiv.querySelectorAll('.category-btn, #clearSelectionBtn, [id^="clearSelectionBtn-"]').forEach(el => el.remove());
    tempDiv.querySelectorAll('#selectionStatus, [id^="selectionStatus-"]').forEach(el => el.remove());

    // Remove ALL formatting from score sections and category breakdowns
    // First, remove score-box and inner-box elements completely
    tempDiv.querySelectorAll('.score-box, .inner-box').forEach(box => {
        // Extract text content before removing
        const textContent = box.textContent;
        const textNode = document.createTextNode(textContent);
        box.parentNode.replaceChild(textNode, box);
    });

    // Remove any parent category-breakdown containers
    tempDiv.querySelectorAll('.category-breakdown').forEach(container => {
        // Move children out and remove the container
        while (container.firstChild) {
            container.parentNode.insertBefore(container.firstChild, container);
        }
        container.remove();
    });

    // Convert score sections to plain text format
    const scoreSections = tempDiv.querySelectorAll('.score-section, .category, .category-feedback, [class*="score"]');
    console.log(`Found ${scoreSections.length} score sections to process`);
    scoreSections.forEach((section, index) => {
        console.log(`Processing section ${index}:`, section.className, section.innerHTML.substring(0, 200) + '...');
        // Extract category name from h3/h4/strong elements
        const categoryNameEl = section.querySelector('h3, h4, strong');
        let categoryName = categoryNameEl ? categoryNameEl.textContent.trim() : '';

        // If no category name found in h3/h4/strong, check for other patterns
        if (!categoryName) {
            // Try to find category name from the section content
            const textContent = section.textContent;
            // Common category names
            const categories = ['Grammar', 'Vocabulary', 'Spelling', 'Mechanics', 'Fluency', 'Layout', 'Content'];
            for (const cat of categories) {
                if (textContent.includes(cat)) {
                    categoryName = cat;
                    break;
                }
            }
        }

        // Clean up category name (remove colons, etc)
        categoryName = categoryName.replace(/[:]/g, '').replace(/&.*$/, '').trim();

        // Normalize text for pattern matching
        const allText = section.textContent.replace(/\s+/g, ' ').trim();

        // Define score patterns (support decimals)
        const scorePatterns = [
            /\[([\d.]+)\]\s*\/\s*([\d.]+)/,     // [13.5] /15
            /([\d.]+)\s*\/\s*([\d.]+)/,         // 13.5/15 or 13.5 /15
            /([\d.]+)\s+([\d.]+)/,              // 13.5 15 (separated numbers)
            /\[([\d.]+)\]\s+([\d.]+)/,          // [13.5] 15
        ];

        // Extract score - prioritize manual grading inputs by ID, then other input types
        let scoreText = '';

        // First check for manual grading inputs by specific ID
        const categoryMap = {
            'Grammar': 'grammar',
            'Vocabulary': 'vocabulary',
            'Spelling': 'spelling',
            'Mechanics': 'mechanics',
            'Mechanics & Punctuation': 'mechanics',
            'Fluency': 'fluency',
            'Layout': 'layout',
            'Layout & Follow Specs': 'layout',
            'Content': 'content',
            'Content & Information': 'content'
        };
        const categoryId = categoryMap[categoryName] || categoryName.toLowerCase();
        // Look for score inputs within this section only (no global lookups)
        const scoreInput = section.querySelector('input.editable-score, input[type="number"]') ||
                          section.querySelector(`input#score-${categoryId}`);
        const editableStatScore = section.querySelector('.editable-stat-score');

        if (scoreInput) {
            const score = scoreInput.value || '0';
            const max = scoreInput.getAttribute('max') || scoreInput.dataset.max || '15';
            scoreText = `${score}/${max}`;
            console.log(`Found scoreInput for ${categoryName}: ${scoreText}`);
        } else if (editableStatScore) {
            // Extract score from editable stat score element (GPT grading with manual edits)
            scoreText = editableStatScore.textContent.trim();
            console.log(`Found editableStatScore for ${categoryName}: ${scoreText}`);
        } else {
            // Try multiple patterns to catch broken formatting
            for (const pattern of scorePatterns) {
                const match = allText.match(pattern);
                if (match) {
                    scoreText = `${match[1]}/${match[2]}`;
                    break;
                }
            }

            // If still no match, try to find separate numbers (including decimals)
            if (!scoreText) {
                const numbers = allText.match(/[\d.]+/g);
                if (numbers && numbers.length >= 2) {
                    // Usually first number is score, second is total
                    scoreText = `${numbers[0]}/${numbers[1]}`;
                }
            }
        }

        // Extract comments/feedback - first check for textarea elements (manual grading)
        let comments = '';
        const feedbackTextarea = section.querySelector('textarea.editable-feedback, textarea');
        console.log(`  Looking for textarea in section for ${categoryName}:`, !!feedbackTextarea);
        if (feedbackTextarea) {
            // Get the textarea value from the cloned element (values were already copied correctly)
            const category = feedbackTextarea.dataset.category || categoryName.toLowerCase();

            // Use the cloned textarea value (which was copied from the correct original)
            let textareaValue = feedbackTextarea.value || feedbackTextarea.textContent || feedbackTextarea.innerHTML || '';
            console.log(`  Using cloned textarea for ${category}, value: "${feedbackTextarea.value}"`);

            console.log(`  Textarea found, value: "${feedbackTextarea.value}"`);
            console.log(`  Textarea textContent: "${feedbackTextarea.textContent}"`);
            console.log(`  Textarea innerHTML: "${feedbackTextarea.innerHTML}"`);
            console.log(`  Final textareaValue: "${textareaValue}"`);
            console.log(`  Textarea classes:`, feedbackTextarea.className);

            if (textareaValue && textareaValue.trim()) {
                const cleanValue = textareaValue.trim();
                // Don't filter out manual textarea content - use it as-is
                if (cleanValue.length > 0 &&
                    !cleanValue.match(/^Click to add notes/i) &&
                    !cleanValue.match(/^No feedback provided/i)) {
                    comments = cleanValue;
                    console.log(`  Using textarea content as comments: "${comments}"`);
                } else {
                    console.log(`  Textarea content filtered out: "${cleanValue}"`);
                }
            } else {
                console.log(`  Textarea is empty or whitespace only`);
            }
        } else {
            // Try to find comments after the score
            // Use the first successful pattern match from above
            let scoreMatch = null;
            for (const pattern of scorePatterns) {
                scoreMatch = allText.match(pattern);
                if (scoreMatch) break;
            }

            if (scoreMatch) {
                const scoreIndex = allText.indexOf(scoreMatch[0]);
                // Get text after the score
                const afterScore = allText.substring(scoreIndex + scoreMatch[0].length).trim();

                // Clean up the comments
                const cleanedComments = afterScore
                    .replace(/✎/g, '')
                    .replace(/Click to edit/gi, '')
                    .replace(/Click to add notes.*?\.\.\./gi, '')
                    .replace(/Next Steps.*$/i, '')
                    .replace(/^Comments?:\s*/i, '')
                    .replace(/^Notes?:\s*/i, '')
                    .replace(/No feedback provided/gi, '')
                    .replace(/\.\.\./g, '')
                    .trim();

                if (cleanedComments && cleanedComments.length > 0 &&
                    !cleanedComments.match(/^\d+\s*\/\s*\d+/) &&
                    !cleanedComments.match(/^Click/i)) {
                    comments = cleanedComments;
                }
            }
        }

        // Replace the entire section with plain text format
        if (categoryName && scoreText) {
            // Debug logging
            console.log(`Processing category: ${categoryName}, Score: ${scoreText}, Comments: "${comments}"`);
            console.log('🟡 Creating category element with yellow highlighting');

            // Include notes inline with category header if there are comments
            const notesInline = (comments && comments.length > 0) ? ` (${comments})` : '';

            let plainTextHTML = `
                <div class="plain-category" style="margin: 8px 0 !important; padding: 0 !important; background: transparent !important; border: none !important;">
                    <p class="category-header-yellow" style="margin: 5px 0 !important; padding: 2px 4px !important; font-weight: bold !important; color: black !important; background: #FFFF99 !important; background-color: #FFFF99 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: none !important;">${categoryName}: ${scoreText}${notesInline}</p>`;

            if (comments && comments.length > 0) {
                console.log(`Added inline notes for ${categoryName}: ${comments}`);
            } else {
                console.log(`No notes found for ${categoryName}`);
            }

            plainTextHTML += `
                </div>
            `;
            // Completely replace the section
            const newDiv = document.createElement('div');
            newDiv.innerHTML = plainTextHTML;
            const newElement = newDiv.firstElementChild; // Use firstElementChild instead of firstChild

            // Strip style attributes but PRESERVE yellow highlighting
            if (newElement && newElement.nodeType === 1) { // Check if it's an element node
                newElement.removeAttribute('style');
                // Keep plain-category class for later processing

                newElement.querySelectorAll('*').forEach(child => {
                    if (child.nodeType === 1) { // Only process element nodes
                        // DON'T remove styles/classes from category-header-yellow elements
                        if (!child.classList.contains('category-header-yellow')) {
                            child.removeAttribute('style');
                            child.removeAttribute('class');
                        } else {
                            console.log('🟡 Preserving yellow highlighting for:', child.textContent.substring(0, 50));
                        }
                    }
                });
                section.parentNode.replaceChild(newElement, section);
            }
        }
    });

    // Clean up essay content positioning issues
    const essayContentElements = tempDiv.querySelectorAll('.essay-content, .formatted-essay-content, .essay-display');
    essayContentElements.forEach(essayEl => {
        // Remove any inline styles that might cause positioning issues
        essayEl.removeAttribute('style');

        // Clean up any problematic attributes on child elements
        const childElements = essayEl.querySelectorAll('*');
        childElements.forEach(child => {
            // Remove positioning and float styles
            if (child.style) {
                child.style.position = '';
                child.style.float = '';
                child.style.marginLeft = '';
                child.style.marginRight = '';
                child.style.textIndent = '';
                child.style.paddingLeft = '';
                child.style.paddingRight = '';
                child.style.top = '';
                child.style.left = '';
                child.style.transform = '';
            }
        });
    });

    // Add structural wrappers for better page break control
    const scoreSectionsForWrapper = tempDiv.querySelectorAll('.score-section');
    scoreSectionsForWrapper.forEach(section => {
        // Wrap each score section in a page-break-safe container
        const wrapper = document.createElement('div');
        wrapper.className = 'score-section-wrapper';
        wrapper.style.cssText = 'page-break-inside: avoid; break-inside: avoid; margin: 10px 0;';

        section.parentNode.insertBefore(wrapper, section);
        wrapper.appendChild(section);
    });

    // Find and wrap the color-coded essay section with its title
    const essayTitles = tempDiv.querySelectorAll('h3, h2');
    essayTitles.forEach(title => {
        if (title.textContent.toLowerCase().includes('color-coded essay')) {
            // Create a wrapper for the entire color-coded essay section
            const wrapper = document.createElement('div');
            wrapper.className = 'color-coded-essay-wrapper';
            wrapper.style.cssText = 'page-break-inside: avoid; break-inside: avoid; margin: 20px 0;';

            // Find the next few elements that belong to the essay
            let nextElement = title.nextElementSibling;
            const elementsToWrap = [title];

            while (nextElement && !nextElement.textContent.toLowerCase().includes('highlights and corrections')) {
                elementsToWrap.push(nextElement);
                nextElement = nextElement.nextElementSibling;
                // Stop if we've found enough essay-related content
                if (elementsToWrap.length > 10) break;
            }

            if (elementsToWrap.length > 0) {
                title.parentNode.insertBefore(wrapper, title);
                elementsToWrap.forEach(element => {
                    wrapper.appendChild(element);
                });
            }
        }
    });

    // Add Category Breakdown header if we have score sections and no existing header
    const firstScoreSection = tempDiv.querySelector('.score-section, div[style*="margin: 8px 0"], .plain-category');
    const existingCategoryHeader = tempDiv.querySelector('h3, h2, h4');
    let hasCategoryBreakdownHeader = false;

    if (existingCategoryHeader) {
        const allHeaders = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
        allHeaders.forEach(header => {
            if (header.textContent.includes('Category Breakdown')) {
                hasCategoryBreakdownHeader = true;
            }
        });
    }

    if (firstScoreSection && firstScoreSection.textContent.includes('/') && !hasCategoryBreakdownHeader) {
        const categoryHeader = document.createElement('div');
        categoryHeader.innerHTML = '<p style="margin: 15px 0 10px 0; font-weight: normal; font-size: 14px; color: black;">Category Breakdown:</p>';
        firstScoreSection.parentNode.insertBefore(categoryHeader, firstScoreSection);
    }

    // Add teacher notes after Grade but before Category Breakdown
    if (teacherNotesSection) {
        console.log('✅ Adding teacher notes after Grade, before Category Breakdown');
        const teacherNotesDiv = document.createElement('div');
        teacherNotesDiv.innerHTML = teacherNotesSection;

        // Find the Grade element and Category Breakdown header or first score section
        const gradeElement = tempDiv.querySelector('.overall-score') ||
            Array.from(tempDiv.querySelectorAll('div, p')).find(el =>
                el.textContent.includes('Grade:') || el.style.fontSize === '2em');
        const categoryBreakdownHeader = Array.from(tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6, p')).find(el =>
                el.textContent.includes('Category Breakdown'));
        const firstScoreSection = tempDiv.querySelector('.score-section, div[style*="margin: 8px 0"], .plain-category');

        if (gradeElement && (categoryBreakdownHeader || firstScoreSection)) {
            // Insert after grade but before category breakdown
            const insertTarget = categoryBreakdownHeader || firstScoreSection;
            insertTarget.parentNode.insertBefore(teacherNotesDiv, insertTarget);
        } else if (gradeElement) {
            // If no category breakdown found, insert after grade
            gradeElement.parentNode.insertBefore(teacherNotesDiv, gradeElement.nextSibling);
        } else {
            // Fallback: insert at the top
            tempDiv.insertBefore(teacherNotesDiv, tempDiv.firstChild);
        }
    }

    // FINAL PASS: Selectively remove style attributes (preserve essay and highlight styling)
    tempDiv.querySelectorAll('*').forEach(element => {
        // Skip our special elements that need styling preserved
        if (element.textContent && (
            element.textContent.includes('Grade:') ||
            element.textContent.includes('Category Breakdown:') ||
            element.textContent.includes('Overall Notes:') ||
            element.textContent.includes('Color-Coded Essay') ||
            element.textContent.includes('Color-coded Essay') ||
            element.textContent.includes('Highlight Meanings:')
        )) {
            return;
        }

        // Preserve styling for essay content, highlights, and legend
        if (element.classList.contains('formatted-essay-content') ||
            element.classList.contains('essay-content') ||
            element.classList.contains('essay-display') ||
            element.tagName === 'MARK' ||
            element.dataset.category ||
            element.classList.contains('highlights-legend') ||
            element.classList.contains('highlight-entry') ||
            element.classList.contains('color-legend') ||
            element.className?.includes('legend-') ||
            element.closest('.color-legend')) {
            return; // Keep styling for these elements
        }

        // Check if this is a legend item by its parent
        const parent = element.parentElement;
        if (parent && (parent.classList.contains('color-legend') ||
            parent.textContent?.includes('Highlight Meanings:'))) {
            return; // Preserve legend item styling
        }

        // For category score sections, only remove excessive styling
        if (element.classList.contains('plain-category') ||
            element.closest('.plain-category')) {
            // Remove style but preserve yellow highlighting class
            if (!element.classList.contains('category-header-yellow')) {
                element.removeAttribute('style');
                element.removeAttribute('class');
                element.removeAttribute('id');
            } else {
                // Keep the yellow class AND yellow background styles for proper highlighting
                element.style.border = '';
                element.removeAttribute('id');
                // Ensure yellow background is preserved and strengthened
                element.style.backgroundColor = '#FFFF99';
                element.style.background = '#FFFF99';
                element.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
                element.style.setProperty('print-color-adjust', 'exact', 'important');
                console.log('🟡 Applied strong yellow highlighting to:', element.textContent.substring(0, 50));
            }
        }
    });

    // Final pass: Ensure all category headers have correct yellow highlighting
    const yellowHeaders = tempDiv.querySelectorAll('.category-header-yellow');
    console.log('🔍 Found .category-header-yellow elements for final pass:', yellowHeaders.length);

    yellowHeaders.forEach(header => {
        // Force yellow background with maximum strength
        header.style.setProperty('background-color', '#FFFF99', 'important');
        header.style.setProperty('background', '#FFFF99', 'important');
        header.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
        header.style.setProperty('print-color-adjust', 'exact', 'important');
        console.log('🟡 Final pass: Applied yellow highlighting to:', header.textContent.substring(0, 50));
    });

    // Get the cleaned HTML
    let htmlContent = tempDiv.innerHTML;

    // Teacher notes are now handled directly in the overall score processing above

    return htmlContent;
}

/**
 * Get display name for category
 * @param {string} category - Category identifier
 * @returns {string} Display name
 */
function getCategoryDisplayName(category) {
    const categoryMap = {
        'grammar': 'Grammar Error',
        'vocabulary': 'Vocabulary Error',
        'spelling': 'Spelling Error',
        'mechanics': 'Mechanics Error',
        'fluency': 'Fluency Error',
        'delete': 'Delete Word'
    };
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Create clean content for printing
 * @param {HTMLElement} resultsDiv - Results container
 * @param {string} studentName - Student name
 * @returns {string} HTML content for printing
 */
function createPrintContent(resultsDiv, studentName) {
    // Clone the results content
    const clone = resultsDiv.cloneNode(true);

    // Process highlights first (before removing interactive elements)
    const highlightsData = processHighlightsForPDF(clone);

    // Remove interactive elements
    const buttonsToRemove = clone.querySelectorAll('button, .category-btn, .remove-essay-btn, .manage-profiles-btn');
    buttonsToRemove.forEach(btn => btn.remove());

    // Remove onclick attributes
    const clickableElements = clone.querySelectorAll('[onclick]');
    clickableElements.forEach(el => {
        el.removeAttribute('onclick');
        el.style.cursor = 'default';
    });

    // Clean up editable elements
    const editableElements = clone.querySelectorAll('.editable-section');
    editableElements.forEach(el => {
        el.classList.remove('editable-section');
        el.removeAttribute('onclick');
        el.style.cursor = 'default';
    });

    // Remove specific sections that shouldn't appear in PDF
    const sectionsToRemove = [
        // Word count section
        '.word-count-section',
        '[data-section="word-count"]',

        // Transitions section
        '.transitions-section',
        '[data-section="transitions"]',

        // Class vocabulary section
        '.vocabulary-section',
        '.class-vocab-section',
        '[data-section="vocabulary"]',
        '[data-section="class-vocab"]',

        // Grammar section
        '.grammar-section',
        '[data-section="grammar"]',

        // Category selection instructions
        '.category-selection-instructions',
        '.category-bar-instructions'
    ];

    sectionsToRemove.forEach(selector => {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });

    // Remove category selection text and gray boxes (but preserve essay content)
    const textToRemove = [
        'Select category then highlight text, or highlight text then select category:',
        'Select a category to highlight errors:',
        'Choose highlighting category:'
    ];

    const allTextElements = clone.querySelectorAll('*');
    allTextElements.forEach(el => {
        // Only remove if it's exactly one of these texts, not if it contains essay content
        if (el.textContent && textToRemove.some(text =>
            el.textContent.trim() === text ||
            (el.textContent.includes(text) && el.textContent.length < 200) // Small elements only
        )) {
            // Don't remove if it contains essay content (look for formatted-essay-content)
            if (!el.querySelector('.formatted-essay-content') &&
                !el.classList.contains('formatted-essay-content') &&
                !el.closest('.formatted-essay-content')) {
                el.remove();
            }
        }
    });

    // Enhanced text-based removal for sections that appear above Category Breakdown
    const allElements = clone.querySelectorAll('div, section, p, h3, h4, strong, span');
    allElements.forEach(el => {
        const text = el.textContent?.trim().toLowerCase();
        if (text && (
            // Word count patterns
            text.includes('word count:') ||
            text.includes('word count =') ||
            text.includes('words:') ||
            text.match(/\bword count\b/) ||

            // Transitions patterns
            text.includes('transitions:') ||
            text.includes('transition words:') ||
            text.includes('transitions found:') ||
            text.match(/\btransitions?\b.*:/) ||

            // Class vocabulary patterns
            text.includes('class vocabulary:') ||
            text.includes('class vocab:') ||
            text.includes('vocabulary used:') ||
            text.includes('class vocabulary used:') ||
            text.match(/\bclass vocab\b/) ||

            // Grammar structures patterns
            text.includes('grammar structures:') ||
            text.includes('grammar structures used:') ||
            text.includes('grammatical structures:') ||
            text.match(/\bgrammar structures?\b/) ||

            // Remove "Highlight applied successfully" messages
            text.includes('highlight applied successfully') ||
            text.includes('highlight removed') ||
            text.includes('highlight updated') ||

            // Remove category selection status messages
            text.includes('selected category:') ||
            text.includes('now highlight text to apply') ||
            text.includes('select category then highlight') ||
            text.includes('highlight text then select category')
        )) {
            // Don't remove if it's part of essay content
            if (!el.querySelector('.formatted-essay-content') &&
                !el.classList.contains('formatted-essay-content') &&
                !el.closest('.formatted-essay-content')) {
                // Remove if it's a heading or small content section
                if (el.textContent.length < 300 || el.tagName?.match(/^H[1-6]$/) || el.tagName === 'STRONG') {
                    console.log('🗑️ Removing from PDF:', el.textContent.substring(0, 50) + '...');
                    el.remove();
                }
            }
        }
    });

    // Additional pass to remove parent containers that might now be empty or only contain unwanted content
    const containers = clone.querySelectorAll('div, section');
    containers.forEach(container => {
        const text = container.textContent?.trim().toLowerCase();
        if (text && text.length < 500 && (
            text.includes('word count') ||
            text.includes('transitions') ||
            text.includes('class vocab') ||
            text.includes('grammar structures')
        )) {
            // Don't remove if it contains essay content
            if (!container.querySelector('.formatted-essay-content') &&
                !container.classList.contains('formatted-essay-content') &&
                !container.closest('.formatted-essay-content')) {
                // Check if this container mostly contains the unwanted content
                const wordsInText = text.split(/\s+/).length;
                if (wordsInText < 50) { // Small containers
                    console.log('🗑️ Removing container from PDF:', text.substring(0, 50) + '...');
                    container.remove();
                }
            }
        }
    });

    // Process and enhance the content for better PDF formatting
    // Pass both the clone and the original resultsDiv for proper teacher notes extraction
    const enhancedContent = enhanceContentForPDF(clone, studentName, resultsDiv);

    // Create the print-friendly content (removed headers as requested)
    return `
        ${enhancedContent}

        ${highlightsData.length > 0 ? createHighlightsLegend(highlightsData) : ''}
    `;
}

/**
 * Create a fallback PDF with simple text content
 * @param {HTMLElement} resultsDiv - Results container
 * @param {string} studentName - Student name
 */
function createFallbackPDF(resultsDiv, studentName) {
    console.log('📋 Creating ultra-simple fallback PDF');

    // Create the simplest possible HTML content
    const simpleContent = document.createElement('div');

    // Get just the raw text content
    const rawText = resultsDiv.textContent || resultsDiv.innerText || 'No content available';
    const cleanText = rawText.replace(/\s+/g, ' ').trim();

    // Create ultra-basic HTML with no CSS styling
    simpleContent.innerHTML = `
        <h1>Essay Grading Report</h1>
        <h2>Student: ${studentName}</h2>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
        <br>
        <pre>${cleanText}</pre>
        <br>
        <p>Generated by Essay Grading Tool</p>
    `;

    console.log('📋 Ultra-simple fallback content created, length:', simpleContent.innerHTML.length);
    console.log('📋 Ultra-simple fallback content preview:', simpleContent.innerHTML.substring(0, 200));

    // Test if the element has actual dimensions
    document.body.appendChild(simpleContent);
    console.log('📋 Element dimensions - width:', simpleContent.offsetWidth, 'height:', simpleContent.offsetHeight);

    // Use the most basic options possible
    const ultraSimpleOpt = {
        margin: 1,
        filename: `${studentName}_grading_simple.pdf`,
        html2canvas: {
            scale: 1,
            backgroundColor: '#ffffff',
            logging: true
        },
        jsPDF: {
            unit: 'in',
            format: 'letter',
            orientation: 'portrait'
        }
    };

    console.log('📋 html2pdf appears to be broken, skipping to manual PDF creation...');
    document.body.removeChild(simpleContent);

    // Skip html2pdf entirely and use manual method
    createManualPDF(cleanText, studentName);
}

/**
 * Create PDF manually using jsPDF directly (last resort)
 */
function createManualPDF(textContent, studentName) {
    try {
        console.log('📋 Creating manual PDF using jsPDF directly');

        // Check if jsPDF is available - html2pdf bundles it differently
        let jsPDF;

        // First try window.jspdf (lowercase)
        if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
            console.log('📋 Found jsPDF at window.jspdf.jsPDF');
        }
        // Try window.jsPDF
        else if (typeof window.jsPDF !== 'undefined') {
            jsPDF = window.jsPDF;
            console.log('📋 Found jsPDF at window.jsPDF');
        }
        // Try to create a temporary html2pdf instance and extract jsPDF
        else if (typeof html2pdf !== 'undefined') {
            try {
                const tempWorker = html2pdf();
                // html2pdf uses jsPDF internally, try to access it
                jsPDF = tempWorker.get ? tempWorker.get('jsPDF') : null;
                if (!jsPDF) {
                    // Try accessing the jsPDF from the html2pdf function itself
                    jsPDF = html2pdf.jsPDF || html2pdf().jsPDF;
                }
                console.log('📋 Extracted jsPDF from html2pdf');
            } catch (e) {
                console.log('📋 Could not extract jsPDF from html2pdf:', e);
            }
        }

        if (!jsPDF) {
            console.error('❌ jsPDF not available. Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('pdf')));
            alert('PDF generation requires jsPDF library. Please refresh the page and try again.');
            return;
        }

        console.log('📋 Creating PDF with jsPDF...');
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(16);
        doc.text('Essay Grading Report', 20, 20);

        // Add student name
        doc.setFontSize(12);
        doc.text(`Student: ${studentName}`, 20, 35);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);

        // Add content (split into lines to fit page)
        const lines = doc.splitTextToSize(textContent, 170);
        doc.text(lines, 20, 60);

        // Save the PDF
        doc.save(`${studentName}_grading_manual.pdf`);

        console.log('✅ Manual PDF generation completed');
        alert('PDF generated using manual method.');

    } catch (error) {
        console.error('❌ Manual PDF generation failed:', error);

        // Final fallback - create a downloadable text file
        console.log('📋 Creating downloadable text file as final fallback...');
        createTextFile(textContent, studentName);
    }
}

/**
 * Create a downloadable text file (final fallback)
 */
function createTextFile(textContent, studentName) {
    try {
        console.log('📋 Creating downloadable text file');

        const fileContent = `Essay Grading Report
Student: ${studentName}
Generated: ${new Date().toLocaleDateString()}
=====================================

${textContent}

=====================================
Generated by Essay Grading Tool`;

        // Create blob and download
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `${studentName}_grading_results.txt`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(url);

        console.log('✅ Text file download completed');
        alert('PDF generation failed, but grading results have been downloaded as a text file.');

    } catch (error) {
        console.error('❌ Even text file creation failed:', error);
        alert('All export methods failed. Please copy the grading results manually.');
    }
}

/**
 * Export manual grading to PDF
 */
function exportManualToPDF() {
    console.log('🎯 EXPORT MANUAL TO PDF CALLED');

    // Try different possible containers
    let manualContainer = document.getElementById('manualResults');
    if (!manualContainer) {
        manualContainer = document.getElementById('manualGradingContainer');
    }

    if (!manualContainer || manualContainer.style.display === 'none' || !manualContainer.innerHTML.trim()) {
        alert('No manual grading results to export. Please complete manual grading first.');
        return;
    }

    console.log('📋 Manual container found:', manualContainer);
    console.log('📋 Manual content preview:', manualContainer.innerHTML.substring(0, 200));

    // CRITICAL: Sync all editable score values before export
    let totalScore = 0;
    let totalMax = 0;
    manualContainer.querySelectorAll('.editable-score').forEach(input => {
        // Ensure the input's value attribute matches its current value
        input.setAttribute('value', input.value);
        const score = parseFloat(input.value) || 0;
        const max = parseFloat(input.getAttribute('max')) || 0;
        totalScore += score;
        totalMax += max;
        console.log(`💾 Synced ${input.dataset.category}: ${input.value}/${input.getAttribute('max')}`);
    });

    // Fix floating point precision
    totalScore = Math.round(totalScore * 10) / 10;

    // Update the overall score display before export
    const overallScoreElement = manualContainer.querySelector('.overall-score');
    if (overallScoreElement) {
        const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
        overallScoreElement.innerHTML = `<div style="font-size: 2em; font-weight: bold; text-align: center; margin: 20px 0;">${totalScore}/${totalMax} (${percentage}%)</div>`;
        console.log(`📊 Updated overall score: ${totalScore}/${totalMax} (${percentage}%)`);
    }

    // Get student name - handle different possible formats
    const heading = manualContainer.querySelector('h2');
    let studentName = 'Student';

    if (heading) {
        const headingText = heading.textContent;
        // Remove various prefixes that might be in the heading
        studentName = headingText
            .replace('Manual Grading: ', '')
            .replace('Grading Results for ', '')
            .replace('Manual Grading for ', '')
            .trim();
    }

    console.log('📋 Using same reliable print dialog method for manual grading...');

    // Use the same reliable print dialog method as the main grading
    openPrintDialog(manualContainer, studentName);
}

/**
 * Create export content for single essay
 * @param {HTMLElement} resultsDiv - Results container
 * @param {string} studentName - Student name
 * @returns {HTMLElement} Export content element
 */
function createExportContent(resultsDiv, studentName) {
    console.log('📋 Creating export content for student:', studentName);
    console.log('📋 Results div content (first 500 chars):', resultsDiv.innerHTML.substring(0, 500));

    // Create very simple HTML for PDF
    const html = `
        <h1>Essay Grading Report</h1>
        <h2>Student: ${studentName}</h2>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
        <hr>
        ${extractSimpleContent(resultsDiv)}
        <hr>
        <p><em>Generated by Essay Grading Tool</em></p>
    `;

    // Create a simple div and set innerHTML
    const exportDiv = document.createElement('div');
    exportDiv.innerHTML = html;

    console.log('📋 Final export div content length:', exportDiv.innerHTML.length);
    console.log('📋 Final export div preview:', exportDiv.innerHTML.substring(0, 500));

    return exportDiv;
}

/**
 * Extract simple content from results div for PDF export
 * @param {HTMLElement} resultsDiv - Results container
 * @returns {string} Simple HTML content
 */
function extractSimpleContent(resultsDiv) {
    console.log('📋 Extracting content from results div...');

    // Extract the essential content as simple HTML
    const heading = resultsDiv.querySelector('h2');
    const feedbackSummary = resultsDiv.querySelector('.grading-summary') || resultsDiv.querySelector('.feedback-summary');
    const essayContent = resultsDiv.querySelector('.formatted-essay-content');

    console.log('📋 Found heading:', !!heading);
    console.log('📋 Found feedback summary:', !!feedbackSummary);
    console.log('📋 Found essay content:', !!essayContent);

    let content = '';

    // Always include the main heading
    if (heading) {
        content += `<h2 style="color: #333; margin: 20px 0;">${heading.textContent}</h2>`;
    }

    // Add feedback summary if exists
    if (feedbackSummary) {
        console.log('📋 Adding feedback summary, length:', feedbackSummary.innerHTML.length);
        content += `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Grading Summary</h3>
                ${feedbackSummary.innerHTML}
            </div>
        `;
    }

    // Add essay content if exists
    if (essayContent) {
        console.log('📋 Adding essay content, length:', essayContent.innerHTML.length);
        content += `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Essay Text</h3>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #ddd; line-height: 1.6;">
                    ${essayContent.innerHTML}
                </div>
            </div>
        `;
    }

    // If no specific content found, use a simplified version of the entire results div
    if (!content.trim()) {
        console.log('📋 No specific content found, using full results div');
        const clone = resultsDiv.cloneNode(true);

        // Remove interactive elements but preserve content
        const buttons = clone.querySelectorAll('button');
        buttons.forEach(btn => btn.remove());

        const inputs = clone.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const replacement = document.createElement('span');
            replacement.textContent = input.value || input.textContent || '';
            replacement.style.fontWeight = 'bold';
            if (input.parentNode) {
                input.parentNode.replaceChild(replacement, input);
            }
        });

        // Remove onclick attributes but keep content
        const clickableElements = clone.querySelectorAll('[onclick]');
        clickableElements.forEach(el => {
            el.removeAttribute('onclick');
            el.style.cursor = 'default';
        });

        content = clone.innerHTML;
    }

    console.log('📋 Final extracted content length:', content.length);
    console.log('📋 Final extracted content preview:', content.substring(0, 400));

    return content;
}

/**
 * Create export content for manual grading
 * @param {HTMLElement} manualContainer - Manual grading container
 * @param {string} studentName - Student name
 * @returns {HTMLElement} Export content element
 */
function createManualExportContent(manualContainer, studentName) {
    const exportDiv = document.createElement('div');
    exportDiv.style.cssText = `
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        line-height: 1.6;
        color: #333;
    `;

    // Add header
    const header = document.createElement('div');
    header.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
            <h1 style="margin: 0; color: #333;">Manual Grading Report</h1>
            <h2 style="margin: 10px 0 0 0; color: #666;">${studentName}</h2>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 14px;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
    `;

    // Extract essay text
    const essayDisplay = manualContainer.querySelector('.essay-display');
    const essayText = essayDisplay ? essayDisplay.textContent : '';

    // Extract scores and feedback
    const scoresData = extractManualScores();

    // Create content
    const content = document.createElement('div');
    content.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Essay Text</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: 'Times New Roman', serif;">
                ${essayText}
            </div>
        </div>

        <div style="margin-bottom: 30px;">
            <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Scoring Rubric</h3>
            ${createManualScoreTable(scoresData)}
        </div>

        ${scoresData.overallFeedback ? `
        <div style="margin-bottom: 30px;">
            <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Overall Feedback</h3>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff;">
                ${scoresData.overallFeedback}
            </div>
        </div>
        ` : ''}
    `;

    exportDiv.appendChild(header);
    exportDiv.appendChild(content);

    // Add footer
    const footer = document.createElement('div');
    footer.innerHTML = `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
            <p>Generated by Essay Grading Tool - Manual Grading Mode</p>
        </div>
    `;

    exportDiv.appendChild(footer);

    return exportDiv;
}

/**
 * Extract manual scores and feedback
 * @returns {Object} Scores and feedback data
 */
function extractManualScores() {
    const scores = {};
    let totalPoints = 0;
    let totalMax = 0;
    let overallFeedback = '';

    // Extract scores
    document.querySelectorAll('.manual-score-input').forEach(input => {
        const category = input.dataset.category;
        const points = parseFloat(input.value) || 0;
        const max = parseFloat(input.dataset.max) || 15;

        scores[category] = {
            points: points,
            max: max,
            feedback: ''
        };

        totalPoints += points;
        totalMax += max;
    });

    // Extract feedback
    document.querySelectorAll('.manual-feedback-input').forEach(textarea => {
        const category = textarea.id.replace('feedback-', '');
        if (scores[category]) {
            scores[category].feedback = textarea.value.trim();
        }
    });

    // Extract overall feedback
    const overallTextarea = document.getElementById('overallFeedback');
    if (overallTextarea) {
        overallFeedback = overallTextarea.value.trim();
    }

    return {
        scores: scores,
        totalPoints: totalPoints,
        totalMax: totalMax,
        percentage: totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0,
        overallFeedback: overallFeedback
    };
}

/**
 * Create manual score table for PDF
 * @param {Object} scoresData - Scores data object
 * @returns {string} HTML table string
 */
function createManualScoreTable(scoresData) {
    const categoryNames = {
        content: 'Content & Ideas',
        organization: 'Organization',
        language: 'Language Use',
        vocabulary: 'Vocabulary',
        grammar: 'Grammar',
        mechanics: 'Mechanics'
    };

    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Category</th>
                    <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">Score</th>
                    <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Feedback</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.entries(scoresData.scores).forEach(([category, data]) => {
        const categoryName = categoryNames[category] || category;
        const percentage = data.max > 0 ? Math.round((data.points / data.max) * 100) : 0;
        const scoreColor = getScoreColorForPDF(percentage);

        tableHTML += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 12px; font-weight: 500;">${categoryName}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: ${scoreColor}; font-weight: bold;">
                    ${data.points}/${data.max} (${percentage}%)
                </td>
                <td style="border: 1px solid #ddd; padding: 12px; font-style: ${data.feedback ? 'normal' : 'italic'}; color: ${data.feedback ? '#333' : '#999'};">
                    ${data.feedback || 'No feedback provided'}
                </td>
            </tr>
        `;
    });

    const totalPercentage = scoresData.percentage;
    const totalScoreColor = getScoreColorForPDF(totalPercentage);

    tableHTML += `
            </tbody>
            <tfoot>
                <tr style="background: #f8f9fa; font-weight: bold;">
                    <td style="border: 1px solid #ddd; padding: 12px;">Total Score</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: ${totalScoreColor}; font-size: 16px;">
                        ${scoresData.totalPoints}/${scoresData.totalMax} (${totalPercentage}%)
                    </td>
                    <td style="border: 1px solid #ddd; padding: 12px;"></td>
                </tr>
            </tfoot>
        </table>
    `;

    return tableHTML;
}

/**
 * Get score color for PDF (returns color codes that work in PDF)
 * @param {number} percentage - Score percentage
 * @returns {string} Color code
 */
function getScoreColorForPDF(percentage) {
    if (percentage >= 90) return '#28a745'; // Green
    if (percentage >= 80) return '#20c997'; // Teal
    if (percentage >= 70) return '#ffc107'; // Yellow
    if (percentage >= 60) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
}

/**
 * Remove interactive elements from cloned content
 * @param {HTMLElement} element - Element to clean
 */
function removeInteractiveElements(element) {
    // Remove buttons
    const buttons = element.querySelectorAll('button');
    buttons.forEach(btn => btn.remove());

    // Remove form inputs
    const inputs = element.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.type !== 'hidden') {
            const span = document.createElement('span');
            span.textContent = input.value || input.textContent || '';
            span.style.cssText = 'font-weight: bold; color: #007bff;';
            input.parentNode.replaceChild(span, input);
        }
    });

    // Remove onclick attributes
    const clickableElements = element.querySelectorAll('[onclick]');
    clickableElements.forEach(el => el.removeAttribute('onclick'));

    // Remove event listeners by cloning elements
    const elementsWithListeners = element.querySelectorAll('*');
    elementsWithListeners.forEach(el => {
        if (el.onclick || el.addEventListener) {
            const newEl = el.cloneNode(true);
            newEl.onclick = null;
            if (el.parentNode) {
                el.parentNode.replaceChild(newEl, el);
            }
        }
    });

    // Clean up category selection UI
    const categoryBars = element.querySelectorAll('#categoryBar, [id^="categoryBar-"]');
    categoryBars.forEach(bar => {
        bar.innerHTML = '<p style="font-style: italic; color: #666; padding: 10px;">Interactive highlighting tools removed for PDF export</p>';
    });

    // Simplify highlights for PDF
    const highlights = element.querySelectorAll('mark[data-category]');
    highlights.forEach(mark => {
        mark.style.cursor = 'default';
        mark.onclick = null;
        mark.title = `Highlighted as: ${mark.dataset.category}`;
    });
}

/**
 * Check if html2pdf library is loaded
 * @returns {boolean} True if library is available
 */
function isHTML2PDFLoaded() {
    return typeof html2pdf !== 'undefined';
}

/**
 * Initialize PDF export functionality
 */
function initializePDFExport() {
    // Check if html2pdf is loaded
    if (!isHTML2PDFLoaded()) {
        console.warn('html2pdf library not loaded. PDF export functionality will be limited.');
        return;
    }

    console.log('PDF export functionality initialized');
}

// Wait for html2pdf to load if not already available
if (!isHTML2PDFLoaded()) {
    // Add a check every 100ms for up to 5 seconds
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (isHTML2PDFLoaded() || attempts > 50) {
            clearInterval(checkInterval);
            if (isHTML2PDFLoaded()) {
                initializePDFExport();
            }
        }
    }, 100);
}

/**
 * Export individual essay from batch results to PDF using print dialog
 * @param {Object} essayData - Essay data containing essay and originalData
 */
function exportIndividualEssay(essayData) {
    console.log('🎯 EXPORT INDIVIDUAL ESSAY TO PDF CALLED');
    console.log('📋 Essay data:', essayData);

    if (!essayData || !essayData.essay || !essayData.originalData) {
        console.error('❌ Invalid essay data provided');
        alert('Error: Invalid essay data. Cannot export to PDF.');
        return;
    }

    const { essay, originalData } = essayData;
    const studentName = essay.studentName || 'Student';

    // Find the specific essay container in the batch results
    const essayContainer = document.getElementById(`batch-essay-${originalData.index || 0}`);

    if (!essayContainer || !essayContainer.innerHTML.trim()) {
        console.error('❌ Essay container not found or empty');
        alert('Error: Essay content not found. Please expand the student details first.');
        return;
    }

    console.log('📋 Essay container found:', essayContainer);
    console.log('📋 Container content length:', essayContainer.innerHTML.length);

    // Use the print dialog method (same as main export functionality)
    console.log('📋 Opening print dialog for individual essay...');
    openPrintDialog(essayContainer, studentName);
}

// Export functions for use in other modules
window.PDFExportModule = {
    exportToPDF,
    exportManualToPDF,
    exportIndividualEssay,
    initializePDFExport,
    isHTML2PDFLoaded,
    // Legacy compatibility
    exportManualResults: exportManualToPDF
};

// Also expose individual functions globally for compatibility
window.exportToPDF = exportToPDF;
window.exportManualToPDF = exportManualToPDF;
window.exportIndividualEssay = exportIndividualEssay;
window.downloadIndividualEssay = function(index) {
    // Wrapper function for batch download
    // Try multiple ways to get the essay data
    let essayData = window[`essayData_${index}`];

    if (!essayData) {
        essayData = window.batchResults?.essays?.[index];
    }

    if (!essayData && window.BatchProcessingModule) {
        // Delegate to the batch processing module
        return window.BatchProcessingModule.downloadIndividualEssay(index);
    }

    if (essayData) {
        exportIndividualEssay(essayData);
    } else {
        console.error('Essay data not found for index:', index);
        console.log('Available essay data keys:', Object.keys(window).filter(k => k.startsWith('essayData_')));
        alert('Error: Essay data not found. Please try again.');
    }
};

// Log successful loading
console.log('✅ PDF Export Module loaded successfully', {
    PDFExportModule: !!window.PDFExportModule,
    exportToPDF: !!window.exportToPDF,
    exportManualToPDF: !!window.exportManualToPDF,
    exportIndividualEssay: !!window.exportIndividualEssay
});