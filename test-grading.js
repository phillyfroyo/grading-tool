// Test script to verify grading functionality
import fetch from 'node-fetch';

const testGrading = async () => {
  const testData = {
    studentText: "I dont do homework on wekend. I want to can play with friends.",
    classProfile: "business_b2_fall2024"
  };

  try {
    console.log('Testing grading API...');
    const response = await fetch('http://localhost:3001/api/grade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Grading succeeded!');
      console.log('Total score:', result.total);
      console.log('Number of errors detected:', result.inline_issues?.length || 0);
    } else {
      console.log('❌ Grading failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Error calling grading API:', error);
    throw error;
  }
};

testGrading().then(result => {
  console.log('\nFull result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});