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
        temperature = parseInt(formData.get('temperature')) || 0;
    }

    // Get all student texts from the form
    const studentTexts = [];
    const textareas = e.target.querySelectorAll('.student-text');
    textareas.forEach((textarea, index) => {
        if (textarea.value.trim()) {
            const studentNameField = textarea.closest('.essay-entry').querySelector('.student-name');
            const individualName = studentNameField ? studentNameField.value.trim() : '';
            studentTexts.push({
                text: textarea.value.trim(),
                studentName: individualName || `${studentName} ${index + 1}`.trim()
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
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature,
                isManualMode: false
            };

            // Show progress UI for single essay (same as batch)
            const singleEssayBatchData = {
                essays: [{
                    studentName: studentTexts[0].studentName,
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
                    studentName: essay.studentName
                })),
                prompt: prompt,
                classProfile: classProfile,
                temperature: temperature
            };

            // Show the progress UI only after validation passes
            if (window.BatchProcessingModule) {
                window.BatchProcessingModule.displayBatchProgress(batchData);
            }

            // Use regular batch endpoint (streaming has issues - TODO: fix later)
            console.log('🎯 CALLING FALLBACK BATCH GRADING WITH:', batchData);
            await fallbackToBatchProcessing(batchData);
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
 * @param {Object} batchData - The batch data to process
 */
async function streamBatchGradingSimple(batchData) {
    console.log('🎯 STARTING SIMPLE STREAMING BATCH GRADING');

    return new Promise((resolve, reject) => {
        let processedResults = [];

        // Use direct fetch with streaming instead of EventSource
        fetch('/api/grade-batch?stream=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(batchData)
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
                    const progressMsg = data.batch
                        ? `🔄 Processing essay ${data.index + 1} (Batch ${data.batch}/${data.totalBatches})`
                        : `🔄 Processing essay ${data.index + 1}`;
                    console.log(progressMsg);
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
                        }
                        break;

                    case 'complete':
                        console.log('🎉 Streaming complete');
                        // Stream ends naturally

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

        eventSource.onmessage = function(event) {
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
                        }
                        break;

                    case 'complete':
                        console.log('🎉 Streaming complete');
                        // Stream ends naturally

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
    fallbackToBatchProcessing
};