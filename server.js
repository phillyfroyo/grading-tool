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
            ${generateCSS()}
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
                        studentName: originalData.studentName
                    })
                })
                .then(response => response.json())
                .then(formatted => {
                    resultsDiv.innerHTML = \`
                        <h2>Grading Results for \${originalData.studentName}</h2>
                        \${formatted.feedbackSummary}
                        
                        <h3>Color-Coded Essay:</h3>
                        <div class="formatted-essay">
                            \${formatted.formattedText}
                        </div>
                        
                        <div style="margin-top: 20px;">
                            <button onclick="exportToPDF()">Export to PDF</button>
                            <button onclick="exportToHTML()">Export to HTML</button>
                        </div>
                    \`;
                    resultsDiv.style.display = 'block';
                })
                .catch(error => {
                    console.error('Formatting error:', error);
                    resultsDiv.innerHTML = '<div class="error">Error formatting results.</div>';
                    resultsDiv.style.display = 'block';
                });
            }
            
            function exportToPDF() {
                window.print();
            }
            
            function exportToHTML() {
                const content = document.getElementById('results').innerHTML;
                const blob = new Blob([content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'graded_essay.html';
                a.click();
                URL.revokeObjectURL(url);
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
  const { studentText, gradingResults, studentName } = req.body;
  
  try {
    const formatted = formatGradedEssay(studentText, gradingResults);
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
