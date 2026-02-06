/**
 * Form Handling Module
 * Handles form submission, validation, and manual grading form management
 */

// Inline error utility functions
function showInlineError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function hideInlineError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.textContent = '';
    }
}

/**
 * Handle manual grading form submission
 * @param {Event} e - Form submission event
 */
async function handleManualGradingSubmission(e) {
    e.preventDefault();
    console.log('🎯 MANUAL GRADING FORM SUBMITTED!');

    const formData = new FormData(e.target);
    const studentName = formData.get('studentName') || 'Student';
    const studentNickname = formData.get('studentNickname') || '';
    const essayText = formData.get('essayText') || '';

    if (!essayText.trim()) {
        showError('Please enter student essay text', 'Missing Essay Text');
        return;
    }

    // Show loading state
    const button = e.target.querySelector('.grade-button');
    const originalText = button.textContent;
    button.textContent = 'Generating Grade...';
    button.disabled = true;

    try {
        // Use the same GPT grading system but mark as manual mode
        const gradingData = {
            studentText: essayText,
            prompt: 'Manual grading mode - generate detailed feedback',
            classProfile: 'default-profile', // Use default profile for manual mode
            temperature: 0,
            studentName: studentName,
            studentNickname: studentNickname,
            isManualMode: true
        };

        const response = await fetch('/api/grade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gradingData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Mark result as manual and display
            result.isManual = true;
            result.studentName = studentName;
            result.originalEssayText = essayText;

            // Display results using the grading display module
            if (window.GradingDisplayModule) {
                window.GradingDisplayModule.displayResults(result, gradingData);
            } else {
                console.error('GradingDisplayModule not available');
            }
        } else {
            throw new Error(result.error || 'Grading failed');
        }

    } catch (error) {
        console.error('Manual grading error:', error);
        showError('Error generating grade: ' + error.message, 'Grading Error');
    } finally {
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Handle main grading form submission
 * @param {Event} e - Form submission event
 */
async function handleGradingFormSubmission(e) {
    e.preventDefault();

    // Detect which form is being submitted to determine provider
    const formId = e.target.id;
    const provider = formId === 'claudeGradingForm' ? 'claude' : 'openai';

    const formData = new FormData(e.target);
    const studentName = formData.get('studentName') || 'Student';
    const classProfile = formData.get('classProfile') || '';

    // Get temperature from the selected profile
    let temperature = 0;
    if (classProfile && window.ProfilesModule) {
        const profiles = window.ProfilesModule.getProfiles();
        const selectedProfile = profiles.find(p => p.id === classProfile);
        if (selectedProfile && selectedProfile.temperature !== undefined) {
            temperature = selectedProfile.temperature;
        }
    }
    // Fallback to form field if it exists (for backwards compatibility)
    if (!temperature) {
        const temp = parseFloat(formData.get('temperature'));
        temperature = (isNaN(temp) || !isFinite(temp)) ? 0 : temp;
    }

    // Get all student texts from the form
    const studentTexts = [];
    const textareas = e.target.querySelectorAll('.student-text');
    textareas.forEach((textarea, index) => {
        if (textarea.value.trim()) {
            const studentNameField = textarea.closest('.essay-entry').querySelector('.student-name');
            const studentNicknameField = textarea.closest('.essay-entry').querySelector('.student-nickname');
            const individualName = studentNameField ? studentNameField.value.trim() : '';
            const individualNickname = studentNicknameField ? studentNicknameField.value.trim() : '';
            studentTexts.push({
                text: textarea.value.trim(),
                studentName: individualName || `${studentName} ${index + 1}`.trim(),
                studentNickname: individualNickname
            });
        }
    });

    if (studentTexts.length === 0) {
        showError('Please enter at least one essay to grade.', 'No Essays Found');
        return;
    }


    // Show loading state
    // Find the submit button - different IDs for GPT vs Claude forms
    const button = e.target.querySelector('button[type="submit"]');
    if (!button) {
        console.error('Could not find submit button');
        return;
    }
    const originalText = button.textContent;
    button.textContent = 'Grading essays...';
    button.disabled = true;

    // Determine error element ID based on form
    const errorElementId = formId === 'claudeGradingForm' ? 'claudeClassProfileError' : 'classProfileError';

    try {
        if (studentTexts.length === 1) {
            // Single essay grading - validate requirements first
            const prompt = document.querySelector('#prompt')?.value?.trim() || '';

            // Validation: Must have either a class profile OR a custom prompt
            if (!classProfile && !prompt) {
                showInlineError(errorElementId, 'Please select a class profile');
                // Reset button state
                button.textContent = originalText;
                button.disabled = false;
                return;
            }

            // Clear any previous error
            hideInlineError(errorElementId);

            // Disable the other provider's tab while grading
            if (window.TabManagementModule) {
                window.TabManagementModule.disableInactiveTab(provider);
            }

            const gradingData = {
                studentText: studentTexts[0].text,
                studentName: studentTexts[0].studentName,
                studentNickname: studentTexts[0].studentNickname,
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature,
                provider: provider,
                isManualMode: false
            };

            // Show progress UI for single essay (same as batch)
            const singleEssayBatchData = {
                essays: [{
                    studentName: studentTexts[0].studentName,
                    studentNickname: studentTexts[0].studentNickname,
                    studentText: studentTexts[0].text
                }]
            };

            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.displayBatchProgress(singleEssayBatchData);
            }

            const response = await fetch('/api/grade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gradingData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Update progress UI to show completion
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.updateEssayStatus(0, true);
                }

                // Convert single result to batch format for consistent display
                const batchResult = {
                    results: [{
                        success: true,
                        studentName: studentTexts[0].studentName,
                        result: result.result || result
                    }],
                    totalEssays: 1
                };

                // Display using batch results display for consistent UI
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.displayBatchResults(batchResult, singleEssayBatchData);
                } else if (window.GradingDisplayModule) {
                    // Fallback to original display method
                    window.GradingDisplayModule.displayResults(result, gradingData);
                } else {
                    console.error('Neither BatchProcessingModule nor GradingDisplayModule available');
                }
            } else {
                // Update progress UI to show failure for single essay
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.updateEssayStatus(0, false, result.error || 'Grading failed');
                }
                console.error('📋 Grading failed - full response:', result);
                throw new Error(result.error || 'Grading failed');
            }
        } else {
            // Batch essay grading - validate requirements first
            const prompt = document.querySelector('#prompt')?.value?.trim() || '';

            // Validation: Must have either a class profile OR a custom prompt
            if (!classProfile && !prompt) {
                showInlineError(errorElementId, 'Please select a class profile');
                // Reset button state
                button.textContent = originalText;
                button.disabled = false;
                return;
            }

            // Clear any previous error
            hideInlineError(errorElementId);

            // Disable the other provider's tab while grading
            if (window.TabManagementModule) {
                window.TabManagementModule.disableInactiveTab(provider);
            }

            // Note: classProfile is optional if custom prompt is provided

            const batchData = {
                essays: studentTexts.map(essay => ({
                    studentText: essay.text,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname
                })),
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature,
                provider: provider
            };

            // Show the progress UI only after validation passes
            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.displayBatchProgress(batchData);
            }

            // Use streaming batch endpoint for better UX (essays return progressively)
            console.log('🎯 CALLING STREAMING BATCH GRADING WITH:', batchData);

            // Store original batch data globally for retry functionality
            window.originalBatchDataForRetry = batchData;

            try {
                await streamBatchGradingSimple(batchData);
            } catch (streamError) {
                console.error('Streaming failed, using fallback:', streamError);
                await fallbackToBatchProcessing(batchData);
            }
        }

    } catch (error) {
        console.error('Grading error:', error);
        showError('Error during grading: ' + error.message, 'Grading Error');
    } finally {
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;

        // Re-enable all tabs after grading completes
        if (window.TabManagementModule) {
            window.TabManagementModule.enableAllTabs();
        }
    }
}

/**
 * Setup main grading form functionality
 */
function setupMainGrading() {
    console.log('Setting up main grading functionality');

    // Set up form submission
    const gradingForm = document.getElementById('gradingForm');
    if (gradingForm) {
        gradingForm.addEventListener('submit', handleGradingFormSubmission);
        console.log('Main grading form listener added');
    } else {
        console.warn('Main grading form not found');
    }
}

/**
 * Setup Claude grading functionality
 */
function setupClaudeGrading() {
    console.log('Setting up Claude grading functionality');

    // Set up form submission (using the same handler as GPT, it detects which form)
    const claudeGradingForm = document.getElementById('claudeGradingForm');
    if (claudeGradingForm) {
        claudeGradingForm.addEventListener('submit', handleGradingFormSubmission);
        console.log('Claude grading form listener added');
    } else {
        console.warn('Claude grading form not found');
    }
}

/**
 * Setup manual grading functionality
 */
function setupManualGrading() {
    console.log('Setting up manual grading functionality');

    // Set up form submission
    const manualForm = document.getElementById('manualGradingForm');
    if (manualForm) {
        manualForm.addEventListener('submit', handleManualGradingSubmission);
        console.log('Manual grading form listener added');
    } else {
        console.warn('Manual grading form not found');
    }
}


/**
 * Clear manual grading form
 */
function clearManualForm() {
    const form = document.getElementById('manualGradingForm');
    if (form) {
        form.reset();
    }

    // Clear results display
    const resultsContainer = document.getElementById('manualResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
}

/**
 * Validate form input
 * @param {HTMLFormElement} form - Form to validate
 * @returns {boolean} True if valid
 */
function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('error');
            isValid = false;
        } else {
            field.classList.remove('error');
        }
    });

    return isValid;
}

/**
 * Update manual score (placeholder for future functionality)
 * @param {string} category - Score category
 * @param {number} score - New score value
 */
function updateManualScore(category, score) {
    console.log(`Updating manual score for ${category}: ${score}`);
    // Implementation for manual score updates would go here
}

/**
 * Stream batch grading using Server-Sent Events
 * CHUNKING: Splits large batches into chunks to avoid SSE connection timeouts
 * Vercel appears to have ~5 minute SSE connection limit, so we chunk to stay under
 * @param {Object} batchData - The batch data to process
 */
async function streamBatchGradingSimple(batchData) {
    const CHUNK_SIZE = 2; // 2 essays = 1 batch of 2, matches backend BATCH_SIZE
    const totalEssays = batchData.essays.length;

    // If batch is small enough, process in single request
    if (totalEssays <= CHUNK_SIZE) {
        return processEssayChunk(batchData, 0);
    }

    // Large batch - split into chunks and process sequentially
    let allResults = [];
    let processedCount = 0;

    while (processedCount < totalEssays) {
        const chunkStart = processedCount;
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalEssays);
        const chunkEssays = batchData.essays.slice(chunkStart, chunkEnd);

        const chunkData = {
            ...batchData,
            essays: chunkEssays
        };

        try {
            const chunkResult = await processEssayChunk(chunkData, chunkStart);

            // Merge results
            if (chunkResult.results) {
                allResults = allResults.concat(chunkResult.results);
            }

            processedCount = chunkEnd;

        } catch (error) {
            console.error(`❌ Chunk failed: Essays ${chunkStart + 1}-${chunkEnd}:`, error.message);

            // Mark failed essays in UI
            for (let i = chunkStart; i < chunkEnd; i++) {
                if (window.BatchProcessingModule) {
                    window.BatchProcessingModule.updateEssayStatus(i, false, `Chunk failed: ${error.message}`);
                }
            }

            // Continue with next chunk instead of failing entire batch
            processedCount = chunkEnd;
        }
    }

    return {
        success: true,
        results: allResults,
        totalEssays: totalEssays
    };
}

/**
 * Process a chunk of essays via Server-Sent Events
 * @param {Object} chunkData - The chunk data to process
 * @param {number} globalOffset - Starting index in the global essay list
 */
async function processEssayChunk(chunkData, globalOffset) {
    return new Promise((resolve, reject) => {
        let processedResults = [];
        let timeoutId;
        const TIMEOUT_MS = 1200000; // 20 minutes - allow server to complete large batches
        // Note: Server-Sent Events (SSE) bypass Vercel's normal 10s timeout for serverless functions

        // Set up timeout detection - mainly for detecting stalled connections
        timeoutId = setTimeout(() => {
            console.error('⏱️ SSE TIMEOUT: Request exceeded 20 minutes', {
                chunkSize: chunkData.essays.length,
                globalOffset,
                processedSoFar: processedResults.length,
                missingCount: chunkData.essays.length - processedResults.length,
                timestamp: new Date().toISOString()
            });
            reject(new Error(`SSE timeout after 20 minutes. Processed ${processedResults.length}/${chunkData.essays.length} essays.`));
        }, TIMEOUT_MS);

        // Use direct fetch with streaming instead of EventSource
        fetch('/api/grade-batch?stream=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chunkData)
        }).then(response => {
            if (!response.ok) {
                clearTimeout(timeoutId);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function readStream() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        clearTimeout(timeoutId);
                        resolve({
                            success: true,
                            results: processedResults,
                            totalEssays: chunkData.essays.length
                        });
                        return;
                    }

                    // Process the streamed data
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer

                    lines.forEach(line => {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                handleStreamingMessage(data);
                            } catch (e) {
                                console.error('Error parsing streaming data:', e);
                            }
                        }
                    });

                    return readStream();
                });
            }

            return readStream();
        }).catch(error => {
            clearTimeout(timeoutId);
            console.error('❌ SSE fetch error:', error.message);
            reject(error);
        });

        function handleStreamingMessage(data) {
            switch (data.type) {
                case 'start':
                    break;

                case 'processing':
                    break;

                case 'result':
                        const globalResultIndex = data.index + globalOffset;

                        // Adjust data index to global position
                        const adjustedData = {
                            ...data,
                            index: globalResultIndex
                        };

                        // Store the result (use local index for chunk array)
                        processedResults[data.index] = adjustedData;

                        // Store essay data for expansion (use GLOBAL index)
                        if (data.success && chunkData.essays[data.index]) {
                            window[`essayData_${globalResultIndex}`] = {
                                essay: {
                                    success: true,
                                    result: data.result,
                                    studentName: data.studentName || chunkData.essays[data.index].studentName
                                },
                                originalData: {
                                    ...chunkData.essays[data.index],
                                    index: globalResultIndex
                                }
                            };
                        }

                        // Queue this result for staggered display
                        if (!window.batchResultQueue) {
                            window.batchResultQueue = [];
                            window.batchQueueProcessor = null;
                        }

                        window.batchResultQueue.push(adjustedData);

                        // Start processing queue if not already running
                        if (!window.batchQueueProcessor) {
                            processBatchResultQueue();
                        }
                        break;

                    case 'complete':
                        clearTimeout(timeoutId);

                        // Create result object
                        const chunkResult = {
                            success: true,
                            totalEssays: chunkData.essays.length,
                            results: processedResults.filter(r => r !== undefined).map(r => ({
                                success: r.success,
                                error: r.error,
                                result: r.result,
                                studentName: r.studentName,
                                index: r.index
                            }))
                        };

                        resolve(chunkResult);
                        break;

                    case 'error':
                        const globalErrorIndex = data.index !== undefined ? data.index + globalOffset : undefined;
                        console.error('❌ Backend streaming error:', {
                            error: data.error,
                            localIndex: data.index,
                            globalIndex: globalErrorIndex,
                            chunkSize: chunkData.essays.length,
                            globalOffset
                        });
                        if (window.BatchProcessingModule && globalErrorIndex !== undefined) {
                            window.BatchProcessingModule.updateEssayStatus(globalErrorIndex, false, data.error);
                        }
                        break;

                    default:
                        console.warn('Unknown message type:', data.type);
            }
        }

        // Streaming will complete when fetch response ends
    });
}

/**
 * Stream batch grading using Server-Sent Events for real-time results (DEPRECATED - complex version)
 * @param {Object} batchData - The batch data to process
 */
async function streamBatchGrading(batchData) {
    console.log('🎯 STARTING STREAMING BATCH GRADING');

    return new Promise(async (resolve, reject) => {
        let processedResults = [];
        let hasStarted = false;

        try {
            // First, initiate the batch grading via POST to get a session ID
            console.log('📋 Initializing streaming session with data:', batchData);
            const initResponse = await fetch('/api/grade-batch-stream/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(batchData)
            });

            if (!initResponse.ok) {
                throw new Error(`Failed to initialize streaming: ${initResponse.status}`);
            }

            const { sessionId } = await initResponse.json();
            console.log('📋 Got session ID:', sessionId);

            // Now connect to the streaming endpoint with the session ID
            const eventSource = new EventSource(`/api/grade-batch-stream/${sessionId}`);

            // Add timeout detection - if we don't receive ANY message for 90 seconds, assume timeout
            let lastMessageTime = Date.now();
            const TIMEOUT_MS = 90000; // 90 seconds

            const timeoutChecker = setInterval(() => {
                const timeSinceLastMessage = Date.now() - lastMessageTime;
                if (timeSinceLastMessage > TIMEOUT_MS) {
                    console.error(`⏱️ TIMEOUT DETECTED: No message received for ${(timeSinceLastMessage / 1000).toFixed(1)}s`);
                    console.error('🔴 This indicates the Vercel serverless function likely timed out');
                    clearInterval(timeoutChecker);
                    eventSource.close();
                    reject(new Error(`Server timeout - no response for ${(timeSinceLastMessage / 1000).toFixed(1)} seconds. This usually indicates the Vercel function execution limit was reached.`));
                }
            }, 10000); // Check every 10 seconds

        eventSource.onmessage = function(event) {
            lastMessageTime = Date.now(); // Reset timeout timer
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received streaming message:', data);

                switch (data.type) {
                    case 'start':
                        hasStarted = true;
                        console.log('✅ Streaming started');
                        break;

                    case 'processing':
                        console.log(`🔄 Processing essay ${data.index + 1}/${data.total}`);
                        break;

                    case 'result':
                        console.log(`✅ Received result for essay ${data.index}`);

                        // Update the UI immediately for this essay
                        if (window.BatchProcessingModule) {
                            window.BatchProcessingModule.updateEssayStatus(data.index, data.success, data.error);
                        }

                        // Store the result
                        processedResults[data.index] = data;

                        // Store essay data for expansion
                        if (data.success && batchData.essays[data.index]) {
                            window[`essayData_${data.index}`] = {
                                essay: {
                                    success: true,
                                    result: data.result,
                                    studentName: data.studentName || batchData.essays[data.index].studentName
                                },
                                originalData: {
                                    ...batchData.essays[data.index],
                                    index: data.index
                                }
                            };

                            // Pre-load the essay content immediately so users can click and view it right away
                            console.log(`🔄 Pre-loading essay content for immediate access: ${data.index}`);
                            if (window.BatchProcessingModule && window.BatchProcessingModule.loadEssayDetails) {
                                window.BatchProcessingModule.loadEssayDetails(data.index);
                            }
                        }
                        break;

                    case 'complete':
                        console.log('🎉 Streaming complete');
                        if (data.totalTimeSeconds) {
                            console.log(`⏱️ Server reported total time: ${data.totalTimeSeconds}s`);
                        }
                        clearInterval(timeoutChecker); // Clear timeout checker on successful completion

                        // Create final batch result object
                        const finalBatchResult = {
                            success: true,
                            totalEssays: batchData.essays.length,
                            results: processedResults.filter(r => r !== undefined).map(r => ({
                                success: r.success,
                                error: r.error,
                                result: r.result,
                                studentName: r.studentName
                            }))
                        };

                        // Only rebuild UI if essays weren't already pre-loaded
                        const alreadyLoaded = document.querySelector('.formatted-essay-content[data-essay-index="0"]');
                        if (!alreadyLoaded && window.BatchProcessingModule) {
                            console.log('🔄 UI not pre-loaded, rebuilding with batch results...');
                            window.BatchProcessingModule.displayBatchResults(finalBatchResult, batchData);
                        } else {
                            console.log('✅ Essays already pre-loaded and interactive, skipping UI rebuild');
                        }

                        resolve(finalBatchResult);
                        break;

                    case 'error':
                        console.error('❌ Streaming error:', data.error);
                        if (window.BatchProcessingModule && data.index !== undefined) {
                            window.BatchProcessingModule.updateEssayStatus(data.index, false, data.error);
                        }
                        break;

                    default:
                        console.warn('Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('Error parsing streaming message:', error);
            }
        };

            eventSource.onerror = function(error) {
                console.error('EventSource error:', error);
                eventSource.close();

                if (!hasStarted) {
                    // If streaming never started, fall back to regular batch processing
                    console.log('🔄 Falling back to regular batch processing');
                    fallbackToBatchProcessing(batchData).then(resolve).catch(reject);
                } else {
                    reject(error);
                }
            };

            // Set a timeout to prevent hanging
            setTimeout(() => {
                if (eventSource.readyState !== EventSource.CLOSED) {
                    console.warn('⏰ Streaming timeout, closing connection');
                    eventSource.close();
                    if (!hasStarted) {
                        fallbackToBatchProcessing(batchData).then(resolve).catch(reject);
                    }
                }
            }, 300000); // 5 minute timeout

        } catch (error) {
            console.error('Error setting up streaming:', error);
            // Fallback to regular batch processing
            fallbackToBatchProcessing(batchData).then(resolve).catch(reject);
        }
    });
}

/**
 * Fallback to regular batch processing if streaming fails
 * @param {Object} batchData - The batch data to process
 */
async function fallbackToBatchProcessing(batchData) {
    console.log('🔄 Using fallback batch processing');

    const response = await fetch('/api/grade-batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && window.BatchProcessingModule) {
        window.BatchProcessingModule.displayBatchResults(result, batchData);
    }

    return result;
}

/**
 * Setup form validation for all forms
 */
function setupFormValidation() {
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                console.warn('Form validation failed');
            }
        });
    });
}

/**
 * Process batch results with 1-second delay between each
 */
function processBatchResultQueue() {
    if (!window.batchResultQueue || window.batchResultQueue.length === 0) {
        window.batchQueueProcessor = null;
        return;
    }

    window.batchQueueProcessor = setTimeout(() => {
        const data = window.batchResultQueue.shift();

        // Update the UI for this essay
        if (window.BatchProcessingModule) {
            window.BatchProcessingModule.updateEssayStatus(data.index, data.success, data.error);
        }

        // Pre-load the essay content so users can click and view it right away
        if (data.success) {
            if (window.BatchProcessingModule && window.BatchProcessingModule.loadEssayDetails) {
                window.BatchProcessingModule.loadEssayDetails(data.index);
            }
        }

        // Continue processing queue
        processBatchResultQueue();
    }, 3000); // 3-second delay
}

// Export functions for module usage
window.FormHandlingModule = {
    handleGradingFormSubmission,
    handleManualGradingSubmission,
    setupMainGrading,
    setupClaudeGrading,
    setupManualGrading,
    updateManualScore,
    clearManualForm,
    validateForm,
    setupFormValidation,
    streamBatchGrading,
    streamBatchGradingSimple,
    processEssayChunk,
    fallbackToBatchProcessing,
    processBatchResultQueue
};