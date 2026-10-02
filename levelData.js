// ============================================================================
// LEVEL DATA — how far each car is from its villain
// ============================================================================
// One row per level, three figures to a row: the DISTANCE (metres) between
// each lane's car and its villain, lanes top to bottom.
//
//   LEVEL_DISTANCES[0]  →  level 1  →  [top, middle, bottom]
//
// Every tick the piggy driving a lane's car takes its distance per second
// (CHARGE_PER_SECOND_BY_LEVEL) off that lane's figure — its damage, in effect.
// At zero the villain is caught and pays out (levelPayoutsFor); when all three
// are caught the next level begins.
//
// THESE ARE BLUMGI MERGE'S MONSTER HP, the economy the game was paced
// against: 2.5× the reference balance, rounded to clean numbers. The biggest
// figure is the bottom lane almost everywhere, so a player keeps their strongest
// piggy there. Rows 7, 30 and 64 dip on purpose — rest levels.
//
// Past level 65 the last row is reused, and says so once (levelDistancesFor).
//
// Loaded before config.js (see index.html).
// ============================================================================

var LEVEL_DISTANCES = [
    [            25,             35,             65],   // 1
    [            70,            120,            250],   // 2
    [           450,            600,           1200],   // 3
    [          2000,           3000,           5000],   // 4
    [          7500,           9000,          12000],   // 5
    [         10000,          18000,          25000],   // 6
    [          6500,           6500,           6500],   // 7
    [         20000,          35000,          65000],   // 8
    [         75000,          90000,         120000],   // 9
    [        400000,         400000,         400000],   // 10
    [        400000,         450000,         650000],   // 11
    [       1200000,        2000000,        2500000],   // 12
    [       4000000,        4500000,        6500000],   // 13
    [       3500000,        5000000,        5000000],   // 14
    [       9000000,       10000000,       10000000],   // 15
    [      18000000,       25000000,       25000000],   // 16
    [      45000000,       50000000,       50000000],   // 17
    [      85000000,      120000000,      120000000],   // 18
    [     140000000,      180000000,      250000000],   // 19
    [     250000000,      400000000,      500000000],   // 20
    [     500000000,      600000000,      750000000],   // 21
    [     850000000,     1400000000,     1400000000],   // 22
    [    1200000000,     1500000000,     1800000000],   // 23
    [    1400000000,     2000000000,     2500000000],   // 24
    [    3000000000,     3000000000,     3000000000],   // 25
    [    3500000000,     3500000000,     2500000000],   // 26
    [    2500000000,     3000000000,     3500000000],   // 27
    [    2500000000,     4000000000,     4000000000],   // 28
    [    3500000000,     4500000000,     4500000000],   // 29
    [     120000000,      200000000,      250000000],   // 30
    [    4500000000,     5500000000,     6000000000],   // 31
    [    4500000000,     6500000000,     6500000000],   // 32
    [    5500000000,     7000000000,     7000000000],   // 33
    [    5500000000,     8000000000,     8000000000],   // 34
    [    7000000000,     8500000000,     9000000000],   // 35
    [    7000000000,    10000000000,    10000000000],   // 36
    [   10000000000,    12000000000,    12000000000],   // 37
    [   10000000000,    14000000000,    14000000000],   // 38
    [   14000000000,    16000000000,    16000000000],   // 39
    [   16000000000,    16000000000,    12000000000],   // 40
    [   16000000000,    20000000000,    20000000000],   // 41
    [   16000000000,    25000000000,    25000000000],   // 42
    [   50000000000,    60000000000,    75000000000],   // 43
    [   70000000000,   120000000000,   120000000000],   // 44
    [  120000000000,   150000000000,   180000000000],   // 45
    [  140000000000,   200000000000,   250000000000],   // 46
    [  200000000000,   250000000000,   250000000000],   // 47
    [  250000000000,   350000000000,   350000000000],   // 48
    [  350000000000,   400000000000,   450000000000],   // 49
    [  400000000000,   650000000000,   650000000000],   // 50
    [  600000000000,   750000000000,   900000000000],   // 51
    [  850000000000,  1200000000000,  1200000000000],   // 52
    [ 1200000000000,  1600000000000,  1800000000000],   // 53
    [ 1600000000000,  2500000000000,  2500000000000],   // 54
    [ 2500000000000,  3000000000000,  4000000000000],   // 55
    [ 3000000000000,  5000000000000,  5000000000000],   // 56
    [ 4500000000000,  5500000000000,  6500000000000],   // 57
    [ 5000000000000,  7500000000000,  7500000000000],   // 58
    [ 7500000000000,  9000000000000, 10000000000000],   // 59
    [ 8500000000000, 12000000000000, 12000000000000],   // 60
    [12000000000000, 14000000000000, 15000000000000],   // 61
    [12000000000000, 18000000000000, 18000000000000],   // 62
    [16000000000000, 20000000000000, 20000000000000],   // 63
    [  600000000000,  1000000000000,  1200000000000],   // 64
    [20000000000000, 25000000000000, 25000000000000],   // 65
];

// WHAT EACH VILLAIN PAYS when caught, where it is not simply its own distance.
// The opening levels' figures are too small to pay for more than a spawn or
// two, so they pay a flat amount instead — enough to get the grid going. From
// level 3 on a villain pays its distance (× CONFIG.VILLAIN.PAYOUT_MULT).
var LEVEL_PAYOUT_OVERRIDES = {
    1: [250, 250, 250],
    2: [300, 300, 300],
};

// The three distances for a level, counted from 1. Out of range takes the last
// row, and says so once: a level with no figures of its own is a content gap,
// not something to fail on.
var _levelDistancesWarned = false;
function levelDistancesFor(level) {
    const n = LEVEL_DISTANCES.length;
    if (!(level >= 1)) level = 1;
    if (level > n) {
        if (!_levelDistancesWarned) {
            _levelDistancesWarned = true;
            console.warn(`[levels] level ${level} is past the end of LEVEL_DISTANCES (${n} rows) — ` +
                `reusing row ${n}. Add rows to levelData.js.`);
        }
        level = n;
    }
    return LEVEL_DISTANCES[level - 1];
}

// The three villains' payouts for a level, top to bottom.
function levelPayoutsFor(level) {
    const o = LEVEL_PAYOUT_OVERRIDES[Math.floor(level)];
    if (o) return o.slice();
    const mult = (typeof CONFIG !== 'undefined' && CONFIG.VILLAIN && CONFIG.VILLAIN.PAYOUT_MULT !== undefined)
        ? CONFIG.VILLAIN.PAYOUT_MULT : 1;
    return levelDistancesFor(level).map((d) => Math.max(1, Math.round(d * mult)));
}
