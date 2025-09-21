# HTML Template Extraction Documentation

## Overview
This document details the extraction of the HTML template from `server.js` and documents all server-side dependencies and dynamic content requirements.

## Files Created
- **`index.html`** - Clean, static HTML template ready for deployment
- **`HTML_EXTRACTION_DOCUMENTATION.md`** - This documentation file

## Template Variables and Dynamic Content Points

### 1. Class Profile Management
**Location:** `#classProfile` select element
**Server Dependency:** `/api/profiles` endpoint
**Dynamic Content:**
- Profile dropdown options populated from database
- Profile data includes: `id`, `name`, `cefrLevel`, `temperature`, `vocabulary`, `grammar`, `prompt`
- JavaScript function: `loadProfilesData()` and `updateProfileDropdown()`

### 2. Results Display
**Location:** `#results` div
**Server Dependency:** `/api/grade` and `/api/grade-batch` endpoints
**Dynamic Content:**
- Grading results with scores, feedback, and highlighted errors
- Batch grading results for multiple essays
- Error categories with color coding
- Interactive highlighting system

### 3. Profile Management Modal
**Location:** `#profilesList` div
**Server Dependency:** `/api/profiles` CRUD operations
**Dynamic Content:**
- List of existing profiles with edit/delete buttons
- Profile creation and editing forms
- Real-time updates after profile changes

### 4. Manual Grading Results
**Location:** `#manualResults` div
**Server Dependency:** Manual grading functionality (client-side heavy)
**Dynamic Content:**
- Interactive essay highlighting interface
- Category-based error marking
- Teacher notes and feedback system

## Server-Side API Endpoints Required

### 1. `/api/profiles` (GET)
- Returns list of class profiles
- Response format: `{ profiles: [{ id, name, cefrLevel, temperature, vocabulary, grammar, prompt }] }`

### 2. `/api/profiles` (POST)
- Creates new class profile
- Accepts profile data and returns created profile with ID

### 3. `/api/profiles/:id` (PUT)
- Updates existing profile
- Accepts updated profile data

### 4. `/api/profiles/:id` (DELETE)
- Deletes profile by ID

### 5. `/api/grade` (POST)
- Grades single essay
- Request: `{ studentText, prompt, studentName, classProfile, temperature }`
- Response: Detailed grading results with scores and feedback

### 6. `/api/grade-batch` (POST)
- Grades multiple essays in batch
- Request: `{ essays: [{ studentText, studentName }], prompt, classProfile, temperature }`
- Response: `{ results: [grading results for each essay] }`

## Static Assets Required

### Images
- `/images/LMGM.svg` - Main logo/branding image
- `/images/LMGM-favicon.png` - Favicon

### Public Directory Structure
```
public/
├── images/
│   ├── LMGM.svg
│   └── LMGM-favicon.png
└── (other static assets)
```

## JavaScript Functions That Need Implementation

### Core Functions (Currently Placeholders)
```javascript
// Profile Management
async function loadProfilesData()
function updateProfileDropdown()
function updateTemperatureDisplay(value)
function updateProfileTemperatureDisplay(value)

// Essay Management
function addAnotherEssay()
function removeEssay(index)

// Form Handling
async function handleGradingFormSubmit(e)
async function handleProfileFormSubmit(e)

// Results Display
function displayResults(result, requestData)
function displayBatchResults(result, data)
function displayStudentNamesProgressively(essays)

// Tab Management
function switchTab(tabName)
function initializeTabs()

// Modal Management
function openProfileModal()
function closeProfileModal()
function openHighlightEditModal()
function closeHighlightEditModal()
function openTeacherNotesModal()
function closeTeacherNotesModal()

// Manual Grading
function initializeManualGrading()
function handleTextSelection()
function addHighlight(category, text, position)
function editHighlight(highlightId)
function removeHighlight(highlightId)

// Highlighting System
function setupHighlightHandlers()
function createCategoryButtons()
function handleCategorySelection(category)
function saveHighlightChanges()

// Utility Functions
function makeModalDraggable(modalHeader, modalContent)
function showError(message)
function showLoading(show)
function validateForm(formData)
```

### Event Listeners Required
```javascript
// Form submissions
document.getElementById('gradingForm').addEventListener('submit', handleGradingFormSubmit)
document.getElementById('profileEditForm').addEventListener('submit', handleProfileFormSubmit)

// Profile management
document.getElementById('manageProfilesBtn').addEventListener('click', openProfileModal)
document.getElementById('closeModal').addEventListener('click', closeProfileModal)
document.getElementById('addNewProfile').addEventListener('click', showProfileForm)

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => switchTab(e.target.dataset.tab))
})

// Essay management
document.getElementById('addEssayBtn').addEventListener('click', addAnotherEssay)

// Modal interactions
document.getElementById('cancelEditBtn').addEventListener('click', closeHighlightEditModal)
document.getElementById('saveEditBtn').addEventListener('click', saveHighlightChanges)
document.getElementById('removeHighlightBtn').addEventListener('click', removeCurrentHighlight)

// Profile selection changes
document.getElementById('classProfile').addEventListener('change', handleProfileChange)

// Manual grading
document.getElementById('loadManualEssay').addEventListener('click', initializeManualGrading)
```

## Template Conversion Notes

### Changes Made During Extraction:
1. **Removed template literal syntax** - Cleaned up backticks and JavaScript interpolation
2. **Added DYNAMIC comments** - Marked all areas that need server-side data
3. **Escaped HTML entities** - Fixed apostrophes and other characters
4. **Added placeholder JavaScript** - Basic functions to prevent console errors
5. **Organized structure** - Proper HTML5 formatting and indentation
6. **Documented dependencies** - Clear comments about what needs server integration

### HTML5 Compliance:
- Valid DOCTYPE declaration
- Proper meta tags for responsive design
- Semantic HTML structure
- Accessible form labels and inputs
- ARIA-friendly modal implementations

## Deployment Considerations

### For Static Deployment:
1. **JavaScript extraction needed** - The complete JavaScript functionality from `server.js` (lines ~535-3177) needs to be extracted and added to the HTML file
2. **API endpoint configuration** - Update fetch URLs to point to correct backend server
3. **CORS configuration** - Ensure backend allows cross-origin requests if served from different domain
4. **Asset paths** - Verify image and asset paths are correct for deployment environment

### For Server-Side Rendering:
1. **Template engine integration** - Could be converted to EJS, Handlebars, or similar template engine
2. **Data injection points** - Replace DYNAMIC comments with actual template variables
3. **JavaScript bundling** - Consider splitting JavaScript into separate files for better maintainability

## Security Considerations
- **Input validation** - All form inputs should be validated both client and server-side
- **XSS protection** - Ensure proper escaping of user-generated content in results display
- **CSRF protection** - Implement CSRF tokens for state-changing operations
- **File upload security** - If implementing file upload for essays, ensure proper validation

## Performance Optimizations
- **JavaScript minification** - Minify the extracted JavaScript for production
- **CSS optimization** - Consider extracting inline styles to external CSS file
- **Image optimization** - Optimize SVG and PNG assets
- **Caching headers** - Implement proper caching for static assets

## Browser Compatibility
- **Modern features used**: CSS Grid, Flexbox, Fetch API, ES6+ JavaScript
- **Minimum supported**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Polyfills may be needed** for older browser support

This documentation provides a complete guide for implementing the extracted HTML template as a standalone application with proper server-side integration.