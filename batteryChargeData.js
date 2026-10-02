/**
 * ITEM DATA FILE
 *
 * The piggy driver's art, and what it's worth.
 *
 * AN ITEM IS TWO PICTURES: a piggy (graphics/piggy, 28 of them) with a
 * steering wheel (graphics/st_wheel, 90 of them) laid over it. The two are
 * drawn together into ONE texture per level at runtime (AssetManager.
 * composeBattery in game.js), so the rest of the game handles an item as a
 * single sprite.
 *
 *   level 1..90   wheel = the level's own number; piggy LOOPS every 28
 *                 (level 29 is piggy 1 with wheel 29)
 *   level 91+     the whole picture loops back to level 1's — see
 *                 getBatteryIconLevel in config.js
 *
 * DISTANCE VALUES BY LEVEL (CHARGE_PER_SECOND_BY_LEVEL) are SEPARATE from the
 * art on purpose: a level's picture can loop while its figure keeps climbing.
 */

// ==================================================================================
// THE ART
// ==================================================================================
var ITEM_ART = {
    // file name = prefix + number (zero-padded to `pad`) + '.' + ext
    PIGGY: { folder: 'piggy',    prefix: 'item_',     count: 28, ext: 'webp', pad: 2 },
    WHEEL: { folder: 'st_wheel', prefix: 'st_wheel_', count: 90, ext: 'webp', pad: 2 },
    // Where the wheel goes, in the PIGGY's own pixels — its top-left corner
    // and its size — for a piggy of REF_W × REF_H. Art of another size is
    // scaled to match.
    REF_W: 156,
    REF_H: 136,
    WHEEL_AT: { x: 82, y: 61, size: 64 },
};

// DISTANCE PER SECOND (metres) a pig of each level covers while in a slot.
// 12.5 × 1.5^(level − 1) up to level 31, then 2.5× the reference curve;
// rounded to clean numbers, and never falling — two neighbouring levels can
// share a figure where the curve rises slower than the clean steps do.
var CHARGE_PER_SECOND_BY_LEVEL = {
    1: 12,
    2: 18,
    3: 30,
    4: 40,
    5: 65,
    6: 95,
    7: 140,
    8: 200,
    9: 300,
    10: 500,
    11: 700,
    12: 1000,
    13: 1600,
    14: 2500,
    15: 3500,
    16: 5500,
    17: 8000,
    18: 12000,
    19: 18000,
    20: 30000,
    21: 40000,
    22: 60000,
    23: 95000,
    24: 140000,
    25: 200000,
    26: 300000,
    27: 450000,
    28: 700000,
    29: 1000000,
    30: 1600000,
    31: 2500000,
    32: 2500000,
    33: 5000000,
    34: 7500000,
    35: 12000000,
    36: 18000000,
    37: 30000000,
    38: 40000000,
    39: 50000000,
    40: 65000000,
    41: 75000000,
    42: 120000000,
    43: 140000000,
    44: 150000000,
    45: 180000000,
    46: 180000000,
    47: 250000000,
    48: 250000000,
    49: 300000000,
    50: 300000000,
    51: 350000000,
    52: 350000000,
    53: 400000000,
    54: 400000000,
    55: 450000000,
    56: 500000000,
    57: 550000000,
    58: 550000000,
    59: 600000000,
    60: 650000000,
    61: 650000000,
    62: 700000000,
    63: 700000000,
    64: 750000000,
    65: 800000000,
    66: 850000000,
    67: 900000000,
    68: 950000000,
    69: 1000000000,
    70: 1200000000,
    71: 1200000000,
    72: 1200000000,
    73: 1400000000,
    74: 1500000000,
    75: 1600000000,
    76: 1800000000,
    77: 1800000000,
    78: 2000000000,
    79: 2500000000,
    80: 2500000000,
    81: 5000000000,
    82: 7500000000,
    83: 10000000000,
    84: 12000000000,
    85: 15000000000,
    86: 18000000000,
    87: 20000000000,
    88: 25000000000,
    89: 25000000000,
    90: 25000000000,
    91: 30000000000,
    92: 35000000000,
    93: 40000000000,
    94: 45000000000,
    95: 50000000000,
    96: 65000000000,
    97: 75000000000,
    98: 90000000000,
    99: 100000000000,
    100: 120000000000
};

// ==================================================================================
// HELPER FUNCTIONS - Used by the game code
// ==================================================================================

function _itemFile(art, n) {
    const num = art.pad ? String(n).padStart(art.pad, '0') : String(n);
    return `graphics/${art.folder}/${art.prefix}${num}.${art.ext}`;
}

// Which piggy picture an ICON level wears — the 28 loop.
function itemPiggyIndex(iconLvl) {
    return ((iconLvl - 1) % ITEM_ART.PIGGY.count) + 1;
}
function itemPiggyPath(iconLvl) { return _itemFile(ITEM_ART.PIGGY, itemPiggyIndex(iconLvl)); }
function itemWheelPath(iconLvl) { return _itemFile(ITEM_ART.WHEEL, iconLvl); }

// Distance per second for a level.
function getBatteryChargeValue(level) {
    return CHARGE_PER_SECOND_BY_LEVEL[level] || (level * 5); // Fallback for undefined levels
}

// The number of DISTINCT pictures — one per wheel. Past it, the art loops.
function getHighestBatteryLevel() {
    return ITEM_ART.WHEEL.count;
}
