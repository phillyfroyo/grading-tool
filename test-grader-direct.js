// Direct test of the grader function
import { gradeEssay } from './grader/grader-two-step.js';

const testGrader = async () => {
  const studentText = "I dont do homework on wekend. I want to can play with friends.";
  const classProfileId = "business_b2_fall2024";

  try {
    console.log('Testing grading function directly...');
    console.log('Student text:', studentText);
    console.log('Class profile:', classProfileId);
    console.log('---');

    const result = await gradeEssay(studentText, null, classProfileId);

    console.log('✅ Grading completed successfully!');
    console.log('Total score:', result.total);
    console.log('Number of errors detected:', result.inline_issues?.length || 0);
    console.log('First 3 errors:');
    result.inline_issues?.slice(0, 3).forEach(issue => {
      console.log(`  - "${issue.text}" → "${issue.correction}" (${issue.category})`);
    });

    return result;
  } catch (error) {
    console.error('❌ Grading failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

testGrader().then(() => {
  console.log('\n✅ Test passed! The attemptSmartSplitting error has been fixed.');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});