// Temperature adjustment service
// Applies grade temperature adjustments to grading results

/**
 * Apply temperature adjustment to grading results
 * @param {Object} gradingResult - The original grading result
 * @param {number} temperature - Temperature adjustment (-5 to +5)
 * @returns {Object} Adjusted grading result
 */
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

export {
  applyTemperatureAdjustment
};