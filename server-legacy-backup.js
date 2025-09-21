// LEGACY SERVER BACKUP
// This file contains the original monolithic server implementation
// Backed up on 2025-09-19 during server architecture cleanup
// Original file: server-original.js (40045 bytes, 1033 lines)
// This backup preserves all functionality for reference

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

// Apply temperature adjustment to grading results
function applyTemperatureAdjustment(gradingResult, temperature) {
  if (temperature === 0) {
    return gradingResult; // No adjustment needed
  }

  console.log(`\n🌡️ APPLYING TEMPERATURE ADJUSTMENT: ${temperature}`);

  const adjustedResult = JSON.parse(JSON.stringify(gradingResult)); // Deep clone

  for (const [category, scoreData] of Object.entries(adjustedResult.scores || {})) {
    const originalPoints = scoreData.points;
    const maxPoints = scoreData.out_of;

    // Calculate adjustment: +1 temp = +10% of max points
    const adjustment = maxPoints * (temperature * 0.1);
    const adjustedPoints = Math.min(maxPoints, Math.max(0, originalPoints + adjustment));

    scoreData.points = Math.round(adjustedPoints);

    console.log(`  ${category}: ${originalPoints} → ${scoreData.points} (out of ${maxPoints}) [+${Math.round(adjustment)}]`);
  }

  // Update total score
  const newTotal = Object.values(adjustedResult.scores || {}).reduce((sum, score) => sum + score.points, 0);
  const maxTotal = Object.values(adjustedResult.scores || {}).reduce((sum, score) => sum + score.out_of, 0);

  if (adjustedResult.total) {
    adjustedResult.total.points = newTotal;
    adjustedResult.total.out_of = maxTotal;
  }

  console.log(`  TOTAL: ${gradingResult.total?.points || 0} → ${newTotal} (out of ${maxTotal})`);
  console.log(`🌡️ TEMPERATURE ADJUSTMENT COMPLETE\n`);

  return adjustedResult;
}

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
  // Temporarily force file system usage to match endpoint behavior
  if (false && useDatabase && prisma) {
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
  // Temporarily force file system usage for profile updates to avoid DB schema issues
  if (false && useDatabase && prisma) {
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
// Configure static file serving with proper headers and caching
app.use(express.static('public', {
  setHeaders: (res, path) => {
    // Set proper MIME types
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }

    // Set caching headers for static assets (1 hour for development)
    if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.svg') || path.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Serve the main grading interface
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Grade essay endpoint
app.post("/grade", async (req, res) => {
  const { studentText, prompt, classProfile, temperature } = req.body;

  console.log("\n🔥 GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);
  console.log("Timestamp:", new Date().toLocaleString());

  try {
    console.log("\n⚡ STARTING TWO-STEP GRADING PROCESS...");
    const result = await gradeEssay(studentText, prompt, classProfile);
    console.log("\n✅ GRADING COMPLETED SUCCESSFULLY!");
    console.log("Original score:", result.total?.points + "/" + result.total?.out_of);

    // Apply temperature adjustment
    const finalResult = applyTemperatureAdjustment(result, temperature || 0);
    console.log("Final score after temperature:", finalResult.total?.points + "/" + finalResult.total?.out_of);

    res.json(finalResult);
  } catch (error) {
    console.error("\n❌ GRADING ERROR:", error);
    res.status(500).json({ error: "Error grading essay", details: error.message });
  }
});

// Format graded essay endpoint
app.post("/format", async (req, res) => {
  const { studentText, gradingResults, studentName, editable, options } = req.body;
  const finalOptions = { ...options, editable };

  console.log("=== FORMAT ENDPOINT CALLED ===");
  console.log("Student text length:", studentText?.length);
  console.log("Student text preview:", studentText?.substring(0, 100) + '...');
  console.log("Student name:", studentName);
  console.log("Grading results keys:", Object.keys(gradingResults || {}));
  console.log("Grading results structure:", JSON.stringify(gradingResults, null, 2));
  console.log("Inline issues count:", gradingResults?.inline_issues?.length || 0);
  console.log("Final options:", finalOptions);

  // Validate required parameters
  if (!studentText) {
    console.error("❌ Missing studentText parameter");
    return res.json({
      success: false,
      error: "Missing studentText parameter",
      details: "studentText is required for formatting"
    });
  }

  if (!gradingResults) {
    console.error("❌ Missing gradingResults parameter");
    return res.json({
      success: false,
      error: "Missing gradingResults parameter",
      details: "gradingResults is required for formatting"
    });
  }

  try {
    console.log("🎨 Calling formatGradedEssay...");
    const formatted = formatGradedEssay(studentText, gradingResults, finalOptions);
    console.log("✅ Format completed successfully");

    // Ensure we return the correct structure
    const result = {
      success: true,
      formattedText: formatted.formattedText,
      feedbackSummary: formatted.feedbackSummary,
      errors: formatted.errors || [],
      overallScore: formatted.overallScore || 0,
      segments: formatted.segments || null
    };

    console.log("📤 Sending formatted result:", Object.keys(result));
    res.json(result);
  } catch (error) {
    console.error("❌ FORMAT ERROR:", error);
    console.error("Error stack:", error.stack);
    res.json({
      success: false,
      error: "Error formatting essay",
      details: error.message,
      stack: error.stack
    });
  }
});

// Profile management API endpoints
app.get("/api/profiles", async (req, res) => {
  try {
    // Temporarily force file system usage to match PUT endpoint behavior
    if (false && useDatabase && prisma) {
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
    // Temporarily force file system usage for profile creation to avoid DB schema issues
    if (false && useDatabase && prisma) {
      const createData = {
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
      };

      // Only add temperature if it exists in the request (avoid DB schema issues)
      if (req.body.temperature !== undefined) {
        createData.temperature = req.body.temperature || 0;
      }

      const newProfile = await prisma.classProfile.create({
        data: createData
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
        temperature: req.body.temperature || 0,
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
    // Temporarily force file system usage for profile updates to avoid DB schema issues
    if (false && useDatabase && prisma) {
      const updateData = {
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
      };

      // Only add temperature if it exists in the request (avoid DB schema issues)
      if (req.body.temperature !== undefined) {
        updateData.temperature = req.body.temperature || 0;
      }

      const updatedProfile = await prisma.classProfile.update({
        where: { id: req.params.id },
        data: updateData
      });
      res.json(updatedProfile);
    } else {
      const profiles = await loadProfiles();
      const profileIndex = profiles.profiles.findIndex(p => p.id === req.params.id);

      if (profileIndex === -1) {
        return res.status(404).json({ error: "Profile not found" });
      }

      console.log('📝 UPDATING PROFILE:', req.params.id);
      console.log('📝 Request body:', req.body);
      console.log('📝 Profile found at index:', profileIndex);

      profiles.profiles[profileIndex] = {
        ...profiles.profiles[profileIndex],
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
        temperature: req.body.temperature || 0,
        lastModified: new Date().toISOString()
      };

      console.log('📝 Updated profile:', profiles.profiles[profileIndex]);

      await saveProfiles(profiles);
      console.log('📝 Profile saved successfully');
      res.json(profiles.profiles[profileIndex]);
    }
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error('❌ ERROR UPDATING PROFILE:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Profile ID:', req.params.id);
    res.status(500).json({ error: "Error updating profile", details: error.message });
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
  const { studentText, prompt, classProfile, temperature } = req.body;

  console.log("\n🔥 API GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);
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
    console.log("Original score:", result.total?.points + "/" + result.total?.out_of);

    // Apply temperature adjustment using profile temperature or explicit temperature
    const finalTemperature = temperature !== undefined ? temperature : (profileData.temperature || 0);
    const finalResult = applyTemperatureAdjustment(result, finalTemperature);
    console.log("Final score after temperature:", finalResult.total?.points + "/" + finalResult.total?.out_of);

    res.json(finalResult);
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

// Batch grading endpoint for multiple essays
app.post("/api/grade-batch", async (req, res) => {
  const { essays, prompt, classProfile, temperature } = req.body;

  console.log("\n🔥 BATCH GRADING REQUEST RECEIVED 🔥");
  console.log("Number of essays:", essays?.length || 0);
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);
  console.log("Environment:", isVercel ? 'Vercel' : 'Local');

  try {
    if (!essays || essays.length === 0) {
      return res.status(400).json({ error: "No essays provided for grading" });
    }

    console.log("\n⚡ STARTING BATCH GRADING SYSTEM...");
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
    console.log("🤖 Grading", essays.length, "essays using UNIFIED grading system...");

    const results = [];
    const finalTemperature = temperature !== undefined ? temperature : (profileData.temperature || 0);

    // Grade each essay
    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];
      console.log(`\n📝 Grading essay ${i + 1}/${essays.length} for ${essay.studentName}...`);

      try {
        const result = await gradeEssayUnified(essay.studentText, prompt, profileData);
        console.log(`✅ Essay ${i + 1} graded successfully`);

        // Apply temperature adjustment
        const finalResult = applyTemperatureAdjustment(result, finalTemperature);
        finalResult.studentName = essay.studentName;

        results.push({
          success: true,
          studentName: essay.studentName,
          result: finalResult
        });
      } catch (error) {
        console.error(`❌ Error grading essay ${i + 1} for ${essay.studentName}:`, error);
        results.push({
          success: false,
          studentName: essay.studentName,
          error: error.message
        });
      }
    }

    console.log("\n✅ BATCH GRADING COMPLETED!");
    console.log("Successfully graded:", results.filter(r => r.success).length);
    console.log("Failed:", results.filter(r => !r.success).length);

    res.json({
      success: true,
      totalEssays: essays.length,
      results: results
    });
  } catch (error) {
    console.error("\n❌ BATCH GRADING ERROR:", error);
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
          hasEssays: !!req.body.essays,
          essayCount: req.body.essays?.length || 0,
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
          "weight": 10
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
          "weight": 15
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
- Spelling (10 points): Accuracy of spelling
- Mechanics & Punctuation (15 points): Capitalization, commas, periods
- Fluency (15 points): Organization and logical flow
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
    "spelling": {"points": [0-10], "out_of": 10, "rationale": "..."},
    "mechanics": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "fluency": {"points": [0-15], "out_of": 15, "rationale": "..."},
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
    console.log('=== RAW GRADING RESPONSE ===');
    console.log(gradingText);
    console.log('=== END RAW GRADING RESPONSE ===');

    const cleanedGrading = gradingText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('=== CLEANED GRADING JSON ===');
    console.log(cleanedGrading);
    console.log('=== END CLEANED JSON ===');

    let gradingResult;
    try {
      gradingResult = JSON.parse(cleanedGrading);
    } catch (error) {
      console.error('JSON parsing failed:', error.message);
      console.error('Invalid JSON at character position:', error.message.match(/position (\d+)/)?.[1]);
      throw error;
    }

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