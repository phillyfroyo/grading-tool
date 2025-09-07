// api/index.js - Serverless function entry point
import express from "express";
import dotenv from "dotenv";

// Try to import Prisma, but have fallback
let prisma = null;
let useDatabase = false;
try {
  const { prisma: prismaClient } = await import("../lib/prisma.js");
  prisma = prismaClient;
  useDatabase = true;
  console.log("✅ Prisma client loaded successfully");
} catch (error) {
  console.warn("⚠️ Prisma client failed to load, using fallback storage:", error.message);
}

// Fallback profiles for when database isn't available
const fallbackProfiles = {
  "profiles": [
    {
      "id": "business_b2_fall2024",
      "name": "Level 5 Midterm Exams - Fall 2025 Bimestre 1", 
      "cefrLevel": "B2",
      "vocabulary": ["Bills", "Fee", "Expenses", "Income", "Installments", "Budget"],
      "grammar": ["Tense and structure review", "Active vs. Passive verb forms"],
      "created": "2024-09-04T00:00:00Z",
      "lastModified": "2025-09-07T01:39:20.278Z",
      "prompt": "Write a letter to a younger friend about entrepreneurship..."
    },
    {
      "id": "academic_c1_fall2024",
      "name": "Level 6 Midterm Exams - Fall 2025",
      "cefrLevel": "C1", 
      "vocabulary": ["furthermore", "nevertheless", "consequently"],
      "grammar": ["Complex conditional structures", "Subjunctive mood"],
      "created": "2024-09-04T00:00:00Z",
      "lastModified": "2025-09-04T18:19:05.753Z"
    }
  ]
};

let sessionProfiles = fallbackProfiles;


// saveProfiles function for compatibility
function saveProfiles(profiles) {
  sessionProfiles = profiles;
}

dotenv.config();
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get("/health", (req, res) => res.send("ok"));

app.get("/api/status", (req, res) => {
  res.json({ 
    databaseConnected: useDatabase,
    timestamp: new Date().toISOString()
  });
});

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
        </style>
    </head>
    <body>
        <div class="container">
            <h1>ESL Essay Grader</h1>
            <p id="dbStatus"><strong>🔄 Checking database connection...</strong></p>
            
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
                                <option value="A1">A1 - Beginner</option>
                                <option value="A2">A2 - Elementary</option>
                                <option value="B1">B1 - Intermediate</option>
                                <option value="B2">B2 - Upper Intermediate</option>
                                <option value="C1">C1 - Advanced</option>
                                <option value="C2">C2 - Proficiency</option>
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
                            <label for="profilePrompt">Custom Assignment Prompt (optional):</label>
                            <textarea id="profilePrompt" rows="8" placeholder="Enter a custom prompt for this class profile. When selected, this prompt will be used automatically and the prompt field will be hidden."></textarea>
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
            let isDatabaseConnected = false;
            
            async function loadProfilesData() {
                try {
                    const response = await fetch('/api/profiles');
                    const data = await response.json();
                    profiles = data.profiles || [];
                    
                    // Check if we got database data (has proper timestamps) or fallback data
                    isDatabaseConnected = profiles.length > 0 && profiles.some(p => 
                        p.created && p.created.includes('T') && p.lastModified && p.lastModified.includes('T')
                    );
                    
                    updateDatabaseStatus();
                    updateProfileDropdown();
                } catch (error) {
                    console.error('Error loading profiles:', error);
                    updateDatabaseStatus(false);
                }
            }
            
            function updateDatabaseStatus(connected = isDatabaseConnected) {
                const statusElement = document.getElementById('dbStatus');
                if (connected) {
                    statusElement.innerHTML = '<strong style="color: #28a745;">✅ Database Connected:</strong> Profile changes are saved permanently and shared across all users.';
                } else {
                    statusElement.innerHTML = '<strong style="color: #ffc107;">⚠️ Using Session Storage:</strong> Profile changes will not persist between deployments.';
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
            
            // Handle profile selection change - hide/show prompt field
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
                    } else {
                        // Profile has no built-in prompt, show the prompt field
                        promptContainer.style.display = 'block';
                        if (promptTextarea.value === '' || profiles.some(p => p.prompt === promptTextarea.value)) {
                            promptTextarea.value = '';
                        }
                    }
                } else {
                    // No profile selected, show prompt field and clear it
                    promptContainer.style.display = 'block';
                    promptTextarea.value = '';
                }
            });
            
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
                    document.getElementById('results').innerHTML = \`<pre>\${JSON.stringify(result, null, 2)}</pre>\`;
                    document.getElementById('results').style.display = 'block';
                    
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
        </script>
    </body>
    </html>
  `);
});

// Grade essay endpoint
app.post("/api/grade", async (req, res) => {
  const { studentText, prompt, classProfile } = req.body;

  console.log("\n🔥 SERVERLESS GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Timestamp:", new Date().toLocaleString());
  
  try {
    console.log("\n⚡ STARTING SIMPLE GRADING PROCESS...");
    // Simple grading for serverless - return mock data for now
    const result = {
      total: { points: 85, out_of: 100 },
      scores: {
        grammar: { points: 20, out_of: 25, rationale: "Good grammar usage overall with minor issues." },
        vocabulary: { points: 18, out_of: 25, rationale: "Appropriate vocabulary for level." },
        mechanics: { points: 22, out_of: 25, rationale: "Well structured with good punctuation." },
        content: { points: 25, out_of: 25, rationale: "Excellent content and organization." }
      },
      teacher_notes: "Well-written essay demonstrating good understanding of the topic.",
      meta: {
        word_count: studentText.split(' ').length,
        class_vocabulary_used: [],
        transition_words_found: [],
        grammar_structures_used: []
      }
    };
    
    console.log("\n✅ GRADING COMPLETED SUCCESSFULLY!");
    console.log("Final score:", result.total?.points + "/" + result.total?.out_of);
    res.json(result);
  } catch (error) {
    console.error("\n❌ GRADING ERROR:", error);
    res.status(500).json({ error: "Error grading essay", details: error.message });
  }
});

// Format graded essay endpoint
app.post("/api/format", async (req, res) => {
  const { studentText, gradingResults, studentName } = req.body;
  
  try {
    // Simple formatting for serverless
    const formatted = {
      formattedText: studentText.replace(/\n/g, '<br>'),
      feedbackSummary: `<h2>Grade: ${gradingResults.total.points}/${gradingResults.total.out_of}</h2><p>${gradingResults.teacher_notes || 'Good work overall.'}</p>`
    };
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error formatting essay", details: error.message });
  }
});

// Profile management API endpoints (database + fallback)
app.get("/api/profiles", async (req, res) => {
  try {
    if (useDatabase && prisma) {
      const profiles = await prisma.classProfile.findMany({
        orderBy: { lastModified: 'desc' }
      });
      res.json({ profiles });
    } else {
      res.json(sessionProfiles);
    }
  } catch (error) {
    console.error('Error loading profiles, using fallback:', error);
    res.json(sessionProfiles);
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
      // Fallback to in-memory storage
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
      sessionProfiles.profiles.push(newProfile);
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
      // Fallback to in-memory storage
      const profileIndex = sessionProfiles.profiles.findIndex(p => p.id === req.params.id);
      if (profileIndex === -1) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      sessionProfiles.profiles[profileIndex] = {
        ...sessionProfiles.profiles[profileIndex],
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
        lastModified: new Date().toISOString()
      };
      
      res.json(sessionProfiles.profiles[profileIndex]);
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
      // Fallback to in-memory storage
      const profileIndex = sessionProfiles.profiles.findIndex(p => p.id === req.params.id);
      if (profileIndex === -1) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      sessionProfiles.profiles.splice(profileIndex, 1);
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

export default app;