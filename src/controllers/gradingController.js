// Grading controller
// Route handlers for grading-related endpoints

import { gradeEssayUnified, gradeLegacy } from '../services/gradingService.js';
import { findProfileById } from '../services/profileService.js';
import { applyTemperatureAdjustment } from '../services/temperatureService.js';
import { formatGradedEssay } from '../../grader/formatter.js';
import { isVercel } from '../config/index.js';
import { getProcessingStats, resetEssayCounter, enableBatchControllerMode, disableBatchControllerMode } from '../../grader/grader-two-step.js';

// Simple session store for streaming batch grading
const streamingSessions = new Map();

/**
 * Legacy grade endpoint handler (/grade)
 */
async function handleLegacyGrade(req, res) {
  const { studentText, prompt, classProfile, temperature } = req.body;

  console.log("\n🔥 GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);
  console.log("Timestamp:", new Date().toLocaleString());

  try {
    console.log("\n⚡ STARTING TWO-STEP GRADING PROCESS...");
    const result = await gradeLegacy(studentText, prompt, classProfile);
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
}

/**
 * API grade endpoint handler (/api/grade)
 */
async function handleApiGrade(req, res) {
  const { studentText, prompt, classProfile, temperature } = req.body;

  console.log("\n🔥 API GRADING REQUEST RECEIVED 🔥");
  console.log("Student text length:", studentText?.length || 0, "characters");
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);
  console.log("Environment:", isVercel ? 'Vercel' : 'Local');

  try {
    console.log("\n⚡ STARTING UNIFIED GRADING SYSTEM...");
    console.log("🔍 Looking for profile:", classProfile);

    // Get userId from session or cookies (same logic as profile controller)
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }
    console.log("🔑 User ID for grading:", userId, "from session:", !!req.session?.userId, "from cookies:", !!req.signedCookies?.userId);

    // Get profile data (unified for both environments)
    const profileData = await findProfileById(classProfile, userId);

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

    const responseObject = {
      success: true,
      scores: finalResult.scores,
      total: finalResult.total,
      meta: finalResult.meta,
      teacher_notes: finalResult.teacher_notes,
      encouragement_next_steps: finalResult.encouragement_next_steps,
      inline_issues: finalResult.inline_issues,
      formattedText: finalResult.formattedText,
      feedbackSummary: finalResult.feedbackSummary,
      errors: finalResult.errors,
      overallScore: finalResult.overallScore,
      segments: finalResult.segments
    };

    console.log("📤 Sending response with success field:", responseObject.success);
    res.json(responseObject);
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
        requestData: {
          hasStudentText: !!req.body.studentText,
          hasPrompt: !!req.body.prompt,
          classProfile: req.body.classProfile
        }
      }
    });
  }
}

/**
 * Batch grading endpoint handler (/api/grade-batch)
 */
async function handleBatchGrade(req, res) {
  const { essays, prompt, classProfile, temperature } = req.body;
  const isStreaming = req.query.stream === 'true';

  console.log(`\n🔥 ${isStreaming ? 'STREAMING' : 'BATCH'} GRADING REQUEST RECEIVED 🔥`);
  console.log("Number of essays:", essays?.length || 0);
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);
  console.log("Streaming mode:", isStreaming);
  console.log("Environment:", isVercel ? 'Vercel' : 'Local');

  // If streaming mode is requested, set up Server-Sent Events
  if (isStreaming) {
    return handleStreamingBatchGrade(req, res, { essays, prompt, classProfile, temperature });
  }

  try {
    if (!essays || essays.length === 0) {
      return res.status(400).json({ error: "No essays provided for grading" });
    }

    console.log("\n⚡ STARTING BATCH GRADING SYSTEM...");
    console.log("🔍 Looking for profile:", classProfile);

    // Get userId from session or cookies (same logic as profile controller)
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }
    console.log("🔑 User ID for batch grading:", userId, "from session:", !!req.session?.userId, "from cookies:", !!req.signedCookies?.userId);

    // Get profile data (unified for both environments)
    const profileData = await findProfileById(classProfile, userId);

    if (!profileData) {
      console.log("❌ Profile not found, returning 404");
      return res.status(404).json({ error: "Class profile not found", requested: classProfile });
    }

    console.log("✅ Profile found:", profileData.name);
    console.log("🤖 Grading", essays.length, "essays using UNIFIED grading system...");

    const results = [];
    const finalTemperature = temperature !== undefined ? temperature : (profileData.temperature || 0);

    // Reset essay counter and enable batch controller mode
    resetEssayCounter();
    enableBatchControllerMode();
    console.log("🔄 Reset essay counter and enabled batch controller mode");

    // Grade each essay with cooling period management
    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];

      // Check if we need a cooling period BEFORE processing this essay
      const stats = getProcessingStats();
      console.log(`📊 Pre-processing stats: ${stats.essaysProcessed} processed, batch position ${stats.currentBatchPosition}, essays until cooling: ${stats.essaysUntilCooling}`);

      // If we've processed essays and are at a batch boundary (6, 12, 18, etc.), enforce cooling
      if (stats.essaysProcessed > 0 && stats.essaysUntilCooling === 0) {
        console.log(`🧊 BATCH COOLING: Completed ${stats.essaysProcessed} essays. Enforcing 90s cooling period before processing "${essay.studentName}"...`);
        console.log(`⏰ Cooling period started at: ${new Date().toISOString()}`);

        // 90-second cooling period
        await new Promise(resolve => setTimeout(resolve, 90000));

        console.log(`✅ Cooling period complete at: ${new Date().toISOString()}. Resuming with "${essay.studentName}"...`);
      }

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

    // Disable batch controller mode after completion
    disableBatchControllerMode();
    console.log("🔄 Disabled batch controller mode");

    res.json({
      success: true,
      totalEssays: essays.length,
      results: results
    });
  } catch (error) {
    console.error("\n❌ BATCH GRADING ERROR:", error);
    console.error("Error stack:", error.stack);

    // Ensure batch controller mode is disabled even on error
    disableBatchControllerMode();
    console.log("🔄 Disabled batch controller mode (error cleanup)");
    res.json({
      success: false,
      error: error.message,
      details: error.stack,
      debug: {
        errorType: error.constructor.name,
        isVercel,
        requestData: {
          hasEssays: !!req.body.essays,
          essayCount: req.body.essays?.length || 0,
          hasPrompt: !!req.body.prompt,
          classProfile: req.body.classProfile
        }
      }
    });
  }
}

/**
 * Handle streaming batch grading using Server-Sent Events
 */
async function handleStreamingBatchGrade(req, res, { essays, prompt, classProfile, temperature }) {
  try {
    console.log("\n🌊 STARTING STREAMING BATCH GRADING WITH PARALLEL BATCHES 🌊");
    console.log(`📊 Processing ${essays.length} essays in batches of 3`);

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Get profile data
    console.log("🔍 Looking for profile:", classProfile);

    // Get userId from session or cookies (same logic as profile controller)
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }
    console.log("🔑 User ID for streaming grading:", userId, "from session:", !!req.session?.userId, "from cookies:", !!req.signedCookies?.userId);

    const profileData = await findProfileById(classProfile, userId);
    if (!profileData) {
      const errorMsg = `Profile not found: ${classProfile}`;
      console.error("❌", errorMsg);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: errorMsg
      })}\n\n`);
      res.end();
      return;
    }

    console.log("✅ Profile found:", profileData.name);
    const finalTemperature = temperature !== undefined ? temperature : (profileData.temperature || 0);

    // Reset essay counter and enable batch controller mode for streaming
    resetEssayCounter();
    enableBatchControllerMode();
    console.log("🔄 Reset essay counter and enabled batch controller mode for streaming");

    // Send initial status
    res.write(`data: ${JSON.stringify({
      type: 'start',
      totalEssays: essays.length,
      message: 'Starting parallel batch grading...'
    })}\n\n`);

    // Process essays in parallel batches of 3 for optimal performance
    const BATCH_SIZE = 3;
    let currentBatch = 1;
    const totalBatches = Math.ceil(essays.length / BATCH_SIZE);

    for (let batchStart = 0; batchStart < essays.length; batchStart += BATCH_SIZE) {
      // Check if we need a cooling period before processing this batch
      // Apply cooling logic at every 2nd batch (after 6 essays: batch 3, 5, 7, etc.)
      if (currentBatch > 2 && (currentBatch - 1) % 2 === 0) {
        console.log(`🧊 STREAMING COOLING: Completed ${(currentBatch - 1) * BATCH_SIZE} essays. Enforcing 90s cooling period before batch ${currentBatch}...`);
        console.log(`⏰ Cooling period started at: ${new Date().toISOString()}`);

        // Send cooling period notification
        res.write(`data: ${JSON.stringify({
          type: 'cooling',
          message: `Cooling period: 90 seconds before processing batch ${currentBatch}...`,
          batch: currentBatch,
          totalBatches: totalBatches
        })}\n\n`);

        // 90-second cooling period
        await new Promise(resolve => setTimeout(resolve, 90000));

        console.log(`✅ Cooling period complete at: ${new Date().toISOString()}. Resuming with batch ${currentBatch}...`);

        // Send cooling complete notification
        res.write(`data: ${JSON.stringify({
          type: 'cooling_complete',
          message: `Cooling period complete. Resuming batch ${currentBatch}...`,
          batch: currentBatch,
          totalBatches: totalBatches
        })}\n\n`);
      }
      const batchEnd = Math.min(batchStart + BATCH_SIZE, essays.length);
      const batch = essays.slice(batchStart, batchEnd);

      console.log(`\n🚀 Processing batch ${currentBatch}/${totalBatches} (essays ${batchStart + 1}-${batchEnd})`);

      // Send processing status for all essays in this batch
      batch.forEach((essay, batchIndex) => {
        const globalIndex = batchStart + batchIndex;
        res.write(`data: ${JSON.stringify({
          type: 'processing',
          index: globalIndex,
          studentName: essay.studentName,
          message: `Processing ${essay.studentName} (Batch ${currentBatch}/${totalBatches})...`,
          batch: currentBatch,
          totalBatches: totalBatches
        })}\n\n`);
      });

      // Process essays in this batch sequentially (not parallel) to avoid hanging issues
      const batchResults = [];
      for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
        const essay = batch[batchIndex];
        const globalIndex = batchStart + batchIndex;

        try {
          console.log(`📝 Grading essay ${globalIndex + 1}/${essays.length} for ${essay.studentName}...`);

          const result = await gradeEssayUnified(essay.studentText, prompt, profileData);
          console.log(`✅ Essay ${globalIndex + 1} graded successfully`);

          // Apply temperature adjustment
          const finalResult = applyTemperatureAdjustment(result, finalTemperature);
          finalResult.studentName = essay.studentName;

          const essayResult = {
            index: globalIndex,
            success: true,
            studentName: essay.studentName,
            result: finalResult
          };

          batchResults.push({ status: 'fulfilled', value: essayResult });

          // Send immediate result via SSE
          res.write(`data: ${JSON.stringify({
            type: 'result',
            index: globalIndex,
            studentName: essay.studentName,
            success: true,
            result: finalResult
          })}\n\n`);

        } catch (error) {
          console.error(`❌ Error grading essay ${globalIndex + 1} for ${essay.studentName}:`, error);

          const errorResult = {
            index: globalIndex,
            success: false,
            studentName: essay.studentName,
            error: error.message
          };

          batchResults.push({ status: 'rejected', reason: error, value: errorResult });

          // Send immediate error via SSE
          res.write(`data: ${JSON.stringify({
            type: 'result',
            index: globalIndex,
            studentName: essay.studentName,
            success: false,
            error: error.message
          })}\n\n`);
        }
      }

      // Extract results and sort them to maintain a consistent order for the delay
      const processedResults = batchResults
        .map(result => result.status === 'fulfilled' ? result.value : null)
        .filter(result => result !== null);

      // Stream results with a 500ms delay between each for better UX
      for (let i = 0; i < processedResults.length; i++) {
        const result = processedResults[i];

        // Add delay between essays (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        res.write(`data: ${JSON.stringify({
          type: 'result',
          ...result
        })}\n\n`);

        console.log(`📤 Streamed result for ${result.studentName} (index: ${result.index})`);
      }

      console.log(`✅ Batch ${currentBatch}/${totalBatches} completed - ${batchResults.length} essays processed`);
      currentBatch++;
    }

    // Send completion status
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: `All ${essays.length} essays processed in ${totalBatches} batches`
    })}\n\n`);

    res.end();
    console.log(`\n✅ STREAMING BATCH GRADING COMPLETED! ${essays.length} essays in ${totalBatches} batches`);

    // Disable batch controller mode after streaming completion
    disableBatchControllerMode();
    console.log("🔄 Disabled batch controller mode (streaming completed)");

  } catch (error) {
    console.error("\n❌ STREAMING BATCH GRADING ERROR:", error);

    // Ensure batch controller mode is disabled even on error
    disableBatchControllerMode();
    console.log("🔄 Disabled batch controller mode (streaming error cleanup)");
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
}

/**
 * Format graded essay endpoint handler (/format)
 */
async function handleFormatEssay(req, res) {
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
}

/**
 * Debug endpoint handler (/api/debug)
 */
async function handleDebug(req, res) {
  try {
    console.log("=== DEBUG ENDPOINT CALLED ===");
    const debugInfo = {
      environment: {
        isVercel: process.env.VERCEL === '1',
        nodeEnv: process.env.NODE_ENV,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0
      },
      server: {
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      }
    };

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
}

/**
 * Test grading endpoint handler (/api/test-grade)
 */
async function handleTestGrade(req, res) {
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
}

/**
 * Debug form endpoint handler (/api/debug-form)
 */
async function handleDebugForm(req, res) {
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
}

/**
 * Debug grade endpoint handler (/api/debug-grade)
 */
async function handleDebugGrade(req, res) {
  try {
    const { studentText, prompt, classProfile } = req.body;

    console.log("=== DEBUG GRADE ENDPOINT ===");
    console.log("Request data:", { studentText: studentText?.length, prompt, classProfile });

    // Mirror the exact logic from /api/grade
    if (isVercel) {
      console.log("Environment: Vercel");
      console.log("Looking for profile:", classProfile);

      // Get userId from session or cookies (same logic as profile controller)
      let userId = req.session?.userId;
      if (!userId && req.signedCookies) {
        userId = req.signedCookies.userId;
      }
      console.log("🔑 User ID for debug grading:", userId, "from session:", !!req.session?.userId, "from cookies:", !!req.signedCookies?.userId);

      const profileData = await findProfileById(classProfile, userId);

      if (!profileData) {
        return res.json({
          success: false,
          error: "Profile not found",
          debug: {
            requested: classProfile
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
        isVercel
      }
    });
  }
}

// Session storage for streaming batch grading (already declared above)

/**
 * Initialize streaming batch grading session (/api/grade-batch-stream/init)
 */
async function handleBatchGradeStreamInit(req, res) {
  try {
    const { essays, prompt, classProfile, temperature } = req.body;

    // Validate input
    if (!essays || !Array.isArray(essays) || essays.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Essays array is required and must not be empty'
      });
    }

    // Generate a unique session ID
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // Store the session data
    streamingSessions.set(sessionId, {
      essays,
      prompt: prompt || 'Please provide detailed feedback',
      classProfile: classProfile || 'default-profile',
      temperature: temperature || 0,
      status: 'pending',
      createdAt: Date.now()
    });

    // Clean up old sessions (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, session] of streamingSessions.entries()) {
      if (session.createdAt < oneHourAgo) {
        streamingSessions.delete(id);
      }
    }

    console.log(`📋 Created streaming session ${sessionId} for ${essays.length} essays`);

    res.json({
      success: true,
      sessionId: sessionId,
      essayCount: essays.length
    });

  } catch (error) {
    console.error('Error initializing streaming session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Streaming batch grading endpoint handler (/api/grade-batch-stream/:sessionId)
 * Sends individual essay results as they complete using Server-Sent Events
 */
async function handleBatchGradeStream(req, res) {
  const sessionId = req.params.sessionId;
  const isStreamQuery = req.query.stream === 'true';

  // Handle GET request with stream=true parameter (for EventSource)
  if (isStreamQuery && !sessionId) {
    // Set up EventSource headers and wait for data
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      message: 'EventSource connected, waiting for data...'
    })}\n\n`);

    // Keep connection alive and wait for streaming sessions
    const keepAliveInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      })}\n\n`);
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(keepAliveInterval);
    });

    return;
  }

  // Get session data
  const sessionData = streamingSessions.get(sessionId);
  if (!sessionData) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired'
    });
  }

  const { essays, prompt, classProfile, temperature } = sessionData;

  console.log("\n🔥 STREAMING BATCH GRADING REQUEST RECEIVED 🔥");
  console.log("Number of essays:", essays?.length || 0);
  console.log("Class profile:", classProfile);
  console.log("Temperature:", temperature || 0);

  try {
    if (!essays || essays.length === 0) {
      return res.status(400).json({ error: "No essays provided for grading" });
    }

    console.log("\n⚡ STARTING STREAMING BATCH GRADING...");

    // Get userId from session or cookies (same logic as profile controller)
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }
    console.log("🔑 User ID for streaming batch grading:", userId, "from session:", !!req.session?.userId, "from cookies:", !!req.signedCookies?.userId);

    // Get profile data
    const profileData = await findProfileById(classProfile, userId);

    if (!profileData) {
      console.log("❌ Profile not found, returning 404");
      return res.status(404).json({ error: "Class profile not found", requested: classProfile });
    }

    console.log("✅ Profile found:", profileData.name);

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const finalTemperature = temperature !== undefined ? temperature : (profileData.temperature || 0);

    // Send initial status
    res.write(`data: ${JSON.stringify({
      type: 'start',
      totalEssays: essays.length,
      message: 'Starting batch grading...'
    })}\n\n`);

    // Process each essay and send results immediately
    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];
      console.log(`\n📝 Streaming essay ${i + 1}/${essays.length} for ${essay.studentName}...`);

      try {
        // Send processing status
        res.write(`data: ${JSON.stringify({
          type: 'processing',
          index: i,
          studentName: essay.studentName,
          message: `Processing ${essay.studentName}...`
        })}\n\n`);

        const result = await gradeEssayUnified(essay.studentText, prompt, profileData);
        console.log(`✅ Essay ${i + 1} graded successfully, streaming result...`);

        // Apply temperature adjustment
        const finalResult = applyTemperatureAdjustment(result, finalTemperature);
        finalResult.studentName = essay.studentName;

        // Send the completed result immediately
        res.write(`data: ${JSON.stringify({
          type: 'result',
          index: i,
          success: true,
          studentName: essay.studentName,
          result: finalResult
        })}\n\n`);

      } catch (error) {
        console.error(`❌ Error grading essay ${i + 1} for ${essay.studentName}:`, error);

        // Send error immediately
        res.write(`data: ${JSON.stringify({
          type: 'result',
          index: i,
          success: false,
          studentName: essay.studentName,
          error: error.message
        })}\n\n`);
      }
    }

    // Send completion status
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: 'All essays processed'
    })}\n\n`);

    res.end();
    console.log("\n✅ STREAMING BATCH GRADING COMPLETED!");

    // Clean up the session
    streamingSessions.delete(sessionId);

    // Disable batch controller mode after completion
    disableBatchControllerMode();
    console.log("🔄 Disabled batch controller mode (stream session completed)");

  } catch (error) {
    console.error("\n❌ STREAMING BATCH GRADING ERROR:", error);

    // Ensure batch controller mode is disabled even on error
    disableBatchControllerMode();
    console.log("🔄 Disabled batch controller mode (stream session error cleanup)");
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();

    // Clean up the session on error
    streamingSessions.delete(sessionId);
  }
}

export {
  handleLegacyGrade,
  handleApiGrade,
  handleBatchGrade,
  handleBatchGradeStream,
  handleBatchGradeStreamInit,
  handleFormatEssay,
  handleDebug,
  handleTestGrade,
  handleDebugForm,
  handleDebugGrade
};
