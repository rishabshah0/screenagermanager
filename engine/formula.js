
export const DIFFICULTY = {
  STANDARD: 12.5,
  HARD: 10,
};

export const MISSING_PENALTY_MINUTES = 15;

function assignmentTerm(g, p, b) {
  if (g <= 0) return 0;
  if (p <= 0 || b <= 0) return 1;
  return Math.pow(g, p / b);
}

export function calculateEarnedMinutes({
  assignments = [],
  missingCount = 0,
  difficulty = 'STANDARD',
  baseMinutes = 120,
}) {

  const b = DIFFICULTY[difficulty] ?? DIFFICULTY.STANDARD;

  if (!assignments || assignments.length === 0) {
    const penalty = missingCount * MISSING_PENALTY_MINUTES;
    return Math.max(0, -penalty);
  }

  let product = 1;
  for (const assignment of assignments) {
    const g = clampGrade(assignment.g);
    const p = assignment.p ?? 0;
    const term = assignmentTerm(g, p, b);

    product *= term;

    if (product === 0) {
      product = 0;
      break;
    }
  }

  let earnedMinutes = product * baseMinutes;

  const penalty = missingCount * MISSING_PENALTY_MINUTES;
  earnedMinutes -= penalty;

  return Math.max(0, Math.min(baseMinutes, earnedMinutes));
}

export function clampGrade(rawGrade) {
  if (typeof rawGrade !== 'number' || isNaN(rawGrade)) return 0;

  const normalized = rawGrade > 1 ? rawGrade / 100 : rawGrade;
  return Math.max(0, Math.min(1, normalized));
}

export function normalizeAssignment(raw) {
  const isMissing = raw.status === 'missing' || raw.status === 'late-missing';
  const earnedPoints = parseFloat(raw.earnedPoints) || 0;
  const totalPoints = parseFloat(raw.totalPoints) || 0;
  const g = totalPoints > 0 ? clampGrade(earnedPoints / totalPoints) : 0;
  return { g, p: earnedPoints, isMissing };
}

export function computeFromRaw(rawAssignments, difficulty = 'STANDARD', baseMinutes = 120) {
  const normalized = rawAssignments.map(normalizeAssignment);
  const graded = normalized.filter((a) => !a.isMissing);
  const missingCount = normalized.filter((a) => a.isMissing).length;

  return calculateEarnedMinutes({
    assignments: graded,
    missingCount,
    difficulty,
    baseMinutes,
  });
}
