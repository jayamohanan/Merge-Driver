// assets.js — WHAT ART THE GAME FETCHES, as plain data.
//
// Two readers, one list:
//   game.js   loads exactly these files (preload, and each level as it nears)
//   build.sh  runs these same functions to write <link rel="preload"> hints
//             into the build's index.html, so the browser starts fetching the
//             opening art the moment the page arrives — while Phaser and
//             game.js are still downloading, instead of after.
//
// That is why this lives outside the game scene: the build has no Phaser and
// no scene, only the config and the maps. Everything here reads CONFIG and a
// map and nothing else. Keeping ONE copy of these rules is the point — a file
// the game draws but this list forgets would load late and never be hinted,
// and nothing would say so.
//
// Loaded after config.js, before game.js.

// Every entry is { type, key, url, frame? }:
//   type  'image' | 'sheet' | 'json'
//   frame { frameWidth, frameHeight } for a sheet
function assetList() {
    const out = new Map();
    const add = (type, key, url, frame) => {
        if (key && url && !out.has(key)) out.set(key, frame ? { type, key, url, frame } : { type, key, url });
    };
    return {
        image: (key, url) => add('image', key, url),
        sheet: (key, url, w, h) => add('sheet', key, url, { frameWidth: w, frameHeight: h }),
        json:  (key, url) => add('json', key, url),
        list:  () => [...out.values()],
    };
}

// ── SHARED ART ───────────────────────────────────────────────────────────────
// Everything the game needs: the merge grid's UI. There is no per-level
// fetching — this one list is the whole of it.
function sharedAssets() {
    const A = assetList();

    // THE STARTING PIG'S TWO PICTURES — its piggy and its steering wheel —
    // by the LOOPED icon level (getBatteryIconLevel). The scene draws them
    // into one texture in create (AssetManager.composeBattery).
    const startIcon = getBatteryIconLevel(CONFIG.BATTERY_START_LEVEL);
    A.image(itemPiggyKey(startIcon), itemPiggyPath(startIcon));
    A.image(itemWheelKey(startIcon), itemWheelPath(startIcon));
    A.image('coin',       'graphics/ui/merge-grid/coin.webp');
    A.image('point',      'graphics/ui/merge-grid/point.webp');
    A.image('button',     'graphics/ui/merge-grid/spawn_button.webp');
    // The level-up-all button — text, icon and all baked into the one file,
    // so nothing is drawn over it (see createButtons).
    A.image('upgrade_button', 'graphics/ui/merge-grid/upgrade_button.webp');
    // The pig's own outline, as drawn, behind the slot hint's arrow (see
    // _showSlotHint / CONFIG.HINT_ICON) so the hint reads as "drag the pig
    // here" instead of a bare arrow.
    A.image('pig_hint', 'graphics/ui/merge-grid/piggy_icon.webp');
    // Grain for the cell faces: neutral grey + blurred noise, blended over the
    // flat colour at bake time (see _makeCellTextures).
    A.image('cell_noise', 'graphics/ui/merge-grid/cell_noise.webp');
    // The car: a right-facing body and the one tyre, used twice per car
    // (see CONFIG.CAR / _makeCar).
    A.image('car_body', 'graphics/hero_car/hero_car_01.webp');
    A.image('car_tyre', 'graphics/hero_car/hero_tyre_01.webp');
    // The getaway cars — each design's body and tyre (CONFIG.VILLAIN.CAR.CARS).
    ((((CONFIG.VILLAIN || {}).CAR) || {}).CARS || []).forEach((c, i) => {
        A.image(getawayBodyKey(i + 1), c.BODY);
        A.image(getawayTyreKey(i + 1), c.TYRE);
    });
    // The villains — all three, they are small and one turns up every level.
    const V = CONFIG.VILLAIN || {};
    (V.FILES || []).forEach((f, i) => A.image(villainKey(i + 1), (V.DIR || 'graphics/villain/') + f));
    return A.list();
}

// The keys an item's two SOURCE pictures load under. The finished item is
// `battery<iconLvl>`, so none of these can collide with it.
function itemPiggyKey(iconLvl) { return `item_piggy_${itemPiggyIndex(iconLvl)}`; }
function itemWheelKey(iconLvl) { return `item_wheel_${iconLvl}`; }

// Which villain a level brings — FILES, looping — and the key it loads under.
function villainIndexFor(level) {
    const n = ((CONFIG.VILLAIN || {}).FILES || []).length || 1;
    return ((Math.max(1, Math.floor(level)) - 1) % n) + 1;
}
function villainKey(i) { return `villain_${i}`; }
function getawayBodyKey(i) { return `getaway_body_${i}`; }
function getawayTyreKey(i) { return `getaway_tyre_${i}`; }
