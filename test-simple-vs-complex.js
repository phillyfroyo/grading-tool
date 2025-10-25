// test-simple-vs-complex.js
// Compare simplified approach vs current complex system

import { gradeEssay as gradeSimple } from './grader/grader-simple.js';
import { gradeEssay as gradeComplex } from './grader/grader-two-step.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runComparison(testEssay, profileId) {
  console.log("=".repeat(80));
  console.log("TESTING: Simplified vs Complex Grading System");
  console.log("=".repeat(80));

  // Load profile
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: {
      vocabulary: true,
      grammar: true
    }
  });

  if (!profile) {
    console.error("❌ Profile not found");
    return;
  }

  const classProfile = {
    vocabulary: profile.vocabulary.map(v => v.word),
    grammar: profile.grammar.map(g => g.structure),
    cefr_level: profile.cefr_level,
    custom_instructions: profile.custom_instructions
  };

  console.log(`\n📝 Test Essay (${testEssay.length} characters):`);
  console.log(testEssay.substring(0, 200) + "...\n");

  // Test Simple Approach
  console.log("\n" + "─".repeat(80));
  console.log("TEST 1: SIMPLIFIED APPROACH (mimics ChatGPT)");
  console.log("─".repeat(80));

  const startSimple = Date.now();
  const simpleResult = await gradeSimple(testEssay, classProfile);
  const timeSimple = Date.now() - startSimple;

  console.log("\n📊 SIMPLE RESULTS:");
  console.log(`   Errors found: ${simpleResult.inline_issues.length}`);
  console.log(`   Score: ${simpleResult.score}/100`);
  console.log(`   Word count: ${simpleResult.word_count}`);
  console.log(`   Transitions: ${simpleResult.transition_words_found?.length || 0}`);
  console.log(`   Time: ${timeSimple}ms`);

  console.log("\n   Error breakdown:");
  const simpleCounts = {};
  simpleResult.inline_issues.forEach(issue => {
    simpleCounts[issue.category] = (simpleCounts[issue.category] || 0) + 1;
  });
  Object.entries(simpleCounts).forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count}`);
  });

  // Test Complex Approach (Main Branch)
  console.log("\n" + "─".repeat(80));
  console.log("TEST 2: COMPLEX APPROACH (current main branch)");
  console.log("─".repeat(80));

  const startComplex = Date.now();
  const complexResult = await gradeComplex(testEssay, classProfile);
  const timeComplex = Date.now() - startComplex;

  console.log("\n📊 COMPLEX RESULTS:");
  console.log(`   Errors found: ${complexResult.inline_issues.length}`);
  console.log(`   Score: ${complexResult.score}/100`);
  console.log(`   Word count: ${complexResult.word_count}`);
  console.log(`   Transitions: ${complexResult.transition_words_found?.length || 0}`);
  console.log(`   Time: ${timeComplex}ms`);

  console.log("\n   Error breakdown:");
  const complexCounts = {};
  complexResult.inline_issues.forEach(issue => {
    complexCounts[issue.category] = (complexCounts[issue.category] || 0) + 1;
  });
  Object.entries(complexCounts).forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count}`);
  });

  // Comparison
  console.log("\n" + "=".repeat(80));
  console.log("COMPARISON");
  console.log("=".repeat(80));

  const errorDiff = simpleResult.inline_issues.length - complexResult.inline_issues.length;
  const scoreDiff = simpleResult.score - complexResult.score;

  console.log(`\n📈 Error Detection:`);
  console.log(`   Simple: ${simpleResult.inline_issues.length} errors`);
  console.log(`   Complex: ${complexResult.inline_issues.length} errors`);
  console.log(`   Difference: ${errorDiff > 0 ? '+' : ''}${errorDiff} (${errorDiff > 0 ? 'more' : 'fewer'} in simple)`);

  console.log(`\n📊 Scoring:`);
  console.log(`   Simple: ${simpleResult.score}/100`);
  console.log(`   Complex: ${complexResult.score}/100`);
  console.log(`   Difference: ${scoreDiff > 0 ? '+' : ''}${scoreDiff} points`);

  console.log(`\n⏱️  Performance:`);
  console.log(`   Simple: ${timeSimple}ms`);
  console.log(`   Complex: ${timeComplex}ms`);
  console.log(`   Difference: ${timeSimple < timeComplex ? 'Simple FASTER' : 'Complex FASTER'} by ${Math.abs(timeSimple - timeComplex)}ms`);

  console.log("\n" + "=".repeat(80));
  console.log("DETAILED ERROR COMPARISON");
  console.log("=".repeat(80));

  // Find unique errors in each system
  const simpleErrors = new Set(simpleResult.inline_issues.map(e => e.text));
  const complexErrors = new Set(complexResult.inline_issues.map(e => e.text));

  const onlyInSimple = [...simpleErrors].filter(e => !complexErrors.has(e));
  const onlyInComplex = [...complexErrors].filter(e => !simpleErrors.has(e));

  if (onlyInSimple.length > 0) {
    console.log(`\n✅ Errors ONLY found by SIMPLE (${onlyInSimple.length}):`);
    onlyInSimple.forEach(err => {
      const issue = simpleResult.inline_issues.find(i => i.text === err);
      console.log(`   - "${err}" → "${issue.correction}" (${issue.category})`);
    });
  }

  if (onlyInComplex.length > 0) {
    console.log(`\n✅ Errors ONLY found by COMPLEX (${onlyInComplex.length}):`);
    onlyInComplex.forEach(err => {
      const issue = complexResult.inline_issues.find(i => i.text === err);
      console.log(`   - "${err}" → "${issue.correction}" (${issue.category})`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("VERDICT");
  console.log("=".repeat(80));

  if (simpleResult.inline_issues.length > complexResult.inline_issues.length) {
    console.log("🏆 SIMPLE approach found MORE errors");
  } else if (simpleResult.inline_issues.length < complexResult.inline_issues.length) {
    console.log("🏆 COMPLEX approach found MORE errors");
  } else {
    console.log("🤝 EQUAL number of errors found");
  }

  console.log("\n💡 Next step: Manually review the errors to check for false positives/negatives");
  console.log("=".repeat(80) + "\n");

  await prisma.$disconnect();
}

// Get test essay from command line or use default
const testEssay = process.argv[2] || `I am very exciting to start my own bussiness. I heard for one friend that we have in commond tall me that you want to start your own business too, that's right ? I think its a great idea because is a good way to make money and be independent. However there is some problems that you should know about it. First you need to have enough money to can start the bussiness. Second you must to work very hard and dont give up. I think if you work hard you will be successful.`;

const profileId = parseInt(process.argv[3]) || 1; // Default to profile ID 1

runComparison(testEssay, profileId);
