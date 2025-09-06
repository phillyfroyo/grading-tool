// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { readFileSync, writeFileSync } from 'fs';
import { gradeEssay } from "./grader/grader.js";
import { formatGradedEssay, generateCSS } from "./grader/formatter.js";

// Load class profiles
function loadProfiles() {
  try {
    return JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
  } catch (error) {
    return { profiles: [] };
  }
}

function saveProfiles(profiles) {
  writeFileSync('./class-profiles.json', JSON.stringify(profiles, null, 2));
}

dotenv.config();
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Serve the main grading interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ESL Essay Grader</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .form-group {
                margin: 15px 0;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            textarea, input[type="text"], select {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
            }
            button {
                background: #007bff;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 4px;
                font-size: 16px;
                cursor: pointer;
            }
            button:hover {
                background: #0056b3;
            }
            button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            #results {
                margin-top: 30px;
                display: none;
            }
            .loading {
                text-align: center;
                padding: 20px;
                display: none;
            }
            .error {
                color: #dc3545;
                padding: 10px;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                margin: 10px 0;
            }
            
            /* Category button styles */
            .category-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .category-btn:active,
            .category-btn.selected {
                transform: translateY(0);
                outline: 3px solid rgba(0,0,0,0.2);
                outline-offset: -1px;
            }
            
            .category-btn:focus {
                outline: 2px solid #007bff;
                outline-offset: 2px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>ESL Essay Grader</h1>
            <form id="gradingForm">
                <div class="form-group">
                    <label for="studentName">Student Name (optional):</label>
                    <input type="text" id="studentName" name="studentName">
                </div>
                
                <div class="form-group">
                    <label for="classProfile">Class Profile:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <select id="classProfile" name="classProfile" required style="flex: 1;">
                            <option value="">Loading profiles...</option>
                        </select>
                        <button type="button" id="manageProfilesBtn" style="padding: 10px 15px; background: #28a745; white-space: nowrap;">
                            Manage Profiles
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="prompt">Assignment Prompt:</label>
                    <textarea id="prompt" name="prompt" rows="3" required 
                              placeholder="Enter the essay prompt or assignment instructions..."></textarea>
                </div>
                
                <div class="form-group">
                    <label for="studentText">Student Essay:</label>
                    <textarea id="studentText" name="studentText" rows="15" required 
                              placeholder="Paste the student's essay here..."></textarea>
                </div>
                
                <button type="submit" id="gradeButton">Grade Essay</button>
            </form>
            
            <div class="loading" id="loading">
                <p>Grading essay... This may take a few moments.</p>
            </div>
            
            <div id="results"></div>
        </div>

        <!-- Profile Management Modal -->
        <div id="profileModal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.4);">
            <div style="background-color: white; margin: 5% auto; padding: 20px; border-radius: 8px; width: 80%; max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>Manage Class Profiles</h2>
                    <button id="closeModal" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">&times;</button>
                </div>
                
                <div id="profilesList"></div>
                
                <button id="addNewProfile" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 15px; cursor: pointer;">
                    Add New Profile
                </button>
                
                <!-- Profile Form -->
                <div id="profileForm" style="display: none; margin-top: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <h3 id="profileFormTitle">Create New Profile</h3>
                    <form id="profileEditForm">
                        <input type="hidden" id="profileId">
                        <div class="form-group">
                            <label for="profileName">Profile Name:</label>
                            <input type="text" id="profileName" required placeholder="e.g. Business English B2 - Fall 2024">
                        </div>
                        <div class="form-group">
                            <label for="profileCefr">CEFR Level:</label>
                            <select id="profileCefr" required>
                                <option value="B2">B2 - Upper Intermediate</option>
                                <option value="C1">C1 - Advanced</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="profileVocab">Vocabulary (one per line):</label>
                            <textarea id="profileVocab" rows="6" placeholder="stakeholder&#10;revenue&#10;implement&#10;strategy&#10;collaborate"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="profileGrammar">Grammar Structures (one per line):</label>
                            <textarea id="profileGrammar" rows="4" placeholder="Present Perfect for experience&#10;Conditionals (2nd and 3rd)&#10;Passive voice"></textarea>
                        </div>
                        <div style="margin-top: 15px;">
                            <button type="submit" style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer;">
                                Save Profile
                            </button>
                            <button type="button" id="cancelProfileForm" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Custom Highlight Edit Modal -->
        <div id="highlightEditModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 500px; width: 90%;">
                <h3 id="modalTitle" style="margin-top: 0; color: #333; font-size: 20px;">✏️ Edit Highlight</h3>
                
                <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                    <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
                        Selected Text: "<span id="modalSelectedText" style="font-style: italic;"></span>"
                    </div>
                    <div style="font-size: 14px; color: #666;">
                        Category: <span id="modalCategory" style="font-weight: bold;"></span>
                    </div>
                </div>
                
                <div style="margin: 20px 0;">
                    <label for="modalFeedback" style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">
                        Teacher Feedback/Note:
                    </label>
                    <textarea id="modalFeedback" rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical;" placeholder="Enter your feedback or correction..."></textarea>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px;">
                    <button id="removeHighlightBtn" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        🗑️ Remove Highlight
                    </button>
                    <button id="cancelEditBtn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Cancel
                    </button>
                    <button id="saveEditBtn" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        💾 Save Changes
                    </button>
                </div>
            </div>
        </div>

        <script>
            // Load profiles on page load
            let profiles = [];
            
            async function loadProfilesData() {
                try {
                    const response = await fetch('/api/profiles');
                    const data = await response.json();
                    profiles = data.profiles || [];
                    updateProfileDropdown();
                } catch (error) {
                    console.error('Error loading profiles:', error);
                }
            }
            
            function updateProfileDropdown() {
                const select = document.getElementById('classProfile');
                select.innerHTML = '<option value="">Select a class profile...</option>';
                profiles.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile.id;
                    option.textContent = \`\${profile.name} (\${profile.cefrLevel})\`;
                    select.appendChild(option);
                });
            }
            
            // Load profiles when page loads
            loadProfilesData();
            
            document.getElementById('gradingForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData(this);
                const data = {
                    studentText: formData.get('studentText'),
                    prompt: formData.get('prompt'),
                    studentName: formData.get('studentName') || 'Anonymous',
                    classProfile: formData.get('classProfile')
                };
                
                // Show loading, hide results
                document.getElementById('loading').style.display = 'block';
                document.getElementById('results').style.display = 'none';
                document.getElementById('gradeButton').disabled = true;
                
                try {
                    const response = await fetch('/grade', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });
                    
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    
                    const result = await response.json();
                    displayResults(result, data);
                    
                } catch (error) {
                    console.error('Error:', error);
                    document.getElementById('results').innerHTML = 
                        '<div class="error">Error grading essay. Please try again.</div>';
                    document.getElementById('results').style.display = 'block';
                } finally {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('gradeButton').disabled = false;
                }
            });
            
            function displayResults(gradingResult, originalData) {
                const resultsDiv = document.getElementById('results');
                
                // Format the essay with color coding
                fetch('/format', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studentText: originalData.studentText,
                        gradingResults: gradingResult,
                        studentName: originalData.studentName,
                        editable: true
                    })
                })
                .then(response => response.json())
                .then(formatted => {
                    resultsDiv.innerHTML = \`
                        <h2>Grading Results for \${originalData.studentName}</h2>
                        \${formatted.feedbackSummary}
                        
                        <h3 style="margin: 20px 0 10px 0;">Color-Coded Essay:</h3>
                        
                        <div id="essayContainer" style="border: 1px solid #ddd; border-radius: 4px;">
                            <!-- Category selector bar -->
                            <div id="categoryBar" style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;">
                                <div style="margin-bottom: 5px; font-weight: bold; font-size: 14px;">Select category then highlight text, or highlight text then select category:</div>
                                <div id="categoryButtons" style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    <button class="category-btn" data-category="grammar" style="background: #A855F7; color: #FFFFFF; border: 2px solid #A855F7; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Grammar</button>
                                    <button class="category-btn" data-category="mechanics-punctuation" style="background: #6B7280; color: #FFFFFF; border: 2px solid #6B7280; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Mechanics & Punctuation</button>
                                    <button class="category-btn" data-category="redundancy" style="background: #84CC16; color: #111827; border: 2px solid #84CC16; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Redundancy</button>
                                    <button class="category-btn" data-category="vocabulary-structure" style="background: #06B6D4; color: #111827; border: 2px solid #06B6D4; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Vocabulary / Structure</button>
                                    <button class="category-btn" data-category="needs-rephrasing" style="background: #38BDF8; color: #111827; border: 2px solid #38BDF8; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Needs rephrasing</button>
                                    <button class="category-btn" data-category="non-suitable-words" style="background: #111827; color: #FFFFFF; border: 2px solid #111827; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Non-suitable words</button>
                                    <button class="category-btn" data-category="spelling" style="background: #EF4444; color: #FFFFFF; border: 2px solid #EF4444; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Spelling</button>
                                    <button class="category-btn" data-category="professor-comments" style="background: #FACC15; color: #111827; border: 2px solid #FACC15; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Professor's comments</button>
                                    <button id="clearSelectionBtn" onclick="clearSelection()" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>
                                </div>
                                <div id="selectionStatus" style="margin-top: 8px; font-size: 12px; color: #666; min-height: 16px;"></div>
                                
                                <!-- Correction Guide Legend -->
                                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; color: #666;">📖 Correction Guide:</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px; font-size: 10px;">
                                        <span style="background: #A855F7; color: #FFFFFF; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Grammar</span>
                                        <span style="background: #6B7280; color: #FFFFFF; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Mechanics & Punctuation</span>
                                        <span style="background: #84CC16; color: #111827; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Redundancy</span>
                                        <span style="background: #06B6D4; color: #111827; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Vocabulary / Structure</span>
                                        <span style="background: #38BDF8; color: #111827; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Needs rephrasing</span>
                                        <span style="background: #111827; color: #FFFFFF; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Non-suitable words</span>
                                        <span style="background: #EF4444; color: #FFFFFF; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Spelling</span>
                                        <span style="background: #FACC15; color: #111827; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Professor's comments</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Essay text area -->
                            <div class="formatted-essay-content" style="padding: 15px; line-height: 1.6; user-select: text;">
                                \${formatted.formattedText}
                            </div>
                        </div>
                        
                        <div style="margin-top: 20px;">
                            <button onclick="exportToPDF()">Export to PDF</button>
                            <button onclick="exportToHTML()">Export to HTML</button>
                        </div>
                    \`;
                    resultsDiv.style.display = 'block';
                    
                    // Add event listeners for editable elements
                    setupEditableElements(gradingResult, originalData);
                    
                    // Initialize essay editing
                    setTimeout(() => initializeEssayEditing(), 100);
                })
                .catch(error => {
                    console.error('Formatting error:', error);
                    resultsDiv.innerHTML = '<div class="error">Error formatting results.</div>';
                    resultsDiv.style.display = 'block';
                });
            }
            
            let currentGradingData = null;
            let currentOriginalData = null;
            
            function setupEditableElements(gradingResult, originalData) {
                currentGradingData = { ...gradingResult };
                currentOriginalData = { ...originalData };
                
                // Add listeners for score inputs
                document.querySelectorAll('.editable-score').forEach(input => {
                    input.addEventListener('input', function() {
                        const category = this.dataset.category;
                        const newPoints = parseInt(this.value) || 0;
                        const maxPoints = parseInt(this.max) || 15;
                        
                        // Validate range
                        if (newPoints < 0) this.value = 0;
                        if (newPoints > maxPoints) this.value = maxPoints;
                        
                        // Update data
                        currentGradingData.scores[category].points = parseInt(this.value);
                        
                        // Recalculate total score
                        updateTotalScore();
                    });
                });
                
                // Add listeners for feedback textareas
                document.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.addEventListener('input', function() {
                        const category = this.dataset.category;
                        currentGradingData.scores[category].rationale = this.value;
                    });
                });
            }
            
            function updateTotalScore() {
                let totalPoints = 0;
                let totalMaxPoints = 0;
                
                Object.values(currentGradingData.scores).forEach(score => {
                    totalPoints += score.points;
                    totalMaxPoints += score.out_of;
                });
                
                currentGradingData.total.points = totalPoints;
                currentGradingData.total.out_of = totalMaxPoints;
                
                // Update the displayed total score
                const overallScoreElement = document.querySelector('.overall-score');
                if (overallScoreElement) {
                    const percentage = Math.round((totalPoints / totalMaxPoints) * 100);
                    
                    const color = getScoreColor(percentage);
                    overallScoreElement.innerHTML = \`<div style="color: \${color}; font-size: 2em; font-weight: bold;">\${totalPoints}/\${totalMaxPoints}</div>\`;
                }
            }
            
            // Essay editing functionality - always on by default
            let selectedCategory = null;
            let selectedRange = null;
            let pendingSelection = null;
            
            // Category colors mapping
            // New rubric-aligned highlight categories
            const categoryColors = {
                'grammar': { color: '#FFFFFF', bg: '#A855F7' },
                'mechanics-punctuation': { color: '#FFFFFF', bg: '#6B7280' },
                'redundancy': { color: '#111827', bg: '#84CC16' },
                'vocabulary-structure': { color: '#111827', bg: '#06B6D4' },
                'needs-rephrasing': { color: '#111827', bg: '#38BDF8' },
                'non-suitable-words': { color: '#FFFFFF', bg: '#111827' },
                'spelling': { color: '#FFFFFF', bg: '#EF4444' },
                'professor-comments': { color: '#111827', bg: '#FACC15' }
            };

            // Legacy mapping for backward compatibility
            const legacyMapping = {
                'grammar': 'grammar',
                'vocabulary': 'vocabulary-structure', 
                'spelling': 'spelling',
                'mechanics': 'mechanics-punctuation',
                'content': 'needs-rephrasing',
                'layout': null // will need manual conversion
            };

            // Display order for toolbar
            const categoryOrder = [
                'grammar',
                'mechanics-punctuation', 
                'redundancy',
                'vocabulary-structure',
                'needs-rephrasing',
                'non-suitable-words',
                'spelling',
                'professor-comments'
            ];

            // Category display names
            const categoryNames = {
                'grammar': 'Grammar',
                'mechanics-punctuation': 'Mechanics & Punctuation',
                'redundancy': 'Redundancy', 
                'vocabulary-structure': 'Vocabulary / Structure',
                'needs-rephrasing': 'Needs rephrasing',
                'non-suitable-words': 'Non-suitable words',
                'spelling': 'Spelling',
                'professor-comments': "Professor's comments"
            };

            // Function to map legacy categories to new ones
            function mapLegacyCategory(oldCategory) {
                const mapping = legacyMapping[oldCategory];
                if (mapping === null) {
                    // Layout category - show conversion dialog
                    return showCategoryConversionDialog(oldCategory);
                }
                return mapping || oldCategory;
            }

            function showCategoryConversionDialog(oldCategory) {
                const newCategories = [
                    'grammar',
                    'mechanics-punctuation',
                    'redundancy', 
                    'vocabulary-structure',
                    'needs-rephrasing',
                    'non-suitable-words',
                    'spelling',
                    'professor-comments'
                ];
                
                const options = newCategories.map(cat => cat + ': ' + categoryNames[cat]).join('\\n');
                const choice = prompt('The category "' + oldCategory + '" is no longer available. Please choose a new category:\\n\\n' + options + '\\n\\nEnter the category key (e.g., \\'grammar\\'):');
                
                return newCategories.includes(choice) ? choice : 'professor-comments';
            }

            function migrateLegacyHighlights(essayContent) {
                const marks = essayContent.querySelectorAll('mark[data-type]');
                marks.forEach(mark => {
                    const oldCategory = mark.getAttribute('data-type');
                    if (!categoryColors[oldCategory]) {
                        const newCategory = mapLegacyCategory(oldCategory);
                        mark.setAttribute('data-type', newCategory);
                        
                        // Update styling
                        const colors = categoryColors[newCategory];
                        mark.style.cssText = 'background: ' + colors.bg + '; color: ' + colors.color + '; padding: 2px 4px; border-radius: 2px; position: relative; cursor: pointer;';
                    }
                });
            }
            
            function initializeEssayEditing() {
                const essayContent = document.querySelector('.formatted-essay-content');
                if (!essayContent) return;
                
                // Migrate any existing legacy highlights
                migrateLegacyHighlights(essayContent);
                
                // Add event listeners to category buttons
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        selectCategory(this.dataset.category);
                    });
                });
                
                // Add text selection listener to essay
                essayContent.addEventListener('mouseup', handleTextSelection);
                
                // Add click listeners to existing highlights for editing
                essayContent.querySelectorAll('mark').forEach(mark => {
                    mark.style.cursor = 'pointer';
                    mark.addEventListener('click', function(e) {
                        e.preventDefault();
                        editHighlight(this);
                    });
                });
                
                updateSelectionStatus('Ready to highlight. Select a category or highlight text.');
            }
            
            function selectCategory(category) {
                selectedCategory = category;
                
                // Update button visual states
                document.querySelectorAll('.category-btn').forEach(btn => {
                    if (btn.dataset.category === category) {
                        btn.style.transform = 'scale(1.05)';
                        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                    } else {
                        btn.style.transform = 'scale(1)';
                        btn.style.boxShadow = 'none';
                    }
                });
                
                updateSelectionStatus('Category "' + category + '" selected. Now select text to highlight.');
                
                // If we have pending text selection, apply it now
                if (pendingSelection) {
                    applyHighlight(pendingSelection.range, pendingSelection.text, category);
                    pendingSelection = null;
                }
            }
            
            function handleTextSelection(e) {
                const selection = window.getSelection();
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    const text = range.toString().trim();
                    
                    // Only proceed if we selected text within the essay content
                    if (text.length > 0 && document.querySelector('.formatted-essay-content').contains(range.commonAncestorContainer)) {
                        if (selectedCategory) {
                            // Category already selected, apply highlight immediately
                            applyHighlight(range, text, selectedCategory);
                        } else {
                            // No category selected, save selection for later
                            pendingSelection = { range: range.cloneRange(), text };
                            updateSelectionStatus('Text "' + text.substring(0, 50) + (text.length > 50 ? '...' : '') + '" selected. Now click a category to highlight it.');
                        }
                        selection.removeAllRanges();
                    }
                }
            }
            
            function applyHighlight(range, text, category) {
                const colors = categoryColors[category];
                const mark = document.createElement('mark');
                mark.setAttribute('data-type', category);
                mark.setAttribute('data-message', \`Manual \${category} highlight\`);
                mark.setAttribute('data-editable', 'true');
                mark.className = 'highlighted-segment';
                mark.style.cssText = 'background: ' + colors.bg + '; color: ' + colors.color + '; padding: 2px 4px; border-radius: 2px; position: relative; cursor: pointer;';
                mark.innerHTML = text + '<span class="edit-indicator" style="font-size: 10px; margin-left: 2px;">✎</span>';
                
                // Add click listener for editing
                mark.addEventListener('click', function(e) {
                    e.preventDefault();
                    editHighlight(this);
                });
                
                try {
                    range.deleteContents();
                    range.insertNode(mark);
                    updateSelectionStatus(\`"\${text.substring(0, 30)}\${text.length > 30 ? '...' : ''}" highlighted as \${category}.\`);
                } catch (error) {
                    console.error('Error adding highlight:', error);
                    updateSelectionStatus('Error adding highlight. Please try again.');
                }
                
                clearSelection();
            }
            
            let currentEditingElement = null;
            
            function editHighlight(markElement) {
                const category = markElement.getAttribute('data-type');
                const message = markElement.getAttribute('data-message');
                const text = markElement.textContent.replace('✎', '').trim();
                
                // Store reference to the element being edited
                currentEditingElement = markElement;
                
                // Populate modal
                document.getElementById('modalSelectedText').textContent = text;
                document.getElementById('modalCategory').textContent = category.charAt(0).toUpperCase() + category.slice(1);
                document.getElementById('modalFeedback').value = message.replace('Manual ', '').replace(' highlight', '');
                
                // Show modal
                document.getElementById('highlightEditModal').style.display = 'block';
            }
            
            // Modal event listeners
            document.addEventListener('DOMContentLoaded', function() {
                // Close modal when clicking background
                document.getElementById('highlightEditModal').addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeEditModal();
                    }
                });
                
                // Cancel button
                document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
                
                // Save button
                document.getElementById('saveEditBtn').addEventListener('click', function() {
                    if (currentEditingElement) {
                        const newNote = document.getElementById('modalFeedback').value.trim();
                        const category = currentEditingElement.getAttribute('data-type');
                        const finalNote = newNote || \`Manual \${category} highlight\`;
                        
                        currentEditingElement.setAttribute('data-message', finalNote);
                        currentEditingElement.title = finalNote;
                    }
                    closeEditModal();
                });
                
                // Remove highlight button
                document.getElementById('removeHighlightBtn').addEventListener('click', function() {
                    if (currentEditingElement) {
                        // Get the text content without the edit indicator
                        const textContent = currentEditingElement.textContent.replace('✎', '').trim();
                        
                        // Replace the marked element with plain text
                        const textNode = document.createTextNode(textContent);
                        currentEditingElement.parentNode.replaceChild(textNode, currentEditingElement);
                        
                        updateSelectionStatus('Highlight removed successfully.');
                    }
                    closeEditModal();
                });
            });
            
            function closeEditModal() {
                document.getElementById('highlightEditModal').style.display = 'none';
                currentEditingElement = null;
            }
            
            function clearSelection() {
                selectedCategory = null;
                pendingSelection = null;
                
                // Reset button styles
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = 'none';
                });
                
                updateSelectionStatus('Selection cleared. Ready to highlight again.');
                window.getSelection().removeAllRanges();
            }
            
            function updateSelectionStatus(message) {
                const statusDiv = document.getElementById('selectionStatus');
                if (statusDiv) {
                    statusDiv.textContent = message;
                }
            }

            // Functions for editing statistics and teacher notes
            function editTeacherNotes(element) {
                const currentContent = element.querySelector('.teacher-notes-content').textContent;
                const newNotes = prompt('Edit teacher notes:', currentContent);
                if (newNotes !== null && newNotes !== currentContent) {
                    element.querySelector('.teacher-notes-content').textContent = newNotes;
                    // Update the stored grading data
                    if (currentGradingData) {
                        currentGradingData.teacher_notes = newNotes;
                    }
                }
            }

            function editStat(element, statType) {
                const currentValue = element.querySelector('.stat-value').textContent.replace(/[^0-9]/g, '');
                const newValue = prompt(\`Edit \${statType === 'word_count' ? 'word count' : statType}:\`, currentValue);
                if (newValue !== null && !isNaN(newValue) && newValue !== currentValue) {
                    const intValue = parseInt(newValue);
                    element.querySelector('.stat-value').textContent = intValue;
                    // Update the stored grading data
                    if (currentGradingData && currentGradingData.meta) {
                        currentGradingData.meta[statType] = intValue;
                    }
                }
            }

            function editTransitions(element) {
                const detailElement = element.querySelector('.stat-detail');
                const currentTransitions = detailElement ? detailElement.textContent.replace(/[()]/g, '').split(', ') : [];
                const newTransitionsStr = prompt('Edit transitions (comma-separated):', currentTransitions.join(', '));
                if (newTransitionsStr !== null) {
                    const newTransitions = newTransitionsStr.split(',').map(t => t.trim()).filter(t => t);
                    element.querySelector('.stat-value').textContent = \`\${newTransitions.length} found\`;
                    if (detailElement) {
                        detailElement.textContent = newTransitions.length > 0 ? \`(\${newTransitions.join(', ')})\` : '';
                    }
                    // Update the stored grading data
                    if (currentGradingData && currentGradingData.meta) {
                        currentGradingData.meta.transition_words_found = newTransitions;
                    }
                }
            }

            function editVocabulary(element) {
                const detailElement = element.querySelector('.stat-detail');
                const currentVocab = detailElement ? detailElement.textContent.replace(/[()]/g, '').split(', ') : [];
                const newVocabStr = prompt('Edit class vocabulary words (comma-separated):', currentVocab.join(', '));
                if (newVocabStr !== null) {
                    const newVocab = newVocabStr.split(',').map(v => v.trim()).filter(v => v);
                    element.querySelector('.stat-value').textContent = \`\${newVocab.length} used\`;
                    if (detailElement) {
                        detailElement.textContent = newVocab.length > 0 ? \`(\${newVocab.join(', ')})\` : '';
                    }
                    // Update the stored grading data
                    if (currentGradingData && currentGradingData.meta) {
                        currentGradingData.meta.class_vocabulary_used = newVocab;
                    }
                }
            }

            function editGrammar(element) {
                const detailElement = element.querySelector('.stat-detail');
                const currentGrammar = detailElement ? detailElement.textContent.replace(/[()]/g, '').split(', ') : [];
                const newGrammarStr = prompt('Edit grammar structures (comma-separated):', currentGrammar.join(', '));
                if (newGrammarStr !== null) {
                    const newGrammar = newGrammarStr.split(',').map(g => g.trim()).filter(g => g);
                    element.querySelector('.stat-value').textContent = \`\${newGrammar.length} structures\`;
                    if (detailElement) {
                        const displayGrammar = newGrammar.slice(0, 2);
                        const suffix = newGrammar.length > 2 ? '...' : '';
                        detailElement.textContent = newGrammar.length > 0 ? \`(\${displayGrammar.join(', ')}\${suffix})\` : '';
                    }
                    // Update the stored grading data
                    if (currentGradingData && currentGradingData.meta) {
                        currentGradingData.meta.grammar_structures_used = newGrammar;
                    }
                }
            }

            function getScoreColor(percentage) {
                if (percentage >= 90) return '#4CAF50'; // Green
                if (percentage >= 80) return '#8BC34A'; // Light Green
                if (percentage >= 70) return '#FFC107'; // Amber
                if (percentage >= 60) return '#FF9800'; // Orange
                return '#F44336'; // Red
            }
            
            function exportToPDF() {
                if (!currentGradingData || !currentOriginalData) {
                    alert('No grading data available for export.');
                    return;
                }
                
                // Get the essay content safely and process footnotes
                const essayElement = document.querySelector('.formatted-essay-content');
                let essayContent = essayElement ? essayElement.innerHTML : 'Essay content not available';
                let feedbackNotes = [];
                
                // Process essay content to add footnotes and collect feedback
                if (essayElement) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = essayContent;
                    
                    const highlights = tempDiv.querySelectorAll('mark[data-message]');
                    highlights.forEach((mark, index) => {
                        const footnoteNumber = index + 1;
                        const message = mark.getAttribute('data-message') || '';
                        const category = mark.getAttribute('data-type') || 'general';
                        const highlightedText = mark.textContent.replace('✎', '').trim();
                        
                        // Add footnote number to highlight
                        mark.innerHTML = mark.innerHTML + \`<sup style="font-size: 10px; color: #666; font-weight: bold;">[\${footnoteNumber}]</sup>\`;
                        
                        // Collect feedback for footnotes section
                        if (message && !message.includes('Manual') && message.trim() !== '') {
                            feedbackNotes.push({
                                number: footnoteNumber,
                                text: highlightedText,
                                category: category.charAt(0).toUpperCase() + category.slice(1),
                                feedback: message
                            });
                        }
                    });
                    
                    essayContent = tempDiv.innerHTML;
                }
                
                // Create a new window with print-optimized content
                const printWindow = window.open('', '_blank');
                const htmlContent = \`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Midterm Writing Exam Grade - \${currentOriginalData.studentName}</title>
                        <style>
                            @media print {
                                @page { 
                                    margin: 0.5in; 
                                    size: A4;
                                }
                                body { 
                                    print-color-adjust: exact !important; 
                                    -webkit-print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                    padding: 10px !important;
                                    margin: 0 !important;
                                    max-width: none !important;
                                }
                                .no-print { display: none !important; }
                                .page-break { page-break-before: always; }
                                
                                /* Reduce spacing for print */
                                h1 { 
                                    margin-bottom: 15px !important; 
                                    font-size: 20px !important;
                                    padding-bottom: 5px !important;
                                }
                                h2 { 
                                    margin-top: 15px !important; 
                                    margin-bottom: 10px !important; 
                                    font-size: 16px !important;
                                    padding-bottom: 3px !important;
                                }
                                .score-box { 
                                    padding: 15px !important; 
                                    margin: 10px 0 !important; 
                                    font-size: 24px !important;
                                }
                                .category-item { 
                                    margin: 8px 0 !important; 
                                    padding: 10px !important; 
                                }
                                .essay-container { 
                                    padding: 15px !important; 
                                    margin: 10px 0 !important; 
                                    line-height: 1.5 !important;
                                }
                                .teacher-notes { 
                                    padding: 12px !important; 
                                    margin: 10px 0 !important; 
                                }
                            }
                            
                            body {
                                font-family: Arial, sans-serif;
                                max-width: 800px;
                                margin: 0 auto;
                                padding: 20px;
                                color: #000;
                                background: white;
                                line-height: 1.4;
                            }
                            
                            h1 {
                                color: #333;
                                text-align: center;
                                margin-bottom: 30px;
                                font-size: 24px;
                                border-bottom: 3px solid #333;
                                padding-bottom: 10px;
                            }
                            
                            h2 {
                                color: #333;
                                border-bottom: 2px solid #333;
                                padding-bottom: 5px;
                                margin-top: 30px;
                                margin-bottom: 15px;
                                font-size: 18px;
                            }
                            
                            .score-box {
                                font-size: 28px;
                                font-weight: bold;
                                color: #333;
                                text-align: center;
                                background: #f5f5f5 !important;
                                padding: 20px;
                                border: 2px solid #ccc;
                                margin: 20px 0;
                                border-radius: 8px;
                            }
                            
                            .category-item {
                                margin: 15px 0;
                                padding: 15px;
                                border: 1px solid #ccc;
                                background: #fafafa !important;
                                border-radius: 8px;
                                page-break-inside: avoid;
                            }
                            
                            .category-title {
                                font-weight: bold;
                                font-size: 16px;
                                color: #333;
                                margin-bottom: 8px;
                            }
                            
                            .category-feedback {
                                font-size: 14px;
                                color: #666;
                                line-height: 1.6;
                            }
                            
                            .essay-container {
                                border: 2px solid #ddd;
                                padding: 20px;
                                margin: 20px 0;
                                background: white !important;
                                font-family: 'Times New Roman', serif;
                                font-size: 14px;
                                line-height: 1.8;
                                border-radius: 8px;
                            }
                            
                            .teacher-notes {
                                background: #e8f5e8 !important;
                                padding: 20px;
                                border-left: 6px solid #4CAF50;
                                margin: 20px 0;
                                font-size: 14px;
                                line-height: 1.6;
                                border-radius: 8px;
                            }
                            
                            /* Preserve highlight colors */
                            mark {
                                print-color-adjust: exact !important;
                                -webkit-print-color-adjust: exact !important;
                                color-adjust: exact !important;
                            }
                            
                            .print-button {
                                background: #007bff;
                                color: white;
                                border: none;
                                padding: 15px 30px;
                                font-size: 16px;
                                border-radius: 5px;
                                cursor: pointer;
                                margin: 20px;
                                display: block;
                                margin-left: auto;
                                margin-right: auto;
                            }
                            
                            .print-button:hover {
                                background: #0056b3;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="instructions no-print" style="background: #e3f2fd; padding: 20px; margin: 20px; border-radius: 8px; border-left: 6px solid #2196F3; text-align: center;">
                            <h3 style="margin-top: 0; color: #1976D2;">📄 How to Save as PDF</h3>
                            <p style="font-size: 16px; margin: 10px 0;"><strong>Press Ctrl+P (Windows) or Cmd+P (Mac)</strong></p>
                            <p style="font-size: 14px; margin: 10px 0;">Then in the print dialog:</p>
                            <ol style="text-align: left; display: inline-block; font-size: 14px;">
                                <li>Change destination to <strong>"Save as PDF"</strong></li>
                                <li>Click <strong>"Save"</strong></li>
                                <li>Choose where to save your PDF</li>
                            </ol>
                            <button class="print-button" onclick="window.print();">
                                🖨️ Open Print Dialog to Save as PDF
                            </button>
                        </div>
                        
                        <h1>Midterm Writing Exam Grade - \${currentOriginalData.studentName}</h1>
                        
                        <h2>Overall Score</h2>
                        <div class="score-box">
                            \${currentGradingData.total.points}/\${currentGradingData.total.out_of}
                        </div>
                        
                        <h2>Category Breakdown</h2>
                        \${Object.entries(currentGradingData.scores).map(([category, score]) => \`
                            <div class="category-item">
                                <div class="category-title">
                                    \${category.charAt(0).toUpperCase() + category.slice(1)}: \${score.points}/\${score.out_of}
                                </div>
                                <div class="category-feedback">
                                    \${score.rationale}
                                </div>
                            </div>
                        \`).join('')}
                        
                        <div class="page-break"></div>
                        
                        <h2>Color-Coded Essay</h2>
                        <div class="essay-container">
                            \${essayContent}
                        </div>
                        
                        \${feedbackNotes.length > 0 ? \`
                            <div class="page-break"></div>
                            <h2>📝 Feedback Notes</h2>
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
                                <p style="font-size: 14px; color: #666; margin-top: 0;">The numbers in brackets [1], [2], etc. in the essay above correspond to the feedback below:</p>
                                \${feedbackNotes.map(note => \`
                                    <div style="margin: 15px 0; padding: 15px; background: white; border-left: 4px solid #007bff; border-radius: 4px;">
                                        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
                                            <span style="background: #007bff; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin-right: 10px;">[\${note.number}]</span>
                                            "\${note.text}" - <em style="color: #666;">\${note.category}</em>
                                        </div>
                                        <div style="font-size: 14px; line-height: 1.5; color: #444;">
                                            \${note.feedback}
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \` : ''}
                        
                        \${currentGradingData.teacher_notes ? \`
                            <h2>Teacher Notes</h2>
                            <div class="teacher-notes">
                                \${currentGradingData.teacher_notes}
                            </div>
                        \` : ''}
                    </body>
                    </html>
                \`;
                
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                
                // Focus the new window but don't auto-print
                setTimeout(() => {
                    printWindow.focus();
                }, 100);
            }
            
            function exportToHTML() {
                if (!currentGradingData || !currentOriginalData) {
                    alert('No grading data available for export.');
                    return;
                }
                
                // Generate fresh formatted content with current edited values
                fetch('/format', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studentText: currentOriginalData.studentText,
                        gradingResults: currentGradingData,
                        studentName: currentOriginalData.studentName,
                        editable: false
                    })
                })
                .then(response => response.json())
                .then(formatted => {
                    const exportContent = \`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Midterm Writing Exam Grade - \${currentOriginalData.studentName}</title>
                            <style>
                                body { font-family: Arial, sans-serif; margin: 20px; }
                                .grading-summary { max-width: 800px; margin: 0 auto; }
                                .formatted-essay { font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.6; margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                            </style>
                        </head>
                        <body>
                            <h1>Midterm Writing Exam Grade - \${currentOriginalData.studentName}</h1>
                            \${formatted.feedbackSummary}
                            <h2>Color-Coded Essay:</h2>
                            <div class="formatted-essay">\${formatted.formattedText}</div>
                        </body>
                        </html>
                    \`;
                    
                    const blob = new Blob([exportContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`graded_essay_\${currentOriginalData.studentName.replace(/\\s+/g, '_')}.html\`;
                    a.click();
                    URL.revokeObjectURL(url);
                })
                .catch(error => {
                    console.error('Export error:', error);
                    alert('Error generating export. Please try again.');
                });
            }
            
            // Profile management functionality
            document.getElementById('manageProfilesBtn').addEventListener('click', function() {
                document.getElementById('profileModal').style.display = 'block';
                loadProfilesList();
            });
            
            document.getElementById('closeModal').addEventListener('click', function() {
                document.getElementById('profileModal').style.display = 'none';
                document.getElementById('profileForm').style.display = 'none';
            });
            
            document.getElementById('addNewProfile').addEventListener('click', function() {
                showProfileForm();
            });
            
            document.getElementById('cancelProfileForm').addEventListener('click', function() {
                document.getElementById('profileForm').style.display = 'none';
            });
            
            function loadProfilesList() {
                const listDiv = document.getElementById('profilesList');
                listDiv.innerHTML = '';
                
                if (profiles.length === 0) {
                    listDiv.innerHTML = '<p>No profiles created yet.</p>';
                    return;
                }
                
                profiles.forEach(profile => {
                    const profileDiv = document.createElement('div');
                    profileDiv.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px;';
                    profileDiv.innerHTML = \`
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>\${profile.name}</strong> (\${profile.cefrLevel})
                                <br><small>\${profile.vocabulary.length} vocab words, \${profile.grammar.length} grammar topics</small>
                            </div>
                            <div>
                                <button onclick="editProfile('\${profile.id}')" style="background: #007bff; color: white; border: none; padding: 5px 10px; margin: 0 5px; border-radius: 3px; cursor: pointer;">Edit</button>
                                <button onclick="deleteProfile('\${profile.id}')" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>
                            </div>
                        </div>
                    \`;
                    listDiv.appendChild(profileDiv);
                });
            }
            
            function showProfileForm(profileId = null) {
                const form = document.getElementById('profileForm');
                const title = document.getElementById('profileFormTitle');
                
                if (profileId) {
                    const profile = profiles.find(p => p.id === profileId);
                    if (profile) {
                        title.textContent = 'Edit Profile';
                        document.getElementById('profileId').value = profile.id;
                        document.getElementById('profileName').value = profile.name;
                        document.getElementById('profileCefr').value = profile.cefrLevel;
                        document.getElementById('profileVocab').value = profile.vocabulary.join('\\n');
                        document.getElementById('profileGrammar').value = profile.grammar.join('\\n');
                    }
                } else {
                    title.textContent = 'Create New Profile';
                    document.getElementById('profileEditForm').reset();
                    document.getElementById('profileId').value = '';
                }
                
                form.style.display = 'block';
            }
            
            window.editProfile = function(profileId) {
                showProfileForm(profileId);
            };
            
            window.deleteProfile = async function(profileId) {
                if (!confirm('Are you sure you want to delete this profile?')) return;
                
                try {
                    const response = await fetch(\`/api/profiles/\${profileId}\`, { method: 'DELETE' });
                    if (response.ok) {
                        await loadProfilesData();
                        loadProfilesList();
                    }
                } catch (error) {
                    alert('Error deleting profile');
                }
            };
            
            document.getElementById('profileEditForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const profileId = document.getElementById('profileId').value;
                const profileData = {
                    name: document.getElementById('profileName').value,
                    cefrLevel: document.getElementById('profileCefr').value,
                    vocabulary: document.getElementById('profileVocab').value.split('\\n').map(v => v.trim()).filter(v => v),
                    grammar: document.getElementById('profileGrammar').value.split('\\n').map(g => g.trim()).filter(g => g)
                };
                
                try {
                    const method = profileId ? 'PUT' : 'POST';
                    const url = profileId ? \`/api/profiles/\${profileId}\` : '/api/profiles';
                    
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(profileData)
                    });
                    
                    if (response.ok) {
                        await loadProfilesData();
                        loadProfilesList();
                        document.getElementById('profileForm').style.display = 'none';
                    }
                } catch (error) {
                    alert('Error saving profile');
                }
            });
        </script>
        
        <!-- html2pdf library for direct PDF download -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    </body>
    </html>
  `);
});

// Grade essay endpoint
app.post("/grade", async (req, res) => {
  const { studentText, prompt, classProfile } = req.body;

  try {
    const result = await gradeEssay(studentText, prompt, classProfile);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error grading essay", details: error.message });
  }
});

// Format graded essay endpoint
app.post("/format", async (req, res) => {
  const { studentText, gradingResults, studentName, editable, options } = req.body;
  const finalOptions = { ...options, editable };
  
  try {
    const formatted = formatGradedEssay(studentText, gradingResults, finalOptions);
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error formatting essay", details: error.message });
  }
});

// Profile management API endpoints
app.get("/api/profiles", (req, res) => {
  try {
    const profiles = loadProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Error loading profiles" });
  }
});

app.post("/api/profiles", (req, res) => {
  try {
    const profiles = loadProfiles();
    const newProfile = {
      id: `profile_${Date.now()}`,
      name: req.body.name,
      cefrLevel: req.body.cefrLevel,
      vocabulary: req.body.vocabulary || [],
      grammar: req.body.grammar || [],
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    profiles.profiles.push(newProfile);
    saveProfiles(profiles);
    res.json(newProfile);
  } catch (error) {
    res.status(500).json({ error: "Error creating profile" });
  }
});

app.put("/api/profiles/:id", (req, res) => {
  try {
    const profiles = loadProfiles();
    const profileIndex = profiles.profiles.findIndex(p => p.id === req.params.id);
    
    if (profileIndex === -1) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    profiles.profiles[profileIndex] = {
      ...profiles.profiles[profileIndex],
      name: req.body.name,
      cefrLevel: req.body.cefrLevel,
      vocabulary: req.body.vocabulary || [],
      grammar: req.body.grammar || [],
      lastModified: new Date().toISOString()
    };
    
    saveProfiles(profiles);
    res.json(profiles.profiles[profileIndex]);
  } catch (error) {
    res.status(500).json({ error: "Error updating profile" });
  }
});

app.delete("/api/profiles/:id", (req, res) => {
  try {
    const profiles = loadProfiles();
    const profileIndex = profiles.profiles.findIndex(p => p.id === req.params.id);
    
    if (profileIndex === -1) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    profiles.profiles.splice(profileIndex, 1);
    saveProfiles(profiles);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error deleting profile" });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Grader running on http://localhost:${PORT}`));
