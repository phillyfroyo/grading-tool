# Inline Styles Documentation

## Overview
This document lists all inline styles found in the server.js file that should be moved to external CSS files for better maintainability and separation of concerns.

## Inline Styles Found in HTML Templates

### App Header Section
**Location**: Lines 275-276
```html
<div style="text-align: center; margin-bottom: 30px; padding: 30px 0; border-bottom: 2px solid #e9ecef;">
<img src="/images/LMGM.svg" alt="LMGM - Lean Mean Grading Machine" style="height: 120px; max-width: 100%;">
```
**Recommendation**: Move to `.app-header` and `.app-header img` classes in components.css ✅ (Already done)

### Tab System
**Location**: Lines 280-287
```html
<div class="tab-container" style="margin-bottom: 30px;">
<div class="tab-buttons" style="display: flex; border-bottom: 2px solid #e9ecef; margin-bottom: 20px;">
<button class="tab-button active" data-tab="gpt-grader" style="flex: 1; padding: 15px 20px; border: none; background: #007bff; color: white; cursor: pointer; border-radius: 8px 8px 0 0; margin-right: 2px; font-size: 16px; font-weight: bold;">
<button class="tab-button" data-tab="manual-grader" style="flex: 1; padding: 15px 20px; border: none; background: #f8f9fa; color: #6c757d; cursor: pointer; border-radius: 8px 8px 0 0; margin-left: 2px; font-size: 16px; font-weight: bold;">
```
**Recommendation**: Move to `.tab-container`, `.tab-buttons`, `.tab-button` classes in components.css ✅ (Already done)

### Form Controls
**Location**: Lines 301-305
```html
<div style="display: flex; gap: 10px; align-items: center;">
<select id="classProfile" name="classProfile" style="flex: 1;">
<button type="button" id="manageProfilesBtn" style="padding: 10px 15px; background: #28a745; white-space: nowrap;">
```
**Recommendation**: Move to `.form-control-group`, `.manage-profiles-btn` classes in components.css ✅ (Already done)

### Temperature Control
**Location**: Lines 319-322
```html
<div style="margin-top: 5px;">
<input type="range" id="temperature" name="temperature" min="0" max="1" step="0.1" value="0.3" style="width: 100%;" oninput="updateTemperatureDisplay(this.value)">
<div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-top: 5px;">
```
**Recommendation**: Move to `.temperature-control`, `.temperature-slider`, `.temperature-labels` classes in components.css ✅ (Already done)

### Essay Entry Management
**Location**: Lines 334-337
```html
<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
<label style="margin: 0; font-weight: 500;">Essay 1:</label>
<input type="text" class="student-name" placeholder="Student name (optional)" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px; width: 200px;">
<button type="button" class="remove-essay-btn" onclick="removeEssay(0)" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; display: none;">
```
**Recommendation**: Move to `.essay-entry`, `.essay-label`, `.student-name-input`, `.remove-essay-btn` classes in components.css ✅ (Already done)

### Button Groups
**Location**: Lines 344-346
```html
<div style="margin-top: 15px; display: flex; gap: 10px;">
<button type="button" id="addEssayBtn" onclick="addAnotherEssay()" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer;">
```
**Recommendation**: Move to `.essay-actions`, `.add-essay-btn` classes in components.css ✅ (Already done)

### Manual Grader Tab
**Location**: Lines 361-370
```html
<div class="tab-content" id="manual-grader-content" style="display: none;">
<textarea id="manualEssayInput" rows="15" placeholder="Paste the student's essay here..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
<button type="button" id="loadManualEssay" style="margin-top: 10px; background: #28a745; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer;">
```
**Recommendation**: Move to `.tab-content`, `.manual-essay-input`, `.load-manual-essay-btn` classes in components.css ✅ (Already done)

### Modal System
**Location**: Lines 455-456
```html
<div id="highlightEditModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
<div id="modalContent" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 500px; width: 90%; cursor: default;">
```
**Recommendation**: Move to `.modal`, `.modal-content` classes in components.css ✅ (Already done)

### Profile Management Buttons
**Location**: Lines 387-392, 437-440
```html
<button id="closeModal" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">&times;</button>
<button id="addNewProfile" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 15px; cursor: pointer;">
<button type="submit" style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer;">
<button type="button" id="cancelProfileForm" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
```
**Recommendation**: Move to `.modal-close-btn`, `.add-new-profile-btn`, `.save-profile-btn`, `.cancel-profile-btn` classes in components.css ✅ (Already done)

## JavaScript-Dependent Styles

### Dynamic Color Legend (PDF Export)
**Location**: Lines 2771-2774
```javascript
'<span style="color: #FF8C00; font-weight: bold; margin-left: 10px;">grammar</span>' +
'<span style="color: #00A36C; font-weight: bold; margin-left: 15px;">vocabulary</span>' +
'<span style="color: #DC143C; font-weight: bold; margin-left: 15px;">spelling</span>' +
```
**Recommendation**: Replace with CSS classes `.legend-grammar`, `.legend-vocabulary`, `.legend-spelling` ✅ (Classes created in print.css)

## Recommendations for Refactoring

1. **Remove all inline styles** from the HTML templates in server.js
2. **Add appropriate CSS classes** to HTML elements
3. **Link the external CSS files** in the HTML head section:
   ```html
   <link rel="stylesheet" href="/main.css">
   <link rel="stylesheet" href="/components.css">
   <link rel="stylesheet" href="/print.css" media="print">
   ```
4. **Update JavaScript** that generates HTML to use CSS classes instead of inline styles

## Benefits of This Refactoring

- **Better maintainability**: CSS is centralized and easier to update
- **Improved performance**: Styles can be cached by the browser
- **Better separation of concerns**: Markup and styling are properly separated
- **Easier responsive design**: Media queries and modern CSS features are easier to implement
- **Consistency**: Reusable styles promote design consistency across the application

## Next Steps

1. Update the HTML templates in server.js to use CSS classes instead of inline styles
2. Update JavaScript functions that generate HTML to use CSS classes
3. Add the CSS file links to the HTML head section
4. Test the application to ensure all styling is preserved
5. Consider implementing CSS custom properties (variables) for color schemes and spacing