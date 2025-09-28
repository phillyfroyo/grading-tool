// Debug script for testing score updates
// Run this in the browser console after grading essays

console.log('=== GRADING DEBUG INFO ===');

// Check modules
console.log('Modules loaded:');
console.log('  SingleResultModule:', !!window.SingleResultModule);
console.log('  ManualGradingModule:', !!window.ManualGradingModule);
console.log('  EditingFunctionsModule:', !!window.EditingFunctionsModule);

// Check current grading data
if (window.SingleResultModule) {
    console.log('\nCurrent single grading data:');
    const singleData = window.SingleResultModule.getCurrentGradingData();
    console.log('  Data exists:', !!singleData);
    if (singleData) {
        console.log('  Scores:', singleData.scores);
        console.log('  Total:', singleData.total);
    }

    console.log('\nBatch grading data:');
    const batchData = window.SingleResultModule.getBatchGradingData();
    console.log('  Batch data:', batchData);
    if (batchData && Object.keys(batchData).length > 0) {
        Object.keys(batchData).forEach(index => {
            console.log(`  Essay ${index}:`, {
                scores: batchData[index]?.gradingData?.scores,
                total: batchData[index]?.gradingData?.total
            });
        });
    }
}

// Check editable score inputs
console.log('\nEditable score inputs:');
const inputs = document.querySelectorAll('.editable-score');
console.log('  Found:', inputs.length, 'inputs');
inputs.forEach((input, i) => {
    console.log(`  Input ${i}:`, {
        category: input.dataset.category,
        value: input.value,
        essayIndex: input.dataset.essayIndex,
        hasListener: input._listeners?.input ? 'YES' : 'NO'
    });
});

// Check arrow areas
console.log('\nArrow click areas:');
const arrows = document.querySelectorAll('.arrow-up-area, .arrow-down-area');
console.log('  Found:', arrows.length, 'arrow areas');

// Test updateTotalScore function
console.log('\nTesting updateTotalScore:');
if (typeof updateTotalScore === 'function') {
    console.log('  Global updateTotalScore exists');

    // Test with no params (single essay)
    console.log('  Calling updateTotalScore() for single essay...');
    updateTotalScore();

    // Test with index 0 (first batch essay)
    if (window.SingleResultModule?.getBatchGradingData && Object.keys(window.SingleResultModule.getBatchGradingData()).length > 0) {
        console.log('  Calling updateTotalScore(0) for batch essay 0...');
        updateTotalScore(0);
    }
}

console.log('\n=== END DEBUG INFO ===');