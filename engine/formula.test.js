

const DIFFICULTY = { STANDARD: 12.5, HARD: 10 };
const MISSING_PENALTY_MINUTES = 15;

function clampGrade(rawGrade) {
    if (typeof rawGrade !== 'number' || isNaN(rawGrade)) return 0;
    const normalized = rawGrade > 1 ? rawGrade / 100 : rawGrade;
    return Math.max(0, Math.min(1, normalized));
}

function assignmentTerm(g, p, b) {
    if (g <= 0) return 0;
    if (p <= 0 || b <= 0) return 1;
    return Math.pow(g, p / b);
}

function calculateEarnedMinutes({ assignments = [], missingCount = 0, difficulty = 'STANDARD', baseMinutes = 120 }) {
    const b = DIFFICULTY[difficulty] ?? DIFFICULTY.STANDARD;
    if (!assignments || assignments.length === 0) {
        return Math.max(0, -(missingCount * MISSING_PENALTY_MINUTES));
    }
    let product = 1;
    for (const a of assignments) {
        const g = clampGrade(a.g);
        const p = a.p ?? 0;
        product *= assignmentTerm(g, p, b);
        if (product === 0) break;
    }
    let earned = product * baseMinutes;
    earned -= missingCount * MISSING_PENALTY_MINUTES;
    return Math.max(0, Math.min(baseMinutes, earned));
}

let passed = 0;
let failed = 0;

function assertApprox(label, actual, expected, tolerance = 0.01) {
    const ok = Math.abs(actual - expected) <= tolerance;
    if (ok) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}`);
        console.error(`      Expected: ${expected.toFixed(4)}, Got: ${actual.toFixed(4)}`);
        failed++;
    }
}

function assertExact(label, actual, expected) {
    if (actual === expected) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}`);
        console.error(`      Expected: ${expected}, Got: ${actual}`);
        failed++;
    }
}

console.log('\n📐 FocusLock Formula Engine Tests\n');

console.log('Test 1: Zero assignments');
assertExact(
    'Empty array returns 0',
    calculateEarnedMinutes({ assignments: [] }),
    0
);

console.log('\nTest 2: Perfect grade, single assignment (standard)');
assertApprox(
    '100% on 10pt assignment → 120 min',
    calculateEarnedMinutes({ assignments: [{ g: 1.0, p: 10 }], difficulty: 'STANDARD', baseMinutes: 120 }),
    120
);

console.log('\nTest 3: Two graded assignments (manual calculation)');
const t1 = Math.pow(0.85, 20 / 12.5);
const t2 = Math.pow(0.9, 10 / 12.5);
const expected3 = t1 * t2 * 120;
assertApprox(
    `g=0.85/p=20 and g=0.90/p=10 → ~${expected3.toFixed(1)} min`,
    calculateEarnedMinutes({
        assignments: [{ g: 0.85, p: 20 }, { g: 0.9, p: 10 }],
        difficulty: 'STANDARD',
        baseMinutes: 120,
    }),
    expected3,
    0.1
);

console.log('\nTest 4: Missing assignments subtract 15 min each');
assertApprox(
    '120 min earned, 2 missing → 90 min',
    calculateEarnedMinutes({
        assignments: [{ g: 1.0, p: 10 }],
        missingCount: 2,
        difficulty: 'STANDARD',
        baseMinutes: 120,
    }),
    90
);

console.log('\nTest 5: Result clamps to 0 (never negative)');
assertExact(
    'Many missing, low grade → 0 min (not negative)',
    calculateEarnedMinutes({
        assignments: [{ g: 0.5, p: 5 }],
        missingCount: 10,
        difficulty: 'STANDARD',
        baseMinutes: 120,
    }),
    0
);

console.log('\nTest 6: Zero grade zeroes the whole product');
assertExact(
    'g=0 on any assignment → 0 min earned',
    calculateEarnedMinutes({
        assignments: [{ g: 1.0, p: 20 }, { g: 0, p: 10 }],
        difficulty: 'STANDARD',
        baseMinutes: 120,
    }),
    0
);

console.log('\nTest 7: Hard mode is stricter than Standard mode for sub-perfect grades');
const standard = calculateEarnedMinutes({ assignments: [{ g: 0.8, p: 20 }], difficulty: 'STANDARD', baseMinutes: 120 });
const hard = calculateEarnedMinutes({ assignments: [{ g: 0.8, p: 20 }], difficulty: 'HARD', baseMinutes: 120 });
if (hard < standard) {
    console.log(`  ✅  Hard (${hard.toFixed(1)} min) < Standard (${standard.toFixed(1)} min)`);
    passed++;
} else {
    console.error(`  ❌  Expected hard < standard — Hard: ${hard.toFixed(1)}, Standard: ${standard.toFixed(1)}`);
    failed++;
}

console.log('\nTest 8: Grade in 0-100 range auto-normalized to decimal');
const withDecimal = calculateEarnedMinutes({ assignments: [{ g: 0.9, p: 10 }], difficulty: 'STANDARD', baseMinutes: 120 });
const withPercent = calculateEarnedMinutes({ assignments: [{ g: 90, p: 10 }], difficulty: 'STANDARD', baseMinutes: 120 });
assertApprox('g=0.9 and g=90 produce same result', withDecimal, withPercent, 0.01);

console.log('\nTest 9: Multi-assignment, hard mode, 1 missing');
const t9a = Math.pow(0.75, 15 / 10);
const t9b = Math.pow(0.88, 8 / 10);
const expected9 = Math.max(0, t9a * t9b * 120 - 15);
assertApprox(
    `g=0.75/p=15 + g=0.88/p=8, hard, 1 missing → ~${expected9.toFixed(1)} min`,
    calculateEarnedMinutes({
        assignments: [{ g: 0.75, p: 15 }, { g: 0.88, p: 8 }],
        missingCount: 1,
        difficulty: 'HARD',
        baseMinutes: 120,
    }),
    expected9,
    0.1
);

console.log(`\n${'─'.repeat(45)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.error('❌ Some tests FAILED.\n');
    process.exit(1);
} else {
    console.log('✅ All tests passed.\n');
}
