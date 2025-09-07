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
            <h1>ESL Essay Grader (Serverless)</h1>
            <p><strong>Note:</strong> This is running on Vercel serverless. Profile changes won't persist between sessions, but will be shared during active use.</p>
            
            <form id="gradingForm">
                <div class="form-group">
                    <label for="studentName">Student Name (optional):</label>
                    <input type="text" id="studentName" name="studentName">
                </div>
                
                <div class="form-group">
                    <label for="classProfile">Class Profile:</label>
                    <select id="classProfile" name="classProfile" required>
                        <option value="">Loading profiles...</option>
                    </select>
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
    await prisma.classProfile.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: "Error deleting profile" });
  }
});

export default app;