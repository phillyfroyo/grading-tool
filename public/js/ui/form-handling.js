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
    console.log('🎯 MAIN GRADING FORM SUBMITTED!');

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
            console.log('📡 Using profile temperature:', temperature, 'from profile:', classProfile);
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
    const button = e.target.querySelector('#gradeButton');
    const originalText = button.textContent;
    button.textContent = 'Grading essays...';
    button.disabled = true;

    try {
        if (studentTexts.length === 1) {
            // Single essay grading - validate requirements first
            const prompt = document.querySelector('#prompt')?.value?.trim() || '';

            // Validation: Must have either a class profile OR a custom prompt
            if (!classProfile && !prompt) {
                showInlineError('classProfileError', 'Please select a class profile');
                // Reset button state
                button.textContent = originalText;
                button.disabled = false;
                return;
            }

            // Clear any previous error
            hideInlineError('classProfileError');

            const gradingData = {
                studentText: studentTexts[0].text,
                studentName: studentTexts[0].studentName,
                studentNickname: studentTexts[0].studentNickname,
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature,
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
            console.log('📋 Grading API response:', result);
            console.log('📋 Response keys:', Object.keys(result));
            console.log('📋 Success field:', result.success);
            console.log('📋 Full response object:', JSON.stringify(result, null, 2));

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
                showInlineError('classProfileError', 'Please select a class profile');
                // Reset button state
                button.textContent = originalText;
                button.disabled = false;
                return;
            }

            // Clear any previous error
            hideInlineError('classProfileError');

            // Note: classProfile is optional if custom prompt is provided

            const batchData = {
                essays: studentTexts.map(essay => ({
                    studentText: essay.text,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname
                })),
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature
            };

            // Show the progress UI only after validation passes
            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.displayBatchProgress(batchData);
            }

            // Use streaming batch endpoint for better UX (essays return progressively)
            console.log('🎯 CALLING STREAMING BATCH GRADING WITH:', batchData);
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
 * Stream batch grading using Server-Sent Events via query parameter
 * SUPPORTS CHUNKING: Automatically processes large batches in chunks of 6 essays to stay under Vercel timeout
 * @param {Object} batchData - The batch data to process
 */
async function streamBatchGradingSimple(batchData) {
    console.log('🎯 STARTING SIMPLE STREAMING BATCH GRADING');

    const CHUNK_SIZE = 6; // Process 6 essays per chunk to stay under ~4min Vercel timeout
    const totalEssays = batchData.essays.length;

    // If batch is small enough, process normally
    if (totalEssays <= CHUNK_SIZE) {
        console.log(`📊 Processing ${totalEssays} essays in single chunk`);
        return processSingleChunk(batchData, 0);
    }

    // Large batch - split into chunks and process sequentially
    console.log(`📊 Large batch detected: ${totalEssays} essays`);
    console.log(`📦 Will process in ${Math.ceil(totalEssays / CHUNK_SIZE)} chunks of ${CHUNK_SIZE} essays`);

    let allResults = [];
    let processedCount = 0;

    while (processedCount < totalEssays) {
        const chunkStart = processedCount;
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalEssays);
        const chunkEssays = batchData.essays.slice(chunkStart, chunkEnd);

        console.log(`\n🔄 Processing chunk: essays ${chunkStart + 1}-${chunkEnd} of ${totalEssays}`);

        const chunkData = {
            ...batchData,
            essays: chunkEssays
        };

        try {
            const chunkResult = await processSingleChunk(chunkData, chunkStart);

            // Merge results, adjusting indices to match global position
            if (chunkResult.results) {
                allResults = allResults.concat(chunkResult.results);
            }

            processedCount = chunkEnd;
            console.log(`✅ Chunk complete. Total progress: ${processedCount}/${totalEssays} essays`);

        } catch (error) {
            console.error(`❌ Chunk ${chunkStart + 1}-${chunkEnd} failed:`, error);
            throw new Error(`Failed to process essays ${chunkStart + 1}-${chunkEnd}: ${error.message}`);
        }
    }

    console.log(`\n🎉 ALL CHUNKS COMPLETE: ${totalEssays} essays processed successfully`);

    return {
        success: true,
        results: allResults,
        totalEssays: totalEssays
    };
}

/**
 * Process a single chunk of essays (internal helper)
 * @param {Object} chunkData - Data for this chunk
 * @param {number} globalOffset - Starting index in the global essay list
 */
async function processSingleChunk(chunkData, globalOffset) {
    return new Promise((resolve, reject) => {
        let processedResults = [];

        // Use direct fetch with streaming instead of EventSource
        fetch('/api/grade-batch?stream=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chunkData)
        }).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function readStream() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        console.log('✅ Streaming completed');
                        resolve({
                            success: true,
                            results: processedResults,
                            totalEssays: batchData.essays.length
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
                                console.error('Error parsing streaming data:', e, line);
                            }
                        }
                    });

                    return readStream();
                });
            }

            return readStream();
        }).catch(error => {
            console.error('Streaming error:', error);
            reject(error);
        });

        function handleStreamingMessage(data) {
            console.log('📨 Received streaming message:', data);

            switch (data.type) {
                case 'start':
                    console.log('✅ Streaming started');
                    break;

                case 'processing':
                    const globalIndex = data.index + globalOffset;
                    const progressMsg = data.batch
                        ? `🔄 Processing essay ${globalIndex + 1} (Batch ${data.batch}/${data.totalBatches})`
                        : `🔄 Processing essay ${globalIndex + 1}`;
                    console.log(progressMsg);
                    break;

                case 'result':
                        const globalResultIndex = data.index + globalOffset;
                        console.log(`✅ Received result for essay ${globalResultIndex + 1}`);

                        // Adjust data index to global position
                        const adjustedData = {
                            ...data,
                            index: globalResultIndex
                        };

                        // Store the result first (use local index for chunk array)
                        processedResults[data.index] = adjustedData;

                        // Store essay data for expansion (use GLOBAL index for window storage)
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

                        // Queue this result for staggered display (3-second delay between each)
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
                        console.log('🎉 Chunk streaming complete');
                        if (data.totalTimeSeconds) {
                            console.log(`⏱️ Chunk processing time: ${data.totalTimeSeconds}s`);
                        }

                        // Create chunk result object
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

                        // For chunks, we DON'T rebuild UI - that's handled by the parent function
                        // Just resolve with the chunk results
                        resolve(chunkResult);
                        break;

                    case 'error':
                        console.error('❌ Streaming error:', data.error);
                        const globalErrorIndex = data.index !== undefined ? data.index + globalOffset : undefined;
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

        console.log(`🎯 Processing queued result for essay ${data.index} with 3s delay`);

        // Update the UI for this essay
        if (window.BatchProcessingModule) {
            window.BatchProcessingModule.updateEssayStatus(data.index, data.success, data.error);
        }

        // Pre-load the essay content so users can click and view it right away
        if (data.success) {
            console.log(`🔄 Pre-loading essay content for immediate access: ${data.index}`);
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
    setupManualGrading,
    updateManualScore,
    clearManualForm,
    validateForm,
    setupFormValidation,
    streamBatchGrading,
    streamBatchGradingSimple,
    processSingleChunk,
    fallbackToBatchProcessing,
    processBatchResultQueue
};