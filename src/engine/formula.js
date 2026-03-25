import { clamp, isFinite, partition, reduce, isEmpty } from 'lodash-es';

export const DIFFICULTY = { STANDARD: 12.5, HARD: 10 };
export const MISSING_PENALTY_MINUTES = 15;

const assignmentTerm = (g, p, b) => (g <= 0 ? 0 : (p <= 0 || b <= 0 ? 1 : Math.pow(g, p / b)));
export const clampGrade = (raw) => clamp(isFinite(raw) ? (raw > 1 ? raw / 100 : raw) : 0, 0, 1);

export function computeFromRaw(rawAssignments, difficulty = 'STANDARD', baseMinutes = 120) {
  const [missing, graded] = partition(rawAssignments, a => a.status === 'missing' || a.status === 'late-missing');
  
  if (isEmpty(graded)) return 0;

  const b = DIFFICULTY[difficulty] ?? DIFFICULTY.STANDARD;
  const product = reduce(graded, (prod, raw) => {
    if (prod === 0) return 0;
    const earned = parseFloat(raw.earnedPoints) || 0;
    const total = parseFloat(raw.totalPoints) || 0;
    const g = total > 0 ? clampGrade(earned / total) : 0;
    return prod * assignmentTerm(g, earned, b);
  }, 1);

  const penalty = missing.length * MISSING_PENALTY_MINUTES;
  return clamp((product * baseMinutes) - penalty, 0, baseMinutes);
}
