/**
 * FocusLock Formula Engine
 *
 * Implements the screen time formula:
 *   M = ∏(i=1 to n) g_i ^ (p_i / b)
 *
 * Where:
 *   g  = grade as a decimal [0, 1]  (e.g. 85% → 0.85)
 *   p  = points earned on the assignment
 *   b  = difficulty constant (12.5 = standard, 10 = hard)
 *   n  = total number of graded assignments (last 7 days)
 *   M  = earned screen time in MINUTES
 *
 * Missing assignment penalty: -15 minutes each
 * Minimum result: 0 minutes (never goes negative)
 *
 * @module engine/formula
 */

/** Difficulty constants */
export const DIFFICULTY = {
  STANDARD: 12.5,
  HARD: 10,
};

/** Minutes deducted per missing assignment */
export const MISSING_PENALTY_MINUTES = 15;

/**
 * Calculate the product term for a single assignment.
 *
 * @param {number} g - Grade as a decimal (0–1 inclusive)
 * @param {number} p - Points earned (> 0)
 * @param {number} b - Difficulty constant
 * @returns {number} g^(p/b) — the multiplicative contribution of this assignment
 */
function assignmentTerm(g, p, b) {
  if (g <= 0) return 0; // An assignment with 0% instantly zeroes the product
  if (p <= 0 || b <= 0) return 1; // No contribution if points or difficulty is invalid
  return Math.pow(g, p / b);
}

/**
 * Calculate total earned screen time in minutes.
 *
 * The product formula M = ∏ g^(p/b) naturally returns a value between 0 and 1
 * when all grades are ≤ 100%. To translate this into a meaningful number of
 * minutes, we scale by a BASE_MINUTES cap (default 120 min = 2 hours maximum
 * "perfect" day). You can adjust BASE_MINUTES in settings.
 *
 * Missing assignments are applied as flat penalties AFTER scaling.
 *
 * @param {Object} options
 * @param {Array<{g: number, p: number}>} options.assignments
 *   Array of graded assignment objects. Each must have:
 *     - g: grade as decimal [0, 1]
 *     - p: point value of the assignment (positive number)
 * @param {number} [options.missingCount=0]
 *   Number of missing/unsubmitted assignments in the last 7 days.
 * @param {string} [options.difficulty='STANDARD']
 *   Difficulty mode: 'STANDARD' (b=12.5) or 'HARD' (b=10).
 * @param {number} [options.baseMinutes=120]
 *   The maximum possible earned minutes (achieved with 100% on all assignments).
 * @returns {number} Earned screen time in minutes, clamped to [0, baseMinutes].
 */
export function calculateEarnedMinutes({
  assignments = [],
  missingCount = 0,
  difficulty = 'STANDARD',
  baseMinutes = 120,
}) {
  // Resolve difficulty constant b
  const b = DIFFICULTY[difficulty] ?? DIFFICULTY.STANDARD;

  // Edge case: no graded assignments
  if (!assignments || assignments.length === 0) {
    const penalty = missingCount * MISSING_PENALTY_MINUTES;
    return Math.max(0, -penalty); // Can only be 0 if there's nothing graded
  }

  // Compute the product ∏ g^(p/b) across all graded assignments
  let product = 1;
  for (const assignment of assignments) {
    const g = clampGrade(assignment.g);
    const p = assignment.p ?? 0;
    const term = assignmentTerm(g, p, b);

    product *= term;

    // Short-circuit: once the product hits 0 it will stay 0
    if (product === 0) {
      product = 0;
      break;
    }
  }

  // Scale to minutes. The raw product is in [0, 1], so we multiply by the cap.
  let earnedMinutes = product * baseMinutes;

  // Apply missing assignment penalties
  const penalty = missingCount * MISSING_PENALTY_MINUTES;
  earnedMinutes -= penalty;

  // Clamp to [0, baseMinutes]
  return Math.max(0, Math.min(baseMinutes, earnedMinutes));
}

/**
 * Clamp a raw grade value into the valid range [0, 1].
 * Accepts values already in decimal form (0.85) or percentage form (85).
 *
 * @param {number} rawGrade
 * @returns {number} Grade clamped to [0, 1]
 */
export function clampGrade(rawGrade) {
  if (typeof rawGrade !== 'number' || isNaN(rawGrade)) return 0;
  // Auto-detect percentage format: if value > 1, treat as 0–100 scale
  const normalized = rawGrade > 1 ? rawGrade / 100 : rawGrade;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Convert a raw scraper assignment object into the shape needed by the formula.
 *
 * @param {Object} raw - Raw assignment from the Classroom scraper
 * @param {string} raw.earnedPoints - e.g. "42"
 * @param {string} raw.totalPoints  - e.g. "50"
 * @param {string} raw.status       - "turned-in", "graded", "missing", etc.
 * @returns {{ g: number, p: number, isMissing: boolean }}
 */
export function normalizeAssignment(raw) {
  const isMissing = raw.status === 'missing' || raw.status === 'late-missing';
  const earnedPoints = parseFloat(raw.earnedPoints) || 0;
  const totalPoints = parseFloat(raw.totalPoints) || 0;
  const g = totalPoints > 0 ? clampGrade(earnedPoints / totalPoints) : 0;
  return { g, p: earnedPoints, isMissing };
}

/**
 * High-level helper used by the service worker.
 * Takes raw scraper output and returns the final earned minutes for today.
 *
 * @param {Array<Object>} rawAssignments - Output from classroom-scraper.js
 * @param {string} difficulty - 'STANDARD' or 'HARD'
 * @param {number} [baseMinutes=120]
 * @returns {number} Earned minutes
 */
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
