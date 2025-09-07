// server.js

console.log("\n=== ESL GRADING SERVER STARTING ===\n");
console.log("[BOOT] import:", import.meta.url);
console.log("[BOOT] cwd:", process.cwd());
console.log("[BOOT] Node version:", process.version);
console.log("[BOOT] Platform:", process.platform);

import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { readFileSync, writeFileSync } from 'fs';
import { gradeEssay } from "./grader/grader-two-step.js";
import { formatGradedEssay, generateCSS } from "./grader/formatter.js";

// Environment detection
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';

console.log(`[ENV] Running in: ${isVercel ? 'Vercel' : 'Local'} environment`);

// Try to import Prisma, but have fallback for local development
let prisma = null;
let useDatabase = false;
try {
  const { prisma: prismaClient } = await import("./lib/prisma.js");
  prisma = prismaClient;
  useDatabase = true;
  console.log("✅ Prisma database connected");
} catch (error) {
  console.warn("⚠️ Database unavailable, using file storage:", error.message);
}

// Unified profile loading - works with both database and files
async function loadProfiles() {
  if (useDatabase && prisma) {
    console.log("[PROFILES] Loading from database");
    try {
      const profiles = await prisma.classProfile.findMany({
        orderBy: { lastModified: 'desc' }
      });
      return { profiles };
    } catch (error) {
      console.error("[PROFILES] Database error, falling back to file:", error.message);
    }
  }

  // Fallback to file system (local development)
  console.log("[PROFILES] Loading from file system");
  // Original file loading logic below:
  try {
    return JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
  } catch (error) {
    // Fallback for serverless environments - load from environment variable
    if (process.env.CLASS_PROFILES) {
      return JSON.parse(process.env.CLASS_PROFILES);
    }
    // Default profiles for fresh deployments
    return {
      "profiles": [
        {
          "id": "business_b2_fall2024",
          "name": "Level 5 Midterm Exams - Fall 2025 Bimestre 1",
          "cefrLevel": "B2",
          "vocabulary": [
            "Bills", "Fee", "Expenses", "Income", "Installments", "Budget", "Penniless", "Frugal", "Stingy", "Prodigal", "Carelessly", "Unnecessarily", "In the red", "Bankrupt", "Broke", "Savings", "Leasing", "Sublet", "Mortgage", "Down payment", "Interest rate", "Insurance", "Walkability", "Neighborhood", "Security deposit", "Amenities", "Accessibility", "Pet-friendly", "Well-lit", "Decrease in price", "Increase in price", "Landlord", "Tenant", "Furnished", "Unfurnished", "Move-in date", "Eviction", "Property tax", "Renovated", "Fandom", "Nostalgia", "Binge Watch", "Doom Scroll", "Cult classic", "Aesthetic", "Pop culture reference", "Niche", "Mainstream", "Drop", "Hype", "Trope", "Archetype", "Chronically online", "Plot", "Character", "Development", "Cinematography", "Direction", "Dialogue", "Pacing", "Theme", "Originality", "Soundtrack", "Visual Effects", "Critique", "Production design", "Zeitgeist", "Business plan", "Market research", "Fundraising", "Funding", "Revenue", "Value propositions", "Pitch", "Networking", "Mentor", "Brand identity", "Customer", "Loyalty", "Startup", "Prefixes (any word using these counts as vocab used):", "un-", "re-", "in-/im-/il-/ir-", "dis-", "pre-", "mis-", "non-", "inter-", "sub-", "super-", "anti-", "Suffixes (any word using these counts as vocab used):", "-able, -ible", "-ive", "-ness", "-ment", "-tion, -sion", "-ity", "-ence", "-ship"
          ],
          "grammar": [
            "Tense and structure review", "Active vs. Passive verb forms (all tenses, modals)", "Identifying tenses in time clauses", "Pronouns and determiners review", "Personal pronouns", "Reflexive pronouns", "Indefinite pronouns", "Reciprocal pronouns", "Relative pronouns", "Articles", "Quantifiers", "Demonstratives", "Distributives", "Some / Any", "Too / Enough", "Review reported speech:", "Present (simple, continuous, perfect simple)", "Past (simple)", "Modals (can→could, will→would, may→might, should)", "Commands and instructions", "Review reporting verbs with verb patterns:", "Reporting verb + clause (agree, promise, suggest, complain, admit, explain, mention, claim)", "Reporting verb + direct object + clause (advise, warn, tell, convince, assure, persuade, notify, inform, remind)", "Reporting verb + infinitive (threaten, demand, offer, propose, refuse, ask, agree, claim, promise)", "Reporting verb + direct object + infinitive (invite, tell, beg, forbid, order, remind, advise, ask, encourage, warn [not to])", "Reporting verb + verb + ing (mention, deny, suggest, recommend, admit, propose)", "Reporting verb + preposition + verb + ing (agree [to], apologize [for], insist [on], argue [about])", "Reporting verb + direct object + preposition + verb + ing (blame [for], congratulate [on], discourage [from], criticize [for])", "Review conditional forms", "Real conditionals", "Unreal conditionals", "Mixed conditionals", "Alternatives to if in conditionals", "Conditionals without if (Inverted conditionals)", "Word building (prefixes and suffixes)"
          ],
          "created": "2024-09-04T00:00:00Z",
          "lastModified": "2025-09-07T01:39:20.278Z",
          "prompt": "Write a letter to a younger friend.\n\nWrite a letter to a younger friend who is interested in starting his/her own business. In this letter, share your insights on the importance of entrepreneurship and innovation. Highlight how innovative thinking can lead to successful ventures and provide practical advice on taking the first steps.\n\n \n\nFollow the specific pattern:\n\nParagraph 1: Introduce the topic of entrepreneurship and express your excitement about your friend's interest in starting a business.\nParagraph 2: Discuss the significance of innovation in entrepreneurship. Use reported speech to include a quote or advice from a successful entrepreneur you admire (e.g., Steve Jobs, Elon Musk, etc.)\nParagraph 3: Share practical steps your friend can take to start his/her entrepreneurial journey. Use conditional sentences to discuss potential scenarios\nParagraph 4: Summarize your main points and encourage your friend to embrace his/her entrepreneurial spirit.\nWrite your essay in 200 – 220 words. Don't forget to use linking words to make your text easier for the reader to understand. You can include the following sentence to your text:\n\nA mentor once advised me that taking calculated risks is essential for success because …\n\n \n\nIt is mandatory to use at least:\n\n6 grammar structures seen in class. Write the it between parentheses ().\n4 linkers. Write the linkers between *asterisks*.\n10 vocabulary items seen in class. Write the vocabulary items in CAPITAL LETTERS."
        },
        {
          "id": "academic_c1_fall2024",
          "name": "Level 6 Midterm Exams - Fall 2025",
          "cefrLevel": "C1",
          "vocabulary": [
            "furthermore", "nevertheless", "consequently", "substantial", "comprehensive", "predominantly", "simultaneously", "phenomenon", "implications", "methodology", "hypothesis", "correlation", "criterion", "paradigm", "empirical"
          ],
          "grammar": [
            "Complex conditional structures", "Subjunctive mood", "Inversion after negative adverbials", "Mixed conditionals", "Advanced passive constructions", "Participle clauses", "Cleft sentences", "Nominalization"
          ],
          "created": "2024-09-04T00:00:00Z",
          "lastModified": "2025-09-04T18:19:05.753Z"
        }
      ]
    };
  }
}

async function saveProfiles(profiles) {
  if (useDatabase && prisma) {
    console.log("[PROFILES] Database saving handled by individual endpoints");
    return;
  }

  // Fallback to file system (local development)
  console.log("[PROFILES] Saving to file system");
  try {
    writeFileSync('./class-profiles.json', JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.warn('Cannot save to file system:', error.message);
  }
}

dotenv.config();
const app = express();
// app.use(morgan("dev")); // logs every HTTP request to the terminal
app.get("/health", (req, res) => res.send("ok"));
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
            
            /* Reset default mark element styling to prevent yellow background */
            mark {
                background: transparent;
                color: inherit;
            }
            
            /* Allow our custom mark elements to override the reset */
            mark[data-type] {
                background: unset;
                color: unset;
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
                        <div class="form-group">
                            <label for="profilePrompt">Custom Error Detection Prompt (optional):</label>
                            <textarea id="profilePrompt" rows="8" placeholder="Enter a custom prompt to override the default error detection behavior for this class profile. Leave empty to use the system default prompt."></textarea>
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
            
            // Handle profile selection change
            document.getElementById('classProfile').addEventListener('change', function(e) {
                const selectedProfileId = e.target.value;
                const promptTextarea = document.getElementById('prompt');
                const promptContainer = document.querySelector('label[for="prompt"]').parentElement;
                
                if (selectedProfileId) {
                    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
                    if (selectedProfile && selectedProfile.prompt && selectedProfile.prompt.trim()) {
                        // Profile has a built-in prompt, populate and hide the prompt field
                        promptTextarea.value = selectedProfile.prompt;
                        promptContainer.style.display = 'none';
                        promptTextarea.style.display = 'none';
                    } else {
                        // Profile has no built-in prompt, show the prompt field
                        promptContainer.style.display = 'block';
                        promptTextarea.style.display = 'block';
                        if (promptTextarea.value === '' || profiles.some(p => p.prompt === promptTextarea.value)) {
                            promptTextarea.value = '';
                        }
                    }
                } else {
                    // No profile selected, show prompt field and clear it
                    promptContainer.style.display = 'block';
                    promptTextarea.style.display = 'block';
                    promptTextarea.value = '';
                }
            });
            
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
                    const response = await fetch('/api/grade', {
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
                console.log('🎯 DISPLAY RESULTS CALLED');
                console.log('Grading result:', gradingResult);
                console.log('Original data:', originalData);
                
                const resultsDiv = document.getElementById('results');
                
                console.log('📤 MAKING FORMAT REQUEST...');
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
                .then(response => {
                    console.log('📥 FORMAT RESPONSE STATUS:', response.status);
                    return response.json();
                })
                .then(formatted => {
                    console.log('✅ FORMAT RESPONSE RECEIVED:', formatted);
                    resultsDiv.innerHTML = \`
                        <h2>Grading Results for \${originalData.studentName}</h2>
                        \${formatted.feedbackSummary}
                        
                        <h3 style="margin: 20px 0 10px 0;">Color-Coded Essay:</h3>
                        
                        <div id="essayContainer" style="border: 1px solid #ddd; border-radius: 4px;">
                            <!-- Category selector bar -->
                            <div id="categoryBar" style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;">
                                <div style="margin-bottom: 5px; font-weight: bold; font-size: 14px;">Select category then highlight text, or highlight text then select category:</div>
                                <div id="categoryButtons" style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    <button class="category-btn" data-category="grammar" style="background: #FF6B6B; color: #FFFFFF; border: 2px solid #FF6B6B; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Grammar</button>
                                    <button class="category-btn" data-category="mechanics-punctuation" style="background: #6B7280; color: #FFFFFF; border: 2px solid #6B7280; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Mechanics & Punctuation</button>
                                    <button class="category-btn" data-category="redundancy" style="background: #84CC16; color: #111827; border: 2px solid #84CC16; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Redundancy</button>
                                    <button class="category-btn" data-category="vocabulary-structure" style="background: transparent; color: #4ECDC4; border: 2px solid #4ECDC4; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Vocabulary / Structure</button>
                                    <button class="category-btn" data-category="needs-rephrasing" style="background: #38BDF8; color: #111827; border: 2px solid #38BDF8; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Needs rephrasing</button>
                                    <button class="category-btn" data-category="non-suitable-words" style="background: transparent; color: #000000; border: 2px solid #000000; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s; text-decoration: line-through;">Non-suitable words</button>
                                    <button class="category-btn" data-category="spelling" style="background: transparent; color: #F57C00; border: 2px solid #F57C00; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Spelling</button>
                                    <button class="category-btn" data-category="fluency" style="background: transparent; color: #9333EA; border: 2px solid #9333EA; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s; text-decoration: underline;">Fluency coaching</button>
                                    <button class="category-btn" data-category="professor-comments" style="background: #FACC15; color: #111827; border: 2px solid #FACC15; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Professor's comments</button>
                                    <button id="clearSelectionBtn" onclick="clearSelection()" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>
                                </div>
                                <div id="selectionStatus" style="margin-top: 8px; font-size: 12px; color: #666; min-height: 16px;"></div>
                                
                                <!-- Correction Guide Legend -->
                                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; color: #666;">📖 Correction Guide:</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px; font-size: 10px;">
                                        <span style="background: #FF6B6B; color: #FFFFFF; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Grammar</span>
                                        <span style="background: #6B7280; color: #FFFFFF; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Mechanics & Punctuation</span>
                                        <span style="background: #84CC16; color: #111827; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Redundancy</span>
                                        <span style="background: transparent; color: #4ECDC4; padding: 2px 6px; border-radius: 12px; font-weight: 500; border: 1px solid #4ECDC4;">Vocabulary / Structure</span>
                                        <span style="background: #38BDF8; color: #111827; padding: 2px 6px; border-radius: 12px; font-weight: 500;">Needs rephrasing</span>
                                        <span style="background: transparent; color: #000000; padding: 2px 6px; border-radius: 12px; font-weight: 500; border: 1px solid #000000; text-decoration: line-through;">Non-suitable words</span>
                                        <span style="background: transparent; color: #F57C00; padding: 2px 6px; border-radius: 12px; font-weight: 500; border: 1px solid #F57C00;">Spelling</span>
                                        <span style="background: transparent; color: #9333EA; padding: 2px 6px; border-radius: 12px; font-weight: 500; border: 1px solid #9333EA; text-decoration: underline;">Fluency coaching</span>
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
            // Rubric-aligned highlight categories matching formatter.js
            const categoryColors = {
                'grammar': { color: '#FFFFFF', bg: '#FF6B6B' }, // Pink highlight to match rubric
                'mechanics-punctuation': { color: '#FFFFFF', bg: '#6B7280' },
                'redundancy': { color: '#111827', bg: '#84CC16' },
                'vocabulary-structure': { color: '#4ECDC4', bg: 'transparent' }, // Blue text, no highlight
                'needs-rephrasing': { color: '#111827', bg: '#38BDF8' },
                'non-suitable-words': { color: '#000000', bg: 'transparent', textDecoration: 'line-through' }, // Black strikethrough
                'spelling': { color: '#F57C00', bg: 'transparent' }, // Orange/reddish text, no highlight
                'fluency': { color: '#9333EA', bg: 'transparent', textDecoration: 'underline' }, // Purple underline for coaching
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
                        let styleProps = 'color: ' + colors.color + '; position: relative; cursor: pointer;';
                        if (colors.textDecoration) {
                            styleProps += ' text-decoration: ' + colors.textDecoration + ';';
                        }
                        if (colors.bg && colors.bg !== 'transparent') {
                            styleProps += ' background: ' + colors.bg + '; padding: 2px 4px; border-radius: 2px;';
                        }
                        mark.style.cssText = styleProps;
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
                let styleProps = 'color: ' + colors.color + '; position: relative; cursor: pointer;';
                if (colors.textDecoration) {
                    styleProps += ' text-decoration: ' + colors.textDecoration + ';';
                }
                if (colors.bg && colors.bg !== 'transparent') {
                    styleProps += ' background: ' + colors.bg + '; padding: 2px 4px; border-radius: 2px;';
                }
                mark.style.cssText = styleProps;
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
                
                // Get the essay content safely
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
                
                // Create the HTML content for print
                const printContent = \`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Graded Essay - \${currentOriginalData.studentName}</title>
                    <style>
                        @media print {
                            body { margin: 0; }
                            .no-print { display: none !important; }
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
                            background: #f5f5f5;
                            padding: 20px;
                            border: 2px solid #ccc;
                            margin: 20px 0;
                            border-radius: 8px;
                        }
                        .category {
                            margin: 15px 0;
                            padding: 15px;
                            border: 1px solid #ccc;
                            background: #fafafa;
                            border-radius: 8px;
                            page-break-inside: avoid;
                        }
                        .essay-content {
                            background: white;
                            padding: 25px;
                            border: 1px solid #ddd;
                            border-radius: 8px;
                            line-height: 1.8;
                            font-size: 16px;
                        }
                    </style>
                </head>
                <body>
                    <h1>Midterm Writing Exam Grade - \${currentOriginalData.studentName}</h1>
                    
                    <h2>Overall Score</h2>
                    <div class="score-box">\${currentGradingData.total.points}/\${currentGradingData.total.out_of}</div>
                    
                    <h2>Category Breakdown</h2>
                    \${Object.entries(currentGradingData.scores).map(([category, score]) => \`
                        <div class="category">
                            <div style="font-weight: bold; font-size: 16px; color: #333; margin-bottom: 8px;">
                                \${category.charAt(0).toUpperCase() + category.slice(1)}: \${score.points}/\${score.out_of}
                            </div>
                            <div style="font-size: 14px; color: #666; line-height: 1.6;">
                                \${score.rationale}
                            </div>
                        </div>
                    \`).join('')}
                    
                    <h2>Your Essay with Corrections</h2>
                    <div class="essay-content">\${essayContent}</div>
                    
                    \${feedbackNotes.length > 0 ? \`
                        <h2>Detailed Feedback</h2>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
                            \${feedbackNotes.map(note => \`
                                <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #007bff;">
                                    <div style="font-weight: bold; color: #333; margin-bottom: 5px;">
                                        [\${note.number}] "\${note.text}" (\${note.category})
                                    </div>
                                    <div style="color: #666; font-size: 14px; line-height: 1.5;">
                                        \${note.feedback}
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    \` : ''}
                </body>
                </html>
                \`;
                
                // Open print preview in new window
                const printWindow = window.open('', '_blank');
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.focus();
                
                // Trigger print dialog after content loads
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            }

            function UNUSED_exportToPDF_old() {
                console.log('PDF Export - currentGradingData:', currentGradingData);
                console.log('PDF Export - currentOriginalData:', currentOriginalData);
                
                if (!currentGradingData || !currentOriginalData) {
                    alert('No grading data available for export.');
                    return;
                }
                
                // Show loading message
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = '⏳ Generating PDF...';
                button.disabled = true;
                
                // Get the essay content safely
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
                
                // Create the HTML content for PDF
                const pdfContent = \`
                    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #000; background: white; line-height: 1.4;">
                        <h1 style="color: #333; text-align: center; margin-bottom: 30px; font-size: 24px; border-bottom: 3px solid #333; padding-bottom: 10px;">
                            Midterm Writing Exam Grade - \${currentOriginalData.studentName}
                        </h1>
                        
                        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Overall Score</h2>
                        <div style="font-size: 28px; font-weight: bold; color: #333; text-align: center; background: #f5f5f5; padding: 20px; border: 2px solid #ccc; margin: 20px 0; border-radius: 8px;">
                            \${currentGradingData.total.points}/\${currentGradingData.total.out_of}
                        </div>
                        
                        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Category Breakdown</h2>
                        \${Object.entries(currentGradingData.scores).map(([category, score]) => \`
                            <div style="margin: 15px 0; padding: 15px; border: 1px solid #ccc; background: #fafafa; border-radius: 8px; page-break-inside: avoid;">
                                <div style="font-weight: bold; font-size: 16px; color: #333; margin-bottom: 8px;">
                                    \${category.charAt(0).toUpperCase() + category.slice(1)}: \${score.points}/\${score.out_of}
                                </div>
                                <div style="font-size: 14px; color: #666; line-height: 1.6;">
                                    \${score.rationale}
                                </div>
                            </div>
                        \`).join('')}
                        
                        <div style="page-break-before: always;"></div>
                        
                        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">📖 Correction Guide</h2>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #ddd; margin: 20px 0;">
                            <p style="font-size: 14px; color: #666; margin-top: 0; margin-bottom: 15px;">The highlighted colors in your essay correspond to different types of corrections:</p>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: #FF6B6B; color: #FFFFFF; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center;">Grammar</span>
                                    <span style="font-size: 13px; color: #333;">Verb tenses, agreement, structures, word order</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: #6B7280; color: #FFFFFF; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center;">Mechanics</span>
                                    <span style="font-size: 13px; color: #333;">Punctuation, capitalization, run-on sentences</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: #84CC16; color: #111827; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center;">Redundancy</span>
                                    <span style="font-size: 13px; color: #333;">Repetitive words or phrases</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: transparent; color: #4ECDC4; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center; border: 2px solid #4ECDC4;">Vocabulary</span>
                                    <span style="font-size: 13px; color: #333;">Word choice, collocations, awkward phrasing</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: #38BDF8; color: #111827; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center;">Rephrasing</span>
                                    <span style="font-size: 13px; color: #333;">Unclear sentences that need restructuring</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: transparent; color: #000000; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center; border: 2px solid #000000; text-decoration: line-through;">Word Choice</span>
                                    <span style="font-size: 13px; color: #333;">Inappropriate or unsuitable word choices</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: transparent; color: #F57C00; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center; border: 2px solid #F57C00;">Spelling</span>
                                    <span style="font-size: 13px; color: #333;">Misspellings and typos</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: transparent; color: #9333EA; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center; border: 2px solid #9333EA; text-decoration: underline;">Coaching</span>
                                    <span style="font-size: 13px; color: #333;">Natural language improvements and suggestions</span>
                                </div>
                                <div style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ddd;">
                                    <span style="background: #FACC15; color: #111827; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 12px; margin-right: 10px; min-width: 80px; text-align: center;">Comments</span>
                                    <span style="font-size: 13px; color: #333;">General feedback and suggestions</span>
                                </div>
                            </div>
                        </div>
                        
                        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Color-Coded Essay</h2>
                        <div style="border: 2px solid #ddd; padding: 20px; margin: 20px 0; background: white; font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; border-radius: 8px;">
                            \${essayContent}
                        </div>
                        
                        \${feedbackNotes.length > 0 ? \`
                            <div style="page-break-before: always;"></div>
                            <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">📝 Feedback Notes</h2>
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
                            <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Teacher Notes</h2>
                            <div style="background: #e8f5e8; padding: 20px; border-left: 6px solid #4CAF50; margin: 20px 0; font-size: 14px; line-height: 1.6; border-radius: 8px;">
                                \${currentGradingData.teacher_notes}
                            </div>
                        \` : ''}
                    </div>
                \`;
                
                // Debug: Log the PDF content before processing
                console.log('PDF Content length:', pdfContent.length);
                console.log('PDF Content preview:', pdfContent.substring(0, 500) + '...');
                
                // Create temporary element for html2pdf
                const element = document.createElement('div');
                element.innerHTML = pdfContent;
                element.style.position = 'fixed';
                element.style.top = '0';
                element.style.left = '0';
                element.style.width = '210mm'; // A4 width
                element.style.zIndex = '-1000';
                element.style.visibility = 'hidden'; // Hide from user but keep in rendering context
                document.body.appendChild(element);
                
                console.log('Element innerHTML length:', element.innerHTML.length);
                
                console.log('Creating filename...');
                // Generate filename  
                const studentName = currentOriginalData.studentName.replace(/[^a-zA-Z0-9]/g, '_');
                const filename = \`\${studentName}_graded_essay.pdf\`;
                console.log('Filename created:', filename);
                
                console.log('Configuring PDF options...');
                // Configure html2pdf options
                const opt = {
                    margin: 0.5,
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                };
                console.log('PDF options configured:', opt);
                
                // Check if html2pdf is available
                if (typeof html2pdf === 'undefined') {
                    console.error('html2pdf library not loaded!');
                    alert('PDF library not loaded. Please refresh the page and try again.');
                    button.textContent = originalText;
                    button.disabled = false;
                    return;
                }
                
                console.log('Starting PDF generation with html2pdf...');
                
                // Generate and download PDF
                html2pdf().set(opt).from(element).save().then(() => {
                    console.log('PDF generation completed successfully!');
                    // Clean up
                    document.body.removeChild(element);
                    button.textContent = originalText;
                    button.disabled = false;
                }).catch((error) => {
                    console.error('PDF generation failed:', error);
                    console.error('Error details:', error.message, error.stack);
                    document.body.removeChild(element);
                    button.textContent = originalText;
                    button.disabled = false;
                    alert('Failed to generate PDF: ' + error.message);
                });
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
                        document.getElementById('profilePrompt').value = profile.prompt || '';
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
                    grammar: document.getElementById('profileGrammar').value.split('\\n').map(g => g.trim()).filter(g => g),
                    prompt: document.getElementById('profilePrompt').value.trim()
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

app.get("/health", (req, res) => {
  res.send("ok");
});

// Grade essay endpoint
app.post("/grade", async (req, res) => {
  const { studentText, prompt, classProfile } = req.body;

  console.log("\n🔥 GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Timestamp:", new Date().toLocaleString());
  
  try {
    console.log("\n⚡ STARTING TWO-STEP GRADING PROCESS...");
    const result = await gradeEssay(studentText, prompt, classProfile);
    console.log("\n✅ GRADING COMPLETED SUCCESSFULLY!");
    console.log("Final score:", result.total?.points + "/" + result.total?.out_of);
    res.json(result);
  } catch (error) {
    console.error("\n❌ GRADING ERROR:", error);
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
app.get("/api/profiles", async (req, res) => {
  try {
    if (useDatabase && prisma) {
      const profiles = await prisma.classProfile.findMany({
        orderBy: { lastModified: 'desc' }
      });
      res.json({ profiles });
    } else {
      const profiles = await loadProfiles();
      res.json(profiles);
    }
  } catch (error) {
    console.error('Error loading profiles:', error);
    res.status(500).json({ error: "Error loading profiles" });
  }
});

app.post("/api/profiles", async (req, res) => {
  try {
    if (useDatabase && prisma) {
      const newProfile = await prisma.classProfile.create({
        data: {
          name: req.body.name,
          cefrLevel: req.body.cefrLevel,
          vocabulary: req.body.vocabulary || [],
          grammar: req.body.grammar || [],
          prompt: req.body.prompt || '',
        }
      });
      res.json(newProfile);
    } else {
      const profiles = await loadProfiles();
      const newProfile = {
        id: `profile_${Date.now()}`,
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      profiles.profiles.push(newProfile);
      await saveProfiles(profiles);
      res.json(newProfile);
    }
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ error: "Error creating profile" });
  }
});

app.put("/api/profiles/:id", async (req, res) => {
  try {
    if (useDatabase && prisma) {
      const updatedProfile = await prisma.classProfile.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name,
          cefrLevel: req.body.cefrLevel,
          vocabulary: req.body.vocabulary || [],
          grammar: req.body.grammar || [],
          prompt: req.body.prompt || '',
        }
      });
      res.json(updatedProfile);
    } else {
      const profiles = await loadProfiles();
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
        prompt: req.body.prompt || '',
        lastModified: new Date().toISOString()
      };
      
      await saveProfiles(profiles);
      res.json(profiles.profiles[profileIndex]);
    }
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ error: "Error updating profile" });
  }
});

app.delete("/api/profiles/:id", async (req, res) => {
  try {
    if (useDatabase && prisma) {
      await prisma.classProfile.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true });
    } else {
      const profiles = await loadProfiles();
      const profileIndex = profiles.profiles.findIndex(p => p.id === req.params.id);
      
      if (profileIndex === -1) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      profiles.profiles.splice(profileIndex, 1);
      await saveProfiles(profiles);
      res.json({ success: true });
    }
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: "Error deleting profile" });
  }
});

// Add API route for grade endpoint (for compatibility with unified UI)
app.post("/api/grade", async (req, res) => {
  const { studentText, prompt, classProfile } = req.body;

  console.log("\n🔥 API GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Environment:", isVercel ? 'Vercel' : 'Local');
  
  try {
    console.log("\n⚡ STARTING UNIFIED GRADING SYSTEM...");
    console.log("🔍 Looking for profile:", classProfile);
    
    // Get profile data (unified for both environments)
    let profileData;
    if (useDatabase && prisma) {
      console.log("📊 Searching database for profile...");
      profileData = await prisma.classProfile.findFirst({
        where: { id: classProfile }
      });
      console.log("🎯 Database search result:", profileData ? "FOUND" : "NOT FOUND");
    } else {
      console.log("📁 Searching file system for profile...");
      const profiles = await loadProfiles();
      console.log("📋 Available profiles:", profiles.profiles?.map(p => p.id) || []);
      profileData = profiles.profiles.find(p => p.id === classProfile);
      console.log("🎯 File search result:", profileData ? "FOUND" : "NOT FOUND");
    }
    
    if (!profileData) {
      console.log("❌ Profile not found, returning 404");
      return res.status(404).json({ error: "Class profile not found", requested: classProfile });
    }
    
    console.log("✅ Profile found:", profileData.name);
    console.log("🤖 Using UNIFIED grading system (identical local & Vercel)...");
    
    // Use unified grading system (works identically everywhere)
    const result = await gradeEssayUnified(studentText, prompt, profileData);
    console.log("\n✅ UNIFIED GRADING COMPLETED!");
    res.json(result);
  } catch (error) {
    console.error("\n❌ GRADING ERROR:", error);
    console.error("Error stack:", error.stack);
    res.json({ 
      success: false,
      error: error.message,
      details: error.stack,
      debug: {
        errorType: error.constructor.name,
        isVercel,
        useDatabase,
        prismaAvailable: !!prisma,
        requestData: {
          hasStudentText: !!req.body.studentText,
          hasPrompt: !!req.body.prompt,
          classProfile: req.body.classProfile
        }
      }
    });
  }
});

// Debug endpoint to test serverless function components
app.get("/api/debug", async (req, res) => {
  try {
    console.log("=== DEBUG ENDPOINT CALLED ===");
    const debugInfo = {
      environment: {
        isVercel: process.env.VERCEL === '1',
        nodeEnv: process.env.NODE_ENV,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0
      },
      database: {
        useDatabase,
        prismaAvailable: !!prisma
      },
      server: {
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      }
    };
    
    // Test profile loading
    try {
      const profiles = await loadProfiles();
      debugInfo.profiles = {
        count: profiles.profiles?.length || 0,
        source: useDatabase ? 'database' : 'file/fallback'
      };
    } catch (error) {
      debugInfo.profiles = {
        error: error.message
      };
    }
    
    // Test OpenAI import
    try {
      const OpenAI = (await import("openai")).default;
      debugInfo.openai = {
        imported: true,
        version: "imported successfully"
      };
    } catch (error) {
      debugInfo.openai = {
        imported: false,
        error: error.message
      };
    }
    
    res.json(debugInfo);
  } catch (error) {
    console.error("Debug endpoint error:", error);
    res.status(500).json({ error: "Debug endpoint failed", details: error.message });
  }
});

// Test grading endpoint with minimal data
app.post("/api/test-grade", async (req, res) => {
  try {
    console.log("=== TEST GRADING ENDPOINT ===");
    
    const testText = "This is a test essay. I like school very much.";
    const testPrompt = "Write about your school experience.";
    const testProfile = {
      id: "test",
      name: "Test Profile",
      cefrLevel: "B2",
      vocabulary: ["school", "experience", "education"],
      grammar: ["present tense", "adjectives"]
    };
    
    console.log("Testing unified grading function...");
    const result = await gradeEssayUnified(testText, testPrompt, testProfile);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error("Test grading error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Debug endpoint to see what the form is sending
app.post("/api/debug-form", async (req, res) => {
  console.log("=== DEBUG FORM DATA ===");
  console.log("Raw body:", JSON.stringify(req.body, null, 2));
  console.log("Headers:", req.headers);
  
  res.json({
    received_data: req.body,
    data_types: {
      studentText: typeof req.body.studentText,
      prompt: typeof req.body.prompt,
      classProfile: typeof req.body.classProfile
    },
    lengths: {
      studentText: req.body.studentText?.length || 0,
      prompt: req.body.prompt?.length || 0
    }
  });
});

// Debug endpoint that mirrors the exact grading logic with error capture
app.post("/api/debug-grade", async (req, res) => {
  try {
    const { studentText, prompt, classProfile } = req.body;
    
    console.log("=== DEBUG GRADE ENDPOINT ===");
    console.log("Request data:", { studentText: studentText?.length, prompt, classProfile });
    
    // Mirror the exact logic from /api/grade
    if (isVercel) {
      console.log("Environment: Vercel");
      console.log("Looking for profile:", classProfile);
      
      let profileData;
      if (useDatabase && prisma) {
        console.log("Using database search...");
        profileData = await prisma.classProfile.findFirst({
          where: { id: classProfile }
        });
        console.log("Database result:", profileData ? "FOUND" : "NOT FOUND");
      } else {
        console.log("Using file system search...");
        const profiles = await loadProfiles();
        profileData = profiles.profiles?.find(p => p.id === classProfile);
      }
      
      if (!profileData) {
        return res.json({
          success: false,
          error: "Profile not found",
          debug: {
            requested: classProfile,
            useDatabase,
            prismaAvailable: !!prisma
          }
        });
      }
      
      console.log("Profile found, attempting grading...");
      const result = await gradeEssayUnified(studentText, prompt, profileData);
      
      res.json({
        success: true,
        result,
        debug: {
          profileUsed: profileData.name,
          environment: "vercel"
        }
      });
      
    } else {
      res.json({
        success: false,
        error: "Debug endpoint only works in Vercel environment"
      });
    }
    
  } catch (error) {
    console.error("Debug grade error:", error);
    res.json({
      success: false,
      error: error.message,
      stack: error.stack,
      debug: {
        errorType: error.constructor.name,
        isVercel,
        useDatabase,
        prismaAvailable: !!prisma
      }
    });
  }
});

// UNIFIED GRADING FUNCTION - Works identically local and Vercel
async function gradeEssayUnified(studentText, prompt, profileData) {
  console.log('=== STARTING UNIFIED TWO-STEP GRADING ===');
  console.log('Profile:', profileData.name);
  console.log('Student text length:', studentText?.length);
  
  try {
    // Import OpenAI dynamically for serverless compatibility
    const OpenAI = (await import("openai")).default;
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Embedded rubric data (from rubric.json) - no file dependencies!
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
          "weight": 15
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
          "weight": 10
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

    console.log('🔍 STEP 1: Error Detection & Highlighting...');
    
    // STEP 1: Error Detection with color-coded highlighting
    const errorDetectionPrompt = `Please grade the below essay and identify specific errors. You are good at analyzing natural language.

Mark the essay using these categories:
- grammar (tense, agreement, articles, word order, modal/auxiliary use)
- mechanics-punctuation (capitalization, commas, periods, run-ons)  
- spelling (misspellings)
- vocabulary-structure (word choice, collocations)
- needs-rephrasing (unclear sentence that needs restructuring)
- redundancy
- non-suitable-words (words that should be removed)
- fluency (naturalness coaching)

Class Profile: ${profileData.name}
Expected Vocabulary: ${profileData.vocabulary.slice(0, 10).join(', ')}
Expected Grammar: ${profileData.grammar.slice(0, 5).join(', ')}

Student Essay:
${studentText}

For each error found, return this JSON format:
{
  "errors": [
    {
      "category": "grammar|mechanics-punctuation|spelling|vocabulary-structure|needs-rephrasing|redundancy|non-suitable-words|fluency",
      "text": "exact text from essay with error",
      "correction": "suggested correction",
      "explanation": "brief explanation of the error"
    }
  ]
}

Return ONLY valid JSON.`;

    const errorResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: errorDetectionPrompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    let errorResults = { errors: [] };
    try {
      const errorText = errorResponse.choices[0].message.content;
      const cleanedErrorText = errorText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      errorResults = JSON.parse(cleanedErrorText);
    } catch (e) {
      console.warn('Error parsing error detection:', e.message);
    }

    console.log('🔍 Found', errorResults.errors?.length || 0, 'errors');
    console.log('📊 STEP 2: Comprehensive Grading...');

    // STEP 2: Comprehensive grading based on rubric
    const gradingPrompt = `You are an ESL teacher grading a ${profileData.cefrLevel}-level student essay using a detailed rubric.

Class Profile: ${profileData.name}
Expected Vocabulary: ${profileData.vocabulary.join(', ')}
Expected Grammar: ${profileData.grammar.join(', ')}

Assignment Prompt: ${prompt}

Student Essay:
${studentText}

Errors Found: ${JSON.stringify(errorResults.errors || [])}

Grade this essay using the following rubric (total 100 points):
- Grammar (15 points): Tenses, subject/verb agreement, structures from class
- Vocabulary (15 points): Correct use of class vocabulary  
- Spelling (15 points): Accuracy of spelling
- Mechanics & Punctuation (15 points): Capitalization, commas, periods
- Fluency (10 points): Organization and logical flow
- Layout & Specs (15 points): Structure, length, transition words
- Content & Information (15 points): Completeness and relevance of ideas

For each category, provide points earned and brief rationale.
Also identify:
- Word count
- Class vocabulary words used
- Grammar structures demonstrated  
- Transition words found

Return ONLY this JSON format:
{
  "total": {"points": [total], "out_of": 100},
  "scores": {
    "grammar": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "vocabulary": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "spelling": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "mechanics": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "fluency": {"points": [0-10], "out_of": 10, "rationale": "..."},
    "layout": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "content": {"points": [0-15], "out_of": 15, "rationale": "..."}
  },
  "teacher_notes": "Overall feedback...",
  "meta": {
    "word_count": [number],
    "class_vocabulary_used": ["word1", "word2"],
    "transition_words_found": ["however", "therefore"],
    "grammar_structures_used": ["structure1", "structure2"]
  }
}`;

    const gradingResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [{ role: "user", content: gradingPrompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const gradingText = gradingResponse.choices[0].message.content;
    const cleanedGrading = gradingText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const gradingResult = JSON.parse(cleanedGrading);

    // Calculate total points correctly
    const totalPoints = Object.values(gradingResult.scores).reduce((sum, score) => sum + score.points, 0);
    gradingResult.total = { points: totalPoints, out_of: 100 };

    // Convert errors to inline_issues format for the formatter
    gradingResult.inline_issues = (errorResults.errors || []).map(error => ({
      category: error.category,
      text: error.text,
      start: studentText.indexOf(error.text),
      end: studentText.indexOf(error.text) + error.text.length,
      correction: error.correction,
      explanation: error.explanation
    })).filter(issue => issue.start !== -1); // Only include found text

    gradingResult.rubric = rubric;
    gradingResult.encouragement_next_steps = gradingResult.teacher_notes;

    console.log('✅ UNIFIED GRADING COMPLETED:', gradingResult.total);
    console.log('🎨 Generated', gradingResult.inline_issues.length, 'inline issues for highlighting');
    return gradingResult;
    
  } catch (error) {
    console.error('❌ UNIFIED GRADING ERROR:', error);
    throw error;
  }
}

const PORT = 3001;
// Heartbeat disabled
// setInterval(() => {
//   console.log("[tick] server alive -", new Date().toLocaleTimeString());
//   console.log("[tick] memory usage:", Math.round(process.memoryUsage().heapUsed / 1024 / 1024), "MB");
// }, 15000);

// For local development, start the server
// For Vercel serverless, export the app
if (!isVercel) {
  app.listen(PORT, () => {
    console.log("\n=== SERVER SUCCESSFULLY STARTED ===\n");
    console.log(`🌐 Grader running on http://localhost:${PORT}`);
    console.log("📝 Submit essays to see grading logs here");
    console.log("⏱️  Heartbeat every 15 seconds\n");
  });
} else {
  console.log("🚀 Configured for Vercel serverless deployment");
}

// Export for Vercel serverless functions
export default app;
