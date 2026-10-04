// Merge Driver — main game scene
// No physics engine — pure drag/drop merge, with the car area beside it: the pigs
// in its three slots drive the car, and the distance driven pays the coins.

// AN ITEM'S ART CAN RUN PAST ITS PIG. The pig face is the top-left
// CELL.ICON_PIG_PX square of the texture; the rest of the canvas (the tool) is
// allowed out of the icon box. So the ORIGIN goes on the pig's centre — the
// sprite is still placed at the box's centre and the pig lands exactly there —
// and the size is set so that square, not the whole canvas, is pigW × pigH.
function itemPigOrigin(spr) {
    const P = CONFIG.CELL.ICON_PIG_PX || 128;
    const f = spr.frame;
    return spr.setOrigin(Math.min(1, P / 2 / f.realWidth), Math.min(1, P / 2 / f.realHeight));
}
function fitItemIcon(spr, pigW, pigH) {
    const P = CONFIG.CELL.ICON_PIG_PX || 128;
    const f = spr.frame;
    itemPigOrigin(spr);
    return spr.setDisplaySize(pigW * f.realWidth / P, pigH * f.realHeight / P);
}

class AssetManager {
    constructor(scene) {
        this.scene = scene;
        this.loading = new Map();
    }

    ensureImage(key, url) {
        if (this.scene.textures.exists(key)) {
            return Promise.resolve();
        }

        if (this.loading.has(key)) {
            return this.loading.get(key);
        }

        // RESOLVES EITHER WAY, and only on ITS OWN file. It used to reject, and
        // to listen for the next 'loaderror' from ANY file — so one unrelated
        // failed download rejected whichever battery happened to be in flight,
        // and the await that was waiting on it threw. Whatever it was building
        // was then never built.
        const promise = new Promise((resolve) => {
            const done = () => {
                this.scene.load.off(`filecomplete-image-${key}`, ok);
                this.scene.load.off('loaderror', fail);
                this.loading.delete(key);
                resolve();
            };
            const ok = () => done();
            const fail = (file) => { if (!file || file.key === key) done(); };
            this.scene.load.on(`filecomplete-image-${key}`, ok);
            this.scene.load.on('loaderror', fail);
            this.scene.load.image(key, url);
            this.scene.load.start();
        });

        this.loading.set(key, promise);
        return promise;
    }

    // AN ITEM'S TEXTURE, `battery<iconLvl>`: its piggy and its steering wheel
    // fetched, then drawn together into one (composeBattery). Resolves either
    // way, like ensureImage — if a picture fails the item is simply not there.
    ensureBattery(iconLvl) {
        const key = `battery${iconLvl}`;
        if (this.scene.textures.exists(key)) return Promise.resolve();
        if (this.loading.has(key)) return this.loading.get(key);
        const promise = Promise.all([
            this.ensureImage(itemPiggyKey(iconLvl), itemPiggyPath(iconLvl)),
            this.ensureImage(itemWheelKey(iconLvl), itemWheelPath(iconLvl)),
        ]).then(() => {
            this.loading.delete(key);
            if (this.scene.sys && this.scene.sys.isActive()) this.composeBattery(iconLvl);
        });
        this.loading.set(key, promise);
        return promise;
    }

    // THE PIGGY WITH ITS WHEEL ON, baked into one canvas texture the size of
    // the piggy — the wheel at ITEM_ART.WHEEL_AT, scaled with the piggy if the
    // art is not the reference size. Needs both pictures in hand; returns
    // whether the texture now exists.
    composeBattery(iconLvl) {
        const T = this.scene.textures;
        const key = `battery${iconLvl}`;
        if (T.exists(key)) return true;
        const pk = itemPiggyKey(iconLvl), wk = itemWheelKey(iconLvl);
        if (!T.exists(pk) || !T.exists(wk)) return false;
        const pig = T.get(pk).getSourceImage(), wheel = T.get(wk).getSourceImage();
        const at = ITEM_ART.WHEEL_AT;
        const kx = pig.width / ITEM_ART.REF_W, ky = pig.height / ITEM_ART.REF_H;
        const canvas = T.createCanvas(key, pig.width, pig.height);
        if (!canvas) return false;
        const ctx = canvas.getContext();
        ctx.drawImage(pig, 0, 0);
        ctx.drawImage(wheel, at.x * kx, at.y * ky, at.size * kx, at.size * ky);
        canvas.refresh();
        return true;
    }

    // A battery texture that EXISTS RIGHT NOW: the level's own if it is in
    // hand, otherwise the nearest lower one already loaded.
    //
    // Nothing waits for a download before it is drawn. A merge result held back
    // until its picture arrived left a battery that was in the grid but on
    // screen as nothing — and a cell that looked empty took another battery on
    // top of it. The tile appears at once wearing the closest picture there is,
    // and swaps to its own the moment that lands.
    iconKey(iconLvl) {
        for (let l = iconLvl; l >= 1; l--) {
            const k = `battery${l}`;
            if (this.scene.textures.exists(k)) return k;
        }
        return `battery${iconLvl}`;
    }

    // A PIGGY IN A SLOT: `spr` wears the piggy alone and `wheel` its steering
    // wheel, as soon as both pictures are in hand — the wheel is a sprite of
    // its own there, so it can turn (see GameScene._steerWheels). Until then
    // the wheel stays hidden and the sprite wears whatever it already has.
    dressSlotWhenReady(spr, wheel, iconLvl) {
        const T = this.scene.textures;
        const wear = () => {
            if (!spr.scene || !wheel.scene) return;
            const pk = itemPiggyKey(iconLvl), wk = itemWheelKey(iconLvl);
            if (!T.exists(pk) || !T.exists(wk)) return;
            spr.setTexture(pk);
            itemPigOrigin(spr);
            wheel.setTexture(wk);
            wheel.ready = true;
        };
        if (T.exists(itemPiggyKey(iconLvl)) && T.exists(itemWheelKey(iconLvl))) wear();
        else this.ensureBattery(iconLvl).then(wear);
    }

    // Draw `spr` as `iconLvl` as soon as that art is in hand. Safe to call for a
    // texture already loaded — it simply sets it.
    dressWhenReady(spr, iconLvl) {
        // setTexture keeps the sprite's SCALE, and every item's pig is the
        // same ICON_PIG_PX square — so the same scale keeps the pig the same
        // size on any canvas, and a bigger canvas just spills further out. Only
        // the origin has to follow the new canvas (see fitItemIcon).
        const wear = (key) => {
            spr.setTexture(key);
            itemPigOrigin(spr);
        };
        const key = `battery${iconLvl}`;
        if (this.scene.textures.exists(key)) { wear(key); return; }
        this.ensureBattery(iconLvl).then(() => {
            if (spr && spr.scene && this.scene.textures.exists(key)) wear(key);
        });
    }

    // Warm a battery level in the background (fire-and-forget).
    // ensureBattery already dedupes via textures.exists + the loading Map.
    prefetchBattery(level) {
        if (level < 1) return;
        this.ensureBattery(level).catch(() => {});
    }

    // ...and the few after it. A battery icon is ~2.5KB, so fetching several
    // levels ahead costs almost nothing and means a fast run of merges never
    // reaches a level whose picture has not arrived. Anything already loaded or
    // in flight is skipped, so calling this on every merge is free.
    prefetchAhead(level) {
        const n = Math.max(1, CONFIG.BATTERY_PREFETCH_AHEAD !== undefined
                            ? CONFIG.BATTERY_PREFETCH_AHEAD : 3);
        const top = getHighestBatteryLevel();
        for (let l = level; l < level + n && l <= top; l++) this.prefetchBattery(l);
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    // ================================================================
    // INIT
    // ================================================================
    init() {
        this.platforms          = [];   // 3 battery slots (share this name so the
                                        // drag/drop code keeps working unchanged)
        this.coins              = CONFIG.START_COINS;
        this.grid               = Array(3).fill(null).map(() => Array(3).fill(null));
        this.gridCells          = [];
        this.batteries          = [];
        this.draggingBattery    = null;
        this.hasStartedPlaying  = false;
        this.spawnButtonLevel   = CONFIG.BATTERY_START_LEVEL;
        this.spawnCost          = CONFIG.ECONOMY.SPAWN_COST_PER_LEVEL * CONFIG.BATTERY_START_LEVEL;
        this.highestBatteryLevel = CONFIG.BATTERY_START_LEVEL;
        this.levelUpTimer       = null;
        this.levelUpButtonVisible    = false;
        this.levelUpButtonShowTime   = null;
        this.firstLevelUpTimer  = true;
        this.mergeTutorialShown = false;
        this.mergePointer       = null;
        this.slotHints          = null;   // the "put one here" arrows, per slot
        this.slotHintPending    = false;  // …scheduled but not yet up
        this.slotHintDone       = false;  // …every slot has had its first pig
        this.slotHintSeen       = [false, false, false];  // …per slot: had its first pig
        this.isWatchingAd = false;  // Flag to block interactions during ad

        this.CELL_SIZE  = CONFIG.CELL.SIZE;
        this.CELL_GAP   = CONFIG.CELL.GAP;
        this.CELL_RADIUS= CONFIG.CELL.RADIUS;
        this.GRID_COLS  = 3;
        this.GRID_ROWS  = 3;

        this.chargingSlots    = [null, null, null];
        this.chargingInterval = null;

        // ── The car area ─────────────────────────────────────────────────
        // How far the slots have driven, in metres — the run's progress.
        this.distance          = 0;
        this.carArea           = null;   // the empty rect right of the slots
        this.villainArea       = null;   // …and what the cars leave of it
        this.cars              = [];     // one per slot, on its slot's road line
        this.steeringItems     = [];     // slot piggies whose wheels turn
        // ── The level: one villain per lane ──────────────────────────────
        // lanes[i] is lane i's chase: how far its car still is from its
        // villain (`left`, of `total`), what catching it pays, and whether it
        // has been caught. See levelData.js.
        this.level             = 1;
        this.lanes             = null;
        this.villains          = [];     // one sprite per lane
        this.laneLabels        = [];     // the distance, on each gap line
        this.gapLines          = null;   // one graphics for the three lines
        this.roadGfx           = null;   // one graphics for the three roads
        this.roadOffsets       = [0, 0, 0];  // how far each lane's road has slid, px
        this.roadGapOpen       = [1, 1, 1];  // each lane's road break: 1 open, 0 joined
        this.roadGapAt         = [null, null, null];  // where the villain's piece starts
        this._levelTurning     = false;  // between the last catch and the next level
        this.wantedCards       = [];     // the intro's cards, while they are up
        this.caughtCards       = [];     // per lane: its CAUGHT card / badge
        this.perps             = [];     // per lane: the caught villain, cuffed, in front of the cars
        this._briefing         = false;  // the intro's cards are up: no chasing yet

        // Layout state for responsive design
        this.isPortrait         = true;  // Detected in create()
        this.layoutConfig       = {};    // Will store calculated layout values
        this.platformsContainer = null;
        this.gridContainer      = null;
        this.uiContainer        = null;
    }

    // ================================================================
    // LAYOUT HELPERS
    // ================================================================
    calculateLayout() {
        const W = this.scale.width;
        const H = this.scale.height;
        this.isPortrait = H > W;

        // THE DESIGN FIGURES, FROM THE CONFIG — never this.CELL_SIZE / CELL_GAP,
        // which hold the SCALED sizes once a layout has run (see
        // _applyLayoutFields). Read from there, a relayout scaled an already
        // scaled cell again, and the grid grew with every turn of the screen.
        const COLS = this.GRID_COLS, ROWS = this.GRID_ROWS, GAP = CONFIG.CELL.GAP;
        const P    = CONFIG.PLATFORM;
        const isP  = this.isPortrait;

        // Design-space constants. None of these depend on the split, so they
        // come first: the design column is built out of them.
        const BASE        = CONFIG.CELL.SIZE;                         // 130
        const panPadRef   = CONFIG.CELL.GRID_PANEL_PADDING;          // 14
        const btnBotRef   = CONFIG.BUTTON.BOTTOM_PADDING;            // 70
        const btnGridRef  = CONFIG.MERGE_GRID.PADDING_FROM_BUTTON_TOP; // 50
        const coinGapRef  = 25;
        const coinHRef    = 32;                                      // counter height
        const spawnBtnLogHalfRef = CONFIG.BUTTON.SPAWN_HEIGHT / 2;   // 45
        const designGridH = ROWS * BASE + (ROWS - 1) * CONFIG.CELL.GAP;
        const designPanH  = designGridH + 2 * panPadRef;

        // ── The design column, and the split ─────────────────────────────────
        // ONE COLUMN, BOTH ORIENTATIONS. The UI half holds coin, panel and
        // button and nothing else — the slots live in the car area — so
        // the reference height is the same either way and there is no longer a
        // per-orientation branch to keep in step.
        //
        //   6  top margin
        //   +  coin (half its height to its centre) + coinGap
        //   +  panel, less the padding already counted by the button gap
        //   +  gap to button + button half-height + bottom margin
        // which lands the coin's centre at 22 — hard against the top — and the
        // panel at 47..473 with the button at 554, in a column of 624.
        const LY    = CONFIG.LAYOUT || {};
        const REF_H = LY.REF_H_COLUMN || (6 + coinHRef / 2 + coinGapRef + designPanH
                                          - panPadRef + btnGridRef + spawnBtnLogHalfRef + btnBotRef);

        // ── partA (UI) and partB (the car area) ───────────────────────────────
        // Portrait:  partA = bottom, partB = top    (PORTRAIT_SPLIT)
        // Landscape: partA = left,   partB = right  (LANDSCAPE_SPLIT)
        //
        // Both are the UI HALF'S share, so 0.5 either way is an even split and
        // the two numbers mean the same thing.
        const splitL = LY.LANDSCAPE_SPLIT !== undefined ? LY.LANDSCAPE_SPLIT : 0.5;
        const splitP = LY.PORTRAIT_SPLIT  !== undefined ? LY.PORTRAIT_SPLIT  : 0.5;
        let partA, partB;
        if (isP) {
            partA = { x: 0, y: H * (1 - splitP), width: W, height: H * splitP };
            partB = { x: 0, y: 0,                width: W, height: H * (1 - splitP) };
        } else {
            partA = { x: 0,          y: 0, width: W * splitL,       height: H };
            partB = { x: W * splitL, y: 0, width: W * (1 - splitL), height: H };
        }

        // ── TWO-FACTOR RESPONSIVE SIZING ───────────────────────────────────────
        // Single design reference = my 1440×778 landscape MacBook, whose partA
        // (left half) is 720×778. partB has identical dimensions to partA in both
        // orientations, so the same factors apply to both halves.
        //   sW    = width  ratio  → HORIZONTAL gaps / margins / offsets
        //   sH    = height ratio  → VERTICAL   gaps / margins / positions
        //   scale = min(sW, sH)   → UNIFORM element SIZES (keeps the grid square)
        // No upper clamp — everything scales past the reference on bigger screens.
        //
        // REF_W in landscape is the half AT THE CURRENT SPLIT, which is what
        // keeps the grid the same size when the split moves: sW works out to
        // screenWidth/1440 whatever the split is (0.5·W/720 === 0.4·W/576). Do
        // not "simplify" this back to a constant.
        const REF_W = isP ? (LY.REF_W_PORTRAIT || 720) : 1440 * splitL;
        const sW    = partA.width  / REF_W;             // horizontal ratio
        const sH    = partA.height / REF_H;             // vertical ratio
        const baseScale = Math.min(sW, sH);             // uniform size factor (square-preserving)
        // LANDSCAPE: THE MERGE COLUMN GROWS INTO SPARE HEIGHT. A half taller
        // than the width-fitted column needs (sH > sW — 16:9 already, more so
        // 16:10 and an iPad) lets the coin/grid/button column grow, up to
        // LANDSCAPE_GRID_GROW × and never past the height or LANDSCAPE_GRID_MAX_W
        // of the half's width. Only this column: the car area keeps baseScale
        // (exported as `scale`), its slots baseCell. Portrait is untouched.
        let scale = baseScale;
        if (!isP) {
            const grow = LY.LANDSCAPE_GRID_GROW !== undefined ? LY.LANDSCAPE_GRID_GROW : 1.15;
            const designPanW = COLS * BASE + (COLS - 1) * GAP + 2 * panPadRef;
            const wCap = partA.width * (LY.LANDSCAPE_GRID_MAX_W !== undefined ? LY.LANDSCAPE_GRID_MAX_W : 0.9) / designPanW;
            scale = Math.max(baseScale, Math.min(baseScale * grow, sH, wCap));
        }
        const cellSize = BASE * scale;                  // no Math.min(BASE,…) clamp
        const baseCell = BASE * baseScale;              // the car area's slots stay at this

        // SIZES — uniform `scale`
        const panPad           = Math.floor(panPadRef * scale);
        const spawnBtnLogHalf  = spawnBtnLogHalfRef * scale;        // button half-height is a SIZE
        const spawnBtnDisplayH = Math.floor((CONFIG.BUTTON.SPAWN_HEIGHT + 30) * scale);
        const panW             = COLS * cellSize + (COLS - 1) * GAP + 2 * panPad;
        const spawnBtnDisplayW = Math.min(
            Math.floor((CONFIG.BUTTON.SPAWN_WIDTH + 30) * scale),
            panW - 10                                                // relational cap — kept
        );

        // VERTICAL anchors — each block's centre sits at a fixed fraction of
        // partA.height (designY × sH). The topmost item therefore lands at its
        // design Y on any aspect (no empty top band), and because scale ≤ sH the
        // scale-sized elements never overflow the proportional spacing (no overlap).
        const designButtonCY    = REF_H - btnBotRef;
        const designGridBotEdge = designButtonCY - spawnBtnLogHalfRef - btnGridRef;
        // PANEL_DROP is gone with the battery case it opened room for: the
        // column now starts at the coin in both orientations, so dropping the
        // panel would only reopen the gap the short column closes.
        const designPanelCY     = designGridBotEdge + panPadRef - designPanH / 2;
        let   buttonCenterY     = partA.y + designButtonCY * sH;
        let   panelCenterY      = partA.y + designPanelCY  * sH;

        // ── The car area's slot column ────────────────────────────────────────
        // Three slots stacked down the area's left edge, each with its rate
        // under it. One slot and its label get a third of the area's height
        // (BAND_FRAC of it); the square is capped at a grid cell, and only
        // shrinks on an area too short to give each slot a cell's worth.
        const CA        = CONFIG.CAR_AREA || {};
        const slotBandH = partB.height * (CA.BAND_FRAC !== undefined ? CA.BAND_FRAC : 0.9) / 3;
        const slotSize  = Math.max(8, Math.min(baseCell,
                                   slotBandH * (CA.SLOT_FRAC !== undefined ? CA.SLOT_FRAC : 0.62)));

        // Slot-derived sizes ride this: it equals `scale`, expressed against the
        // reference slot so slot-space numbers convert without a second factor.
        const platformScale = baseCell / P.SLOT_SIZE;

        // ── All content sizes that must scale with cellSize ───────────────────
        // Cell gap
        const cellGap           = Math.max(2, Math.round(CONFIG.CELL.GAP * scale));
        // THE COIN COUNTER HANGS OFF THE PANEL'S REAL TOP EDGE, a size-scaled
        // gap above it — not at a fraction of the half's height like the
        // blocks above. On a tall half sH outgrows scale, and a counter placed
        // by sH drifts up toward the screen's edge, away from the grid it
        // belongs to.
        const panHReal    = ROWS * cellSize + (ROWS - 1) * cellGap + 2 * panPad;
        // LANDSCAPE: THE COLUMN AS ONE BLOCK, CENTRED. Coin, panel and button
        // keep their design spacing (× scale) to each other, and whatever
        // height the half has left over goes equally above and below — not
        // into the gap between grid and button, where it read as a missing
        // piece. Portrait keeps the button anchored low, in thumb reach.
        if (!isP && LY.LANDSCAPE_CENTER !== false) {
            const aboveRef = coinHRef / 2 + coinGapRef;                         // coin top -> panel top
            const belowRef = spawnBtnLogHalfRef + btnGridRef - panPadRef;       // panel bottom -> button centre
            const blockH   = (aboveRef + belowRef + spawnBtnLogHalfRef) * scale + panHReal;
            const top      = partA.y + Math.max(0, (partA.height - blockH) / 2);
            panelCenterY   = top + aboveRef * scale + panHReal / 2;
            buttonCenterY  = panelCenterY + panHReal / 2 + belowRef * scale;
        }
        const coinCenterY = panelCenterY - panHReal / 2 - coinGapRef * scale;

        // Battery icon + level text inside grid cells (and platform slots).
        //
        // PORTRAIT DERIVES THEM FROM THE CELL; landscape keeps the authored
        // figures. On a phone the authored ones leave a battery half the width
        // of its cell and a label under 8px, because they were chosen against a
        // desktop cell with room to spare. Here the cell's own height is the
        // only input: pad it, give the label its share, and the battery takes
        // everything else.
        const MB = CONFIG.CELL.MOBILE || {};
        // FITTED TO THE BOX IT IS DRAWN IN. Pad it, give the label its share,
        // and the battery takes the rest — returned as offsets from the box's
        // CENTRE, which is what the drawing code works in.
        const fitBox = (box) => {
            // A SHARE of the box, floored at PAD_MIN. Fixed design pixels do
            // not survive the cell's own inset border — see CELL.MOBILE.
            const pad   = Math.max((MB.PAD_FRAC !== undefined ? MB.PAD_FRAC : 0.07) * box,
                                   (MB.PAD_MIN  !== undefined ? MB.PAD_MIN  : 6) * scale);
            const gap   = (MB.GAP !== undefined ? MB.GAP : 1) * scale;
            const inner = Math.max(8, box - 2 * pad);
            const textH = inner * (MB.TEXT_SHARE !== undefined ? MB.TEXT_SHARE : 0.24);
            const batt  = Math.max(4, inner - textH - gap);
            // BATTERY ON TOP, LABEL UNDER IT — stacked in that order inside
            // the padded box, so the number reads as a caption to the tool
            // rather than a tag floating over it.
            const top   = -inner / 2;
            const textC = top + batt + gap + textH / 2;
            // FITTED, NOT STRETCHED. The icon fills the width the padding
            // leaves and the height the label leaves, whichever runs out
            // first, at the art's OWN ratio — so square art is capped by the
            // height and wide art by the width, and neither is squashed to
            // reach the other edge.
            const asp   = Math.max(0.05, CONFIG.CELL.ICON_ASPECT || 1);
            const h     = Math.max(4, Math.min(inner / asp, batt));
            const w     = h * asp;
            // TOP EDGE ON THE PADDING LINE rather than centred in the space it
            // was given. Art that does not use the full height would otherwise
            // float, and a row of cells holding different levels would not line
            // their heads up.
            const battC = top + h / 2;
            return {
                w:    Math.round(w),
                h:    Math.round(h),
                yOff: Math.round(battC),
                // The label's offset is measured from the BATTERY, not the box:
                // the sprite is placed at yOff and the text at yOff + tOff.
                // Positive now, since the label sits below. textC comes off the
                // BOX, so the label holds its line whatever height the art
                // turns out to want.
                tOff: Math.round(textC - battC),
                text: Math.max(8, Math.round(textH /
                        (MB.LINE !== undefined ? MB.LINE : 1.28) *
                        (MB.TEXT_SCALE !== undefined ? MB.TEXT_SCALE : 1))) + 'px',
            };
        };
        // TWO BOXES, NOT ONE. A grid cell and a charging slot are the same size
        // in landscape, and in PORTRAIT they are not: the slot is squeezed by
        // the case and the rate label beside it, so it is capped at a cell and
        // is usually well under one. Sizing both from the cell overflowed the
        // slots — the battery ran clean past the bottom edge, which is what
        // looked like the padding not being applied at all.
        let batteryDisplayW, batteryDisplayH, batteryYOffset, levelTextYOffset, levelTextSize;
        let slotBatteryW, slotBatteryH, slotBatteryYOffset, slotLevelTextYOffset, slotLevelTextSize;
        // BOTH ORIENTATIONS DERIVE, unless CELL.FIT_TO_CELL is turned off — and
        // portrait derives even then, which is where this started.
        const fitCell = CONFIG.CELL.FIT_TO_CELL !== false || (isP && MB.ENABLED !== false);
        if (fitCell) {
            const cf = fitBox(cellSize), sf = fitBox(slotSize);
            batteryDisplayW = cf.w; batteryDisplayH = cf.h; batteryYOffset = cf.yOff;
            levelTextYOffset   = cf.tOff; levelTextSize  = cf.text;
            slotBatteryW    = sf.w; slotBatteryH = sf.h; slotBatteryYOffset = sf.yOff;
            slotLevelTextYOffset = sf.tOff; slotLevelTextSize  = sf.text;
        } else {
            const authored = Math.round(CONFIG.CELL.BATTERY_DISPLAY_SIZE * scale);
            batteryDisplayW = batteryDisplayH = authored;
            batteryYOffset     = Math.round(CONFIG.CELL.BATTERY_Y_OFFSET     * scale);
            levelTextYOffset   = Math.round(CONFIG.CELL.LEVEL_TEXT_Y_OFFSET  * scale);
            levelTextSize      = Math.max(8, Math.round(11 * scale)) + 'px';
            slotBatteryW = slotBatteryH = authored;
            slotBatteryYOffset   = batteryYOffset;
            slotLevelTextYOffset = levelTextYOffset;
            slotLevelTextSize    = levelTextSize;
        }

        // Spawn button interior (coin value text, coin icon, battery icon)
        const spawnCoinTextSize  = Math.max(14, Math.round(32 * scale)) + 'px';
        const spawnCoinTextX     = Math.round(CONFIG.BUTTON.COIN_TEXT_X          * scale);
        const spawnCoinIconX     = Math.round(CONFIG.BUTTON.COIN_ICON_X           * scale);
        const spawnCoinIconSize  = Math.round(CONFIG.BUTTON.COIN_ICON_WIDTH       * scale);
        const spawnBattIconX     = Math.round(CONFIG.BUTTON.BATTERY_ICON_X        * scale);
        const spawnBattIconSize  = Math.round(CONFIG.BUTTON.BATTERY_ICON_WIDTH    * scale);

        // Coin counter display (above grid panel)
        const coinIconSize       = Math.round(CONFIG.COIN_COUNTER.COIN_ICON_WIDTH * scale);
        const coinTextSize       = Math.max(12, Math.round(29 * 1.3 * scale)) + 'px';   // 40% down from 48, then 30% back up
        const coinTextIconGap    = Math.max(3,  Math.round(5 * scale));

        // Drawing geometry — cell and slot borders/radii
        const cellInset         = Math.max(1, Math.floor(CONFIG.CELL.INSET_BORDER_WIDTH * scale));
        const cellRadius        = Math.round(CONFIG.CELL.RADIUS * scale);

        // VFX sizes
        const mergeEffectRadius = Math.round(50 * scale);
        const rewardCoinSize    = Math.round(CONFIG.COIN_REWARD_ANIMATION.REWARD_COIN_SIZE * scale);

        this.layoutConfig = {
            screenWidth: W, screenHeight: H, isPortrait: isP,
            cellSize, cellGap,
            panPad, spawnBtnDisplayH, spawnBtnDisplayW, spawnBtnLogicalHalf: spawnBtnLogHalf,
            partA, partB,
            platformScale,
            sW, sH, scale: baseScale, colScale: scale,
            panelCenterY, buttonCenterY, coinCenterY, slotSize, slotBandH,
            // Battery / cell content
            batteryDisplayW, batteryDisplayH, batteryYOffset, levelTextYOffset, levelTextSize,
            slotBatteryW, slotBatteryH, slotBatteryYOffset, slotLevelTextYOffset, slotLevelTextSize,
            // Spawn button contents
            spawnCoinTextSize, spawnCoinTextX, spawnCoinIconX, spawnCoinIconSize,
            spawnBattIconX, spawnBattIconSize,
            // Coin counter
            coinIconSize, coinTextSize, coinTextIconGap,
            // Drawing geometry
            cellInset, cellRadius,
            // VFX
            mergeEffectRadius, rewardCoinSize,
            // Legacy compat fields
            gridLeft:         partA.x,
            gridWidth:        partA.width,
            gridCenterX:      partA.x + partA.width / 2,
            gridTop:          partA.y,
            gridHeight:       partA.height,
            platformsLeft:    partB.x,
            platformsWidth:   partB.width,
            platformsCenterX: partB.x + partB.width / 2,
            platformsTop:     partB.y,
            platformsHeight:  partB.height,
        };
    }

    // ================================================================
    // RELAYOUT — the screen turned
    // ================================================================
    // THE GAME RE-LAYS ITSELF OUT IN PLACE when the screen turns between
    // portrait and landscape. Nothing restarts: the run — coins, pigs, the
    // level, how far each plant has been picked — is the same objects before
    // and after. The stage takes the new shape, and everything is placed on it
    // again.
    //
    // ONLY ON A TURN, not on every resize. Within one orientation the stage
    // keeps its size and the browser simply scales it (see pickStage), so a
    // desktop window being dragged about is still a non-event.
    //
    // AT REST, NEVER MID-ANIMATION. A bank bursting, fruit in the air, coins
    // on their way to the counter all carry the game forward in their
    // callbacks — the payout, the level turn — and are aimed at places on the
    // old layout. So a turn only ASKS for a relayout: the distance tick holds,
    // whatever is in flight lands, and the relayout runs on the first frame
    // where nothing is moving (see _isSettled).
    //
    // FAST-FORWARDED TO THAT POINT. Played out at normal speed the wait is a
    // second or two of the old layout squeezed onto the turned screen, so
    // tweens and timers run STAGE.RELAYOUT_FAST_FORWARD times faster until it
    // comes — a few frames. Nothing is skipped: every payout and level turn
    // still happens, only sooner, while the player is looking at a layout
    // that is about to be replaced anyway.
    // WATCHED EVERY FRAME, not on resize events. A phone reports its new
    // width and height some time after it says it has turned — later than any
    // fixed wait can be relied on — so a check fired off the event could read
    // the OLD shape, decide nothing had changed, and never be asked again.
    // Reading the window each frame cannot miss it. The new shape has to hold
    // for STAGE.RELAYOUT_DEBOUNCE_MS first, so a size passed through on the
    // way round is not mistaken for the one it arrived at.
    _pollOrientation() {
        const S = CONFIG.STAGE || {};
        const w = window.innerWidth, h = window.innerHeight;
        if (!w || !h) return;
        const now = performance.now();
        // WHAT THIS FRAME WOULD GET, and whether it differs enough from what
        // the game has: a TURN (portrait <-> landscape), or a RESHAPE — the
        // same orientation, but a stage height more than RESHAPE_TOLERANCE
        // away (a tall phone after a squat tablet, the fullscreen button on a
        // 16:10 screen, iPad split view). Small changes — a phone's toolbar
        // sliding — stay under the tolerance and are left to FIT's scaling.
        const want = pickStage();
        const turn = want.portrait !== this.isPortrait;
        const tol = S.RESHAPE_TOLERANCE !== undefined ? S.RESHAPE_TOLERANCE : 0.05;
        const reshape = !turn && tol >= 0
            && Math.abs(want.height - this.scale.height) / this.scale.height > tol;
        if (!turn && !reshape) {
            // Matches — including changed back before a relayout ran.
            this._turnSeenAt = 0;
            this._seenW = this._seenH = 0;
            this._relayoutPending = false;
            return;
        }
        // THE SIZE HAS TO STAND STILL first: every new size restarts the wait,
        // so a window being dragged relayouts once, when it is let go.
        if (w !== this._seenW || h !== this._seenH) {
            this._seenW = w; this._seenH = h;
            this._turnSeenAt = now;
            orientLog(`${turn ? 'turn' : 'reshape'} seen: frame ${w} x ${h} wants ` +
                `${want.portrait ? 'PORTRAIT' : 'LANDSCAPE'} ${want.width} x ${want.height}, ` +
                `game is ${this.isPortrait ? 'PORTRAIT' : 'LANDSCAPE'} ${this.scale.width} x ${this.scale.height}`);
            return;
        }
        const wait = turn
            ? (S.RELAYOUT_DEBOUNCE_MS !== undefined ? S.RELAYOUT_DEBOUNCE_MS : 100)
            : (S.RESHAPE_DEBOUNCE_MS  !== undefined ? S.RESHAPE_DEBOUNCE_MS  : 250);
        if (!this._relayoutPending && now - this._turnSeenAt >= wait) {
            this._relayoutPending = true;
            orientLog('relayout pending — runs once the field is settled');
        }
    }

    // NOTHING IN FLIGHT that the game is waiting on. Looping tweens — the
    // tutorial pointers, the slot hints, the level-up button's pulse — never
    // end, and are simply rebuilt on the new layout, so they do not count.
    _isSettled() {
        return !this._unsettledBy();
    }
    // What is holding the field unsettled, or null — named for [orient].
    _unsettledBy() {
        if (this.draggingBattery) return 'a pig is being dragged';
        if (this.isWatchingAd)    return 'an ad is playing';
        if (this._levelTurning)   return 'a level turn';
        if (this._briefing)       return 'the wanted cards';
        if ((this._coinFlights || 0) > 0) return 'coins in flight';
        const t = this.tweens.getTweens().filter((tw) => !tw.isInfinite).length;
        return t ? `${t} tween(s) running` : null;
    }

    // Time sped up while a relayout waits, and put back after. The charge tick
    // is held meanwhile (see chargeCycle), so running its clock fast costs
    // nothing; the level-up timer reads the real clock, not this one.
    _fastForward(on) {
        const S = CONFIG.STAGE || {};
        const k = on ? Math.max(1, S.RELAYOUT_FAST_FORWARD !== undefined ? S.RELAYOUT_FAST_FORWARD : 25) : 1;
        if (this.tweens.timeScale !== k) this.tweens.timeScale = k;
        if (this.time.timeScale   !== k) this.time.timeScale   = k;
    }

    _relayout() {
        this._relayoutPending = false;
        this._orientWaitWhy = undefined;
        const st = pickStage();
        orientLog(`relayout: frame ${window.innerWidth} x ${window.innerHeight} -> ` +
            `${st.portrait ? 'PORTRAIT' : 'LANDSCAPE'} stage ${st.width} x ${st.height}`);
        this.scale.setGameSize(st.width, st.height);
        this.cameras.main.setSize(st.width, st.height);

        // WHAT THE FURNITURE WAS SHOWING — the only state it holds, carried
        // across. Everything else lives in records that are kept as they are.
        const lvlUp = { visible: this.levelUpButtonVisible, showTime: this.levelUpButtonShowTime,
                        alpha: this.levelUpButtonBg ? this.levelUpButtonBg.alpha : 1 };
        const hadOverlay   = !!this.startOverlay;
        const hadMergeHint = !!this.mergePointer;
        const hadSlotHints = !!this.slotHints;

        // ── The old layout's furniture comes down ────────────────────────────
        const gone = (o) => { if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); } };
        gone(this.gridPanel);
        for (const row of this.gridCells) for (const cd of row || []) { gone(cd.cell); gone(cd.filledBg); }
        for (const p of this.platforms) { gone(p.slotBg); gone(p.slotBgFilled); gone(p.chargeRateText); }
        for (const car of this.cars) gone(car);
        this.cars = [];
        for (const o of [...this.villains, ...this.laneLabels]) gone(o);
        this.villains = []; this.laneLabels = [];
        gone(this.gapLines);
        this.gapLines = null;
        gone(this.roadGfx);
        this.roadGfx = null;
        this.roadGapAt = [null, null, null];   // re-measured off the new villains
        gone(this.coinIcon);
        gone(this.coinText);
        gone(this.spawnButton);
        gone(this.levelUpButton);
        gone(this.splitLine);
        gone(this.startOverlay);
        gone(this.startPointer);
        this.startOverlay = this.startPointer = null;
        gone(this.mergePointer);
        this.mergePointer = null;
        for (const lot of this.slotHints || []) for (const o of lot || []) gone(o);
        this.slotHints = null;

        // ── …and goes back up on the new one ────────────────────────────────
        this.calculateLayout();
        this._applyLayoutFields();
        this._drawBackground();

        // The car area: the slot column down its left edge, a car beside each.
        this.createSlots();
        this._buildCars();
        if (!this.lanes) this.lanes = this._levelLanes(this.level);
        this._buildVillains(false);

        // The merge half.
        this.createGrid();
        for (let r = 0; r < this.GRID_ROWS; r++) {
            for (let c = 0; c < this.GRID_COLS; c++) {
                const cd = this.gridCells[r][c], on = !!this.grid[r][c];
                cd.filledBg.setVisible(on);
                cd.isEmpty = !on;
            }
        }
        for (const bd of this.batteries) this._placeBattery(bd);
        this.platforms.forEach((p, i) => {
            const slot = this.chargingSlots[i];
            p.slotBgFilled.setVisible(!!slot);
            if (!slot) return;
            p.chargeRateText.setText(this._rateText(slot.distPerSec)).setVisible(true);
            this._placeBattery(slot.batteryData);
            p.batterySprite    = slot.batteryData.sprite;
            p.batteryLevelText = slot.batteryData.levelText;
        });

        this.createCoinDisplay();
        this.createButtons();
        this.updateSpawnButton();
        this.levelUpButtonShowTime = lvlUp.showTime;
        this.levelUpButtonBg.setAlpha(lvlUp.alpha);
        if (lvlUp.visible) {
            this.levelUpButton.setVisible(true);
            this.levelUpButtonVisible = true;
            this.tweens.add({
                targets: this.levelUpButton,
                scaleX: 1.05, scaleY: 1.05, duration: 300,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }

        this._buildSplitLine();
        if (hadOverlay)   this.createStartOverlay();
        if (hadMergeHint) this.createMergeTutorial();
        if (hadSlotHints) this._showSlotHint();

        // Turned again while this ran? _pollOrientation picks it up next frame.
        this._turnSeenAt = 0;
    }

    // ── SAVING ───────────────────────────────────────────────────────────────
    // CONFIG.SAVE. So a refresh by mistake does not cost a player their run:
    // the run is written to localStorage every EVERY_MS and whenever the page
    // is hidden or closed (a reload is a close), and read back at boot.
    //
    // ONLY SETTLED FIGURES — levels, coins, the distance driven — never
    // anything mid-animation. Coins still flying to the counter are not in the
    // figure yet; losing a handful of those to a refresh is the trade.
    _collectSave() {
        const lvlOf = (row) => row.map((b) => (b ? b.level : 0));
        return {
            v: SAVE_VERSION,
            t: Date.now(),
            coins: this.coins,
            distance: this.distance,
            // A LEVEL TURN IN PROGRESS SAVES AS THE NEXT LEVEL, fresh.
            level: this._levelTurning ? this.level + 1 : this.level,
            lanes: this._levelTurning || !this.lanes ? null
                : this.lanes.map((l) => ({ left: l.left, caught: !!l.caught })),
            grid: this.grid.map(lvlOf),
            slots: this.chargingSlots.map((sl) => (sl ? sl.level : 0)),
            highest: this.highestBatteryLevel,
            spawnLevel: this.spawnButtonLevel,
            spawnCost: this.spawnCost,
            started: !!this.hasStartedPlaying,
            mergeTut: !!this.mergeTutorialShown,
            slotSeen: this.slotHintSeen.slice(),
        };
    }

    _writeSave() {
        const S = CONFIG.SAVE || {};
        if (S.ENABLED === false || !this._saveReady) return;
        try { localStorage.setItem(saveKey(), JSON.stringify(this._collectSave())); }
        catch (e) { /* incognito / storage full / blocked — play on unsaved */ }
    }

    // Every EVERY_MS on the scene's clock (so not during an ad's freeze), and
    // on the page being hidden or closed — the one that catches a reload.
    _startAutosave() {
        const S = CONFIG.SAVE || {};
        if (S.ENABLED === false) return;
        this._saveReady = true;
        this.time.addEvent({ delay: S.EVERY_MS !== undefined ? S.EVERY_MS : 2000,
            loop: true, callback: () => this._writeSave() });
        if (!this._saveHooked && typeof window !== 'undefined') {
            this._saveHooked = true;
            const now = () => this._writeSave();
            window.addEventListener('pagehide', now);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') now();
            });
        }
    }

    // THE FIGURES FROM A SAVE, before anything is built from them.
    _applySave(sv) {
        this.coins = sv.coins;
        this.distance = sv.distance;
        this.level = sv.level;
        // No further from a villain than the level's table says — a save from
        // before a table change could say otherwise.
        if (sv.lanes) {
            this.lanes = this._levelLanes(this.level).map((l, i) => {
                const k = sv.lanes[i];
                return Object.assign(l, { left: Math.min(k.left, l.total), caught: k.caught });
            });
        }
        this.highestBatteryLevel = sv.highest;
        this.spawnButtonLevel = sv.spawnLevel;
        this.spawnCost = sv.spawnCost;
        this.mergeTutorialShown = sv.mergeTut;
        this.slotHintSeen = sv.slotSeen;
        this.slotHintDone = this.slotHintSeen.every(Boolean);
    }

    // THE PIGS FROM A SAVE, back in their cells and slots.
    _restorePigs(sv) {
        for (let r = 0; r < this.GRID_ROWS; r++) {
            for (let c = 0; c < this.GRID_COLS; c++) {
                const lv = sv.grid[r] && sv.grid[r][c];
                if (lv > 0) this.spawnBatteryInGrid(r, c, lv, false);
            }
        }
        sv.slots.forEach((lv, i) => { if (lv > 0) this.addBatteryToSlot(i, lv); });
    }

    // A pig moved to where its cell or slot now is, at the new size. The same
    // sprite, label and drag handle — only their geometry changes.
    _placeBattery(bd) {
        if (!bd || !bd.sprite) return;
        const inSlot = bd.inChargingSlot;
        const p   = inSlot ? this.platforms[bd.slotIndex] : null;
        const cd  = inSlot ? null : this.gridCells[bd.row][bd.col];
        const x   = inSlot ? p.slotX : cd.x;
        const y   = inSlot ? p.slotY : cd.y;
        const box = inSlot ? p.slotSize : this.CELL_SIZE;
        const yOff = inSlot ? this.slotBatteryYOffset : this.batteryYOffset;
        const tOff = inSlot ? this.slotLevelTextYOffset : this.levelTextYOffset;
        for (const o of [bd.sprite, bd.levelText, bd.draggableBg]) if (o) this.tweens.killTweensOf(o);

        bd.originalX = x;
        bd.originalY = y + yOff;
        bd.sprite.setPosition(x, bd.originalY).setDepth(11);
        fitItemIcon(bd.sprite, inSlot ? this.slotBatteryW : this.batteryDisplayW,
                               inSlot ? this.slotBatteryH : this.batteryDisplayH);
        bd.levelText.setFontSize(inSlot ? this.slotLevelTextSize : this.levelTextSize)
            .setScale(1).setPosition(x, bd.originalY + tOff).setDepth(12).setVisible(true);
        if (bd.draggableBg) {
            bd.draggableBg.setPosition(x, y).setSize(box, box).setDepth(10);
            if (bd.draggableBg.input) bd.draggableBg.input.hitArea.setSize(box, box);
        }
    }

    // ================================================================
    // PRELOAD
    // ================================================================
    preload() {
        loadMark('Phaser booted — preload starting');
        this._save = readSave();
        // REAL FIGURES FROM HERE. The page's creep stops where it is and this
        // loader's progress carries on from there.
        if (typeof window !== 'undefined' && window.__loading) {
            window.__loading.takeOver();
            loadingShown = window.__loading.value();
        }
        // The loading bar. This preload runs it up to LOAD_PRELOAD_CAP. The
        // opening view's remaining levels come in later batches, each of which
        // restarts the loader's own 0-1 — so each takes a share of what is left
        // instead, and the bar only ever moves forward.
        // Whatever the creep reached is the floor: the first batch runs from
        // there to LOAD_PRELOAD_CAP, so the hand-over is a jump forward or
        // nothing at all, never a drop.
        let barFrom = Math.max(LOAD_BOOT_SHARE, loadingShown), barTo = LOAD_PRELOAD_CAP, batch = 0;
        this.load.on('start', () => {
            if (batch++ === 0) return;
            barFrom = loadingShown;
            barTo   = loadingShown + (0.97 - loadingShown) * 0.6;
        });
        this.load.on('progress', (v) => setLoadingProgress(barFrom + (barTo - barFrom) * v));
        this.load.on('complete', () => {
            if (!loadingScreenDone) loadMark(batch <= 1 ? 'preload files downloaded' : 'more level art downloaded');
        });
        // Level maps and art that are queued, and those that failed. A file that
        // fails is not retried forever: it is written off, and the level builds
        // without it — the same as a missing file always did.
        this._artFailed = new Set();
        this._artQueued = new Set();
        this.load.on('loaderror', (file) => { if (file && file.key) this._artFailed.add(file.key); });

        // SHARED ART — the merge grid, the machine, the lake, the UI. The list
        // lives in assets.js, which the build also reads to write the page's
        // preload hints, so what is loaded here and what is hinted cannot drift.
        for (const a of sharedAssets()) {
            if (a.type === 'json')  this.load.json(a.key, a.url);
            else if (a.frame)       this.load.spritesheet(a.key, a.url, a.frame);
            else                    this.load.image(a.key, a.url);
        }

        // A file that 404s leaves the cache entry simply absent, and whatever
        // wanted it draws nothing — which looks exactly like art that loaded and
        // was blank. Say so instead.
        this.load.on('loaderror', (file) => {
            console.error(`[load] FAILED "${file.key}" <- ${file.url} ` +
                `(${file.type}). Check the path is relative to index.html and ` +
                `that the file is actually served.`);
        });
    }

    // ================================================================
    // CREATE
    // ================================================================
    create() {
        loadMark('create: building the view');
        // The backstop for a download that never ends. The opening view has no
        // lazily-loaded art left in it, so the end of create() lifts the screen.
        setTimeout(finishLoadingScreen, (CONFIG.LAZY_LEVELS || {}).SCREEN_TIMEOUT_MS || 20000);

        if (CONFIG.DEBUG_LAYOUT) {
            const c = this.game.canvas;
            const dpr = window.devicePixelRatio || 1;
            console.log(
              `[buffer] backingStore=${c.width}x${c.height} ` +          // actual render pixels (drawing buffer)
              `cssDisplay=${c.clientWidth}x${c.clientHeight} ` +          // size shown on page (CSS px)
              `DPR=${dpr} ` +
              `physicalScreen=${Math.round(c.clientWidth*dpr)}x${Math.round(c.clientHeight*dpr)}`  // what the screen really has
            );
        }

        this.assets = new AssetManager(this);
        // The starting pig's two pictures came in with the preload; put them
        // together now, before anything is drawn wearing them.
        this.assets.composeBattery(getBatteryIconLevel(CONFIG.BATTERY_START_LEVEL));
        const W = this.scale.width;
        const H = this.scale.height;

        // Calculate layout based on orientation
        this.calculateLayout();
        this._applyLayoutFields();
        const L = this.layoutConfig;
        // One-time responsive-layout sanity log
        const _cx   = L.partA.x + L.partA.width / 2;
        const _panW = this.GRID_COLS * L.cellSize + (this.GRID_COLS - 1) * L.cellGap + 2 * L.panPad;
        const _panH = this.GRID_ROWS * L.cellSize + (this.GRID_ROWS - 1) * L.cellGap + 2 * L.panPad;
        if (CONFIG.DEBUG_LAYOUT) console.log(`[layout] partA=${Math.round(L.partA.width)}x${Math.round(L.partA.height)} ` +
            `sW=${L.sW.toFixed(3)} sH=${L.sH.toFixed(3)} scale=${L.scale.toFixed(3)} cellSize=${L.cellSize.toFixed(1)} ` +
            `panel=${_panW.toFixed(0)}x${_panH.toFixed(0)} | ` +
            `coin=(${_cx.toFixed(0)},${L.coinCenterY.toFixed(0)}) ` +
            `grid=(${_cx.toFixed(0)},${L.panelCenterY.toFixed(0)}) ` +
            `button=(${_cx.toFixed(0)},${L.buttonCenterY.toFixed(0)})`);

        // Background
        this._drawBackground();

        // The car area: the slot column down its left edge, a car beside each.
        const save = this._save;
        if (save) this._applySave(save);
        this.createSlots();
        this._buildCars();
        if (!this.lanes) this.lanes = this._levelLanes(this.level);
        this._buildVillains(false);

        // The merge half
        this.createGrid();
        this.createCoinDisplay();
        if (save) this._restorePigs(save);
        else this.spawnBatteryInGrid(0, 0, CONFIG.BATTERY_START_LEVEL);
        this.assets.prefetchAhead(this.highestBatteryLevel + 1);
        this.createButtons();
        if (save) this.updateSpawnButton();
        this.time.addEvent({
            delay: 1000, callback: this.checkLevelUpTimer, callbackScope: this, loop: true,
        });
        // A RETURNING PLAYER skips the start tutorial — what removeStartOverlay
        // would have set, set directly.
        if (save && save.started) {
            this.hasStartedPlaying = true;
            this.levelUpTimer = this.time.now;
            this.firstLevelUpTimer = true;
        } else {
            this.createStartOverlay();
        }
        // THE LEVEL'S WANTED CARDS — now, or once the start tutorial is
        // dismissed (removeStartOverlay). None for a level already under way.
        if (!this.startOverlay) this._showWanted();
        this._startAutosave();

        // Input
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag',      this.onDrag,      this);
        this.input.on('dragend',   this.onDragEnd,   this);

        this.startCharging();
        this._startBatteryBackfill();

        // Debug: a line marking the partA / partB split — vertical in landscape
        // (left | right), horizontal in portrait (top / bottom).
        if (CONFIG.DEBUG_HALF_LINE) {
            const W = this.scale.width, H = this.scale.height;
            const dl = this.add.graphics().setDepth(99999);
            dl.lineStyle(Math.max(1, 2 * L.platformScale), 0xff00ff, 0.9);
            if (L.isPortrait) {
                const y = L.partB.y + L.partB.height;   // split between top/bottom halves
                dl.lineBetween(0, y, W, y);
            } else {
                const x = L.partB.x;                     // split between left/right halves
                dl.lineBetween(x, 0, x, H);
            }
        }

        this.gamePaused = false;   // frozen only while an ad plays (_setPaused)
        this._buildSplitLine();

        // POKI: gameplayStart ON THE PLAYER'S FIRST INPUT — the first tap or
        // click anywhere, which is also what dismisses the start tutorial.
        this.input.once('pointerdown', () => {
            pokiFirstInput = true;
            if (!this.gamePaused && !this.isWatchingAd) pokiGameplay(true);
        });

        // Everything the opening view needs is up.
        finishLoadingScreen();
    }

    // The layout's figures, copied onto the scene where the rest of the code
    // reads them. Run after every calculateLayout — at build and on a relayout.
    _applyLayoutFields() {
        const L = this.layoutConfig;
        this.CELL_SIZE          = L.cellSize;
        this.CELL_GAP           = L.cellGap;
        this.batteryDisplayW    = L.batteryDisplayW;
        this.batteryDisplayH    = L.batteryDisplayH;
        this.slotBatteryW         = L.slotBatteryW;
        this.slotBatteryH         = L.slotBatteryH;
        this.slotBatteryYOffset   = L.slotBatteryYOffset;
        this.slotLevelTextYOffset = L.slotLevelTextYOffset;
        this.slotLevelTextSize    = L.slotLevelTextSize;
        this.batteryYOffset     = L.batteryYOffset;
        this.levelTextYOffset   = L.levelTextYOffset;
        this.levelTextSize      = L.levelTextSize;
        // Drawing geometry
        this.CELL_RADIUS        = L.cellRadius;
        this.cellInset          = L.cellInset;
        this.platformScale      = L.platformScale;
        // VFX
        this.mergeEffectRadius  = L.mergeEffectRadius;
        this.rewardCoinSize     = L.rewardCoinSize;
    }

    // THE UI HALF'S CARD. Redrawn in place on a relayout — same object, cleared.
    _drawBackground() {
        const bgGfx = this.bgGfx = (this.bgGfx && this.bgGfx.scene) ? this.bgGfx.clear() : this.add.graphics();
        const sc = parseInt(CONFIG.BACKGROUND.GRADIENT_START_COLOR.substring(1), 16);
        const ec = parseInt(CONFIG.BACKGROUND.GRADIENT_END_COLOR.substring(1), 16);
        // A TINT OVER THE GROUND, not the panel itself. At 0 nothing is drawn at
        // all and the field's own colour is what the panel is made of.
        const bgA = CONFIG.BACKGROUND.OPACITY !== undefined ? CONFIG.BACKGROUND.OPACITY : 1;
        bgGfx.fillGradientStyle(sc, sc, ec, ec, bgA);
        // THE UI HALF'S OWN CARD, rounded on all four of ITS corners — the two
        // against the screen edge and the two against the car area.
        //
        // Drawn to partA rather than across the stage, because a full-screen
        // fill would sit UNDER the rounded shape and show through its corners,
        // which is the one thing rounding them is for. The car area needs no
        // fill: its camera covers that ground edge to edge.
        const A = this.layoutConfig.partA;
        const bgR = Math.round((CONFIG.BACKGROUND.CORNER_RADIUS || 0) * this.layoutConfig.scale);
        if (bgA > 0) {
            if (bgR > 0) bgGfx.fillRoundedRect(A.x, A.y, A.width, A.height, bgR);
            else         bgGfx.fillRect(A.x, A.y, A.width, A.height);
        }
        bgGfx.setDepth(0);
    }

    // ================================================================
    // THE SLOTS — a column down the car area's left edge
    // ================================================================
    // Three places to put a pig, stacked top to bottom, each with the distance
    // it covers per second written under it. Drawn with the same grained face
    // as a grid cell, so a slot and a cell read as the same kind of object.
    // Everything right of the column is left empty for the car (this.carArea).
    //
    // ON A RELAYOUT the slot records are kept — they are what the charging
    // slots and their pigs are paired through — and only their geometry and
    // furniture are swapped for the new ones.
    createSlots() {
        const P     = CONFIG.PLATFORM;
        const CA    = CONFIG.CAR_AREA || {};
        const v     = (x, d) => (x !== undefined ? x : d);
        const L     = this.layoutConfig;
        const scale = L.platformScale;
        const s     = (n) => n * scale;
        const B     = L.partB;
        const ssz   = L.slotSize;

        const SR = P.SLOT_RATE || {};
        const style = {
            fontSize: Math.max(12, Math.round(22 * scale)) + 'px',
            fontFamily: CONFIG.FONT_FAMILY, fontStyle: CONFIG.FONT_WEIGHT,
            color: SR.COLOR || '#ffffff', stroke: SR.STROKE || '#3a2a00',
            strokeThickness: Math.round(v(SR.STROKE_W, 3) * scale),
        };
        // The label's REAL height, so a slot and its label are centred in their
        // band as one block rather than the slot alone.
        const probe  = this.add.text(0, 0, '0', style);
        const labelH = probe.height + s(P.CHARGE_RATE_GAP);
        probe.destroy();

        // One band per slot, the three filling BAND_FRAC of the area's height
        // and centred in it.
        const slotX = B.x + s(v(CA.SLOT_COLUMN_PAD, 28)) + ssz / 2;
        const bandH = L.slotBandH;
        const top   = B.y + (B.height - 3 * bandH) / 2;

        // WHAT IS LEFT FOR THE CAR: everything right of the column.
        const carX = slotX + ssz / 2 + s(v(CA.SLOT_COLUMN_GAP, 28));
        this.carArea = { x: carX, y: B.y, width: Math.max(0, B.x + B.width - carX), height: B.height };

        // The face texture the filled state uses, baked at the GRID's cell size
        // and scaled down here — one texture for both.
        this._makeCellTextures(L.cellSize);

        for (let i = 0; i < 3; i++) {
            // The label ABOVE the square (CHARGE_RATE_ABOVE, in line with the
            // gap lines over the cars) or under it; the square shifts the
            // other way so the two stay centred in the band as one block.
            const above = P.CHARGE_RATE_ABOVE !== false;
            const slotY = top + bandH * (i + 0.5) + (above ? labelH / 2 : -labelH / 2);

            // The empty square, stroke and all, stays up the whole time; filling
            // the slot lays the grid's grained face over its INSIDE only, sized
            // to the stroke's inner edge, so the stroke never goes away.
            const slotBg = this.add.graphics();
            this._drawSlot(slotBg, slotX, slotY, ssz, false);
            slotBg.setDepth(3);
            const strokeW = Math.max(1, Math.round(CONFIG.CELL.INSET_BORDER_WIDTH * ssz / P.SLOT_SIZE));
            const face = Math.round(ssz - 2 * strokeW);
            const slotBgFilled = this.add.image(slotX, slotY, 'cell_face')
                .setDisplaySize(face, face).setDepth(3).setVisible(false);

            // The distance this slot's pig covers per second, over (or under) the square.
            const rateY = above ? slotY - ssz / 2 - s(P.CHARGE_RATE_GAP) : slotY + ssz / 2 + s(P.CHARGE_RATE_GAP);
            const chargeRateText = this.add.text(slotX, rateY, '', style)
                .setOrigin(0.5, above ? 1 : 0).setDepth(5).setVisible(false);

            const slot = { index: i, slotX, slotY, slotSize: ssz, slotBg, slotBgFilled, chargeRateText };
            if (this.platforms[i]) Object.assign(this.platforms[i], slot);
            else this.platforms.push(Object.assign(slot, { batterySprite: null, batteryLevelText: null }));
        }
    }

    // ================================================================
    // THE CARS
    // ================================================================
    // One per slot, standing on the line through that slot's bottom edge — the
    // road, which is not drawn. Sized to the car area's width, capped by the
    // slot's height, and parked close beside its slot (see CONFIG.CAR).
    //
    // WHAT IS LEFT FOR THE VILLAINS: everything right of the cars' front ends,
    // kept as this.villainArea.
    _buildCars() {
        const C = CONFIG.CAR || {};
        const A = this.carArea;
        this.villainArea = A;
        if (!A || !A.width) return;
        const v = (x, d) => (x !== undefined ? x : d);
        const bodyW = v(C.BODY_W, 254);
        const carH  = this._carGround();   // ground to roof, art px
        const left  = A.x + v(C.LEFT_GAP, 0) * this.layoutConfig.platformScale;
        let right = left;
        this.cars = this.platforms.map((p) => {
            // FULL SIZE first — what the villains are measured against and
            // where their space starts — then the car itself at SCALE of it.
            const full = Math.min(A.width * v(C.WIDTH_FRAC, 0.45) / bodyW * carH,
                                  p.slotSize * v(C.MAX_H_FRAC, 1));
            right = Math.max(right, left + full / carH * bodyW);
            const h = full * v(C.SCALE, 1);
            const w = h / carH * bodyW;
            const car = this._makeCar(left + w / 2, p.slotY + p.slotSize / 2, h);
            car.fullH = full;
            return car;
        });
        this.villainArea = { x: right, y: A.y, width: Math.max(0, A.x + A.width - right), height: A.height };
    }

    // Where the tyres meet the ground, in the body's own pixels: the lowest
    // tyre bottom. The car's height, ground to roof, is the same figure.
    // `spec` is the car's art and layout — CONFIG.CAR (the piggy car) unless
    // given, or a getaway car's from VILLAIN.CAR.CARS.
    _carGround(spec) {
        const C = spec || CONFIG.CAR || {};
        const t = C.TYRE_SIZE !== undefined ? C.TYRE_SIZE : 53;
        return Math.max(C.BODY_H || 107, ...(C.TYRES || []).map((w) => w.y + t));
    }

    // A CAR: the body and its tyres in one container, laid out in the body's
    // own pixels and scaled as one. The container's origin is the point under
    // the car's middle where the tyres touch the ground — so (x, groundY) puts
    // the car standing on that line, `height` tall from ground to roof.
    // Returns the container; its `tyres` are there to spin. `spec` (see
    // _carGround) picks other art: its bodyKey / tyreKey textures and its
    // BODY_W / BODY_H / TYRE_SIZE / TYRES layout.
    _makeCar(x, groundY, height, spec) {
        const C  = spec || CONFIG.CAR || {};
        const bw = C.BODY_W !== undefined ? C.BODY_W : 254;
        const t  = C.TYRE_SIZE !== undefined ? C.TYRE_SIZE : 53;
        const gy = this._carGround(C);
        const ox = -bw / 2, oy = -gy;   // the body's top-left, from the ground point
        // ABOUT ITS CENTRE, so the suspension can tilt it in place.
        const bh = C.BODY_H || 107;
        const body = this.add.image(ox + bw / 2, oy + bh / 2, C.bodyKey || 'car_body').setDisplaySize(bw, bh);
        const tyres = (C.TYRES || []).map((w) =>
            this.add.image(ox + w.x + t / 2, oy + w.y + t / 2, C.tyreKey || 'car_tyre').setDisplaySize(t, t));
        const car = this.add.container(x, groundY,
            C.TYRES_IN_FRONT === false ? [...tyres, body] : [body, ...tyres]);
        car.setScale(height / gy).setDepth(CONFIG.CAR.DEPTH !== undefined ? CONFIG.CAR.DEPTH : 4);
        car.tyres = tyres;
        car.bodyImg = body;
        // THE SUSPENSION (see _suspend). Resting y's inside the car, and where
        // the rear and front tyres sit across it from the body's centre, in
        // the car's own pixels.
        car.bodyBaseY = body.y;
        car.tyreBaseY = tyres.map((ty) => ty.y);
        car.tyreDX = tyres.map((ty) => ty.x);
        // Each end of the body: its height above rest and how fast it is
        // moving (px, up is +). `k` is the last speed share, for the squat.
        car.susp = { ends: tyres.map(() => ({ e: 0, v: 0 })), k: 0 };
        car.carH = height;     // ground to roof, px
        car.carW = bw * height / gy;
        car.homeX = car.endX = car.targetX = x;   // see _placeCar
        car.driveV = 0;        // px per second while rolling to targetX
        car.wheelAngle = 0;    // degrees, shared by both tyres
        car.wheelSpeed = 0;    // degrees per second, eased toward its target
        return car;
    }

    // THE TYRES TURN UNDER A DRIVER. Each car's tyres spin while its slot has
    // a piggy in it — speeding up when one goes in, coasting to a stop when it
    // comes out — both at the same angle, as one car. Run every frame.
    _spinWheels(delta) {
        const C    = CONFIG.CAR || {};
        const top  = C.SPIN_DEG_PER_SEC !== undefined ? C.SPIN_DEG_PER_SEC : 540;
        const ease = Math.min(1, (C.SPIN_EASE !== undefined ? C.SPIN_EASE : 4) * delta / 1000);
        // The getaway cars too: they flee exactly as fast as they are chased.
        const all = [...this.cars.map((c, i) => [c, i]),
                     ...this.villains.map((en, i) => [en && en.isCar ? en : null, i])];
        all.forEach(([car, i]) => {
            if (!car || !car.scene) return;
            const want = this._laneDriving(i) ? top : 0;
            car.wheelSpeed += (want - car.wheelSpeed) * ease;
            if (!want && car.wheelSpeed < 1) car.wheelSpeed = 0;
            if (!car.wheelSpeed) return;
            car.wheelAngle = (car.wheelAngle + car.wheelSpeed * delta / 1000) % 360;
            for (const t of car.tyres) t.setAngle(car.wheelAngle);
        });
    }

    // ================================================================
    // THE VILLAINS
    // ================================================================
    // A level's three chases, fresh: each lane's distance and payout from
    // levelData.js.
    _levelLanes(level) {
        const d = levelDistancesFor(level), pay = levelPayoutsFor(level);
        return d.map((v, i) => ({ total: v, left: v, payout: pay[i], caught: false }));
    }

    // Lane i's car is being driven: a piggy in its slot, and a villain still
    // to catch.
    _laneDriving(i) {
        const lane = this.lanes && this.lanes[i];
        return !!(this.chargingSlots[i] && lane && !lane.caught && !this._levelTurning && !this._briefing);
    }

    // THE LEVEL'S VILLAINS, one per lane — the level's villain, three times —
    // standing on the lane's road line at the right of the car area, with the
    // distance over each car. Built from this.lanes, so a relayout rebuilds
    // them exactly as they were (caught ones stay gone). `enter` fades the
    // villains in, for a new level.
    _buildVillains(enter) {
        // EVERYTHING THE LAST BUILD MADE goes first — the road and the gap
        // lines too. Left behind, a new level drew its road over a frozen copy
        // of the last one's, and the lanes showed two road lines.
        for (const o of [...this.villains, ...this.laneLabels, this.gapLines, this.roadGfx]) {
            if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); }
        }
        this.villains = []; this.laneLabels = [];
        this._clearWantedCards();
        this.gapLines = this.roadGfx = null;
        const V  = CONFIG.VILLAIN || {}, LB = V.LABEL || {};
        const v  = (x, d) => (x !== undefined ? x : d);
        const L  = this.layoutConfig, A = this.villainArea;
        if (!A || !this.lanes) return;
        const key = villainKey(villainIndexFor(this.level));
        const sc  = L.platformScale;

        this.platforms.forEach((p, i) => {
            const lane   = this.lanes[i];
            const car    = this.cars[i];
            const ground = p.slotY + p.slotSize / 2;
            // The FULL-SIZE car's height, so shrinking the car (CAR.SCALE)
            // leaves the villain as it was.
            const carH   = car ? (car.fullH || car.carH) : p.slotSize;

            // THE GETAWAY CAR, on the road line where the villain would stand.
            if (this._chaseCars()) {
                const en = this._makeGetawayCar(i, ground, key);
                if (enter && en) {
                    en.setAlpha(0).setScale(en.baseScale * 0.85);
                    this.tweens.add({ targets: en, alpha: 1, scale: en.baseScale,
                        duration: v(V.ENTER_MS, 400), delay: i * 90, ease: 'Back.easeOut' });
                }
                this.villains[i] = en;
            // THE VILLAIN, feet on the road line.
            } else if (this.textures.exists(key)) {
                const h = Math.min(carH * v(V.H_FRAC, 1.25), L.slotBandH * v(V.MAX_BAND_FRAC, 0.85));
                const img = this.add.image(0, ground, key)
                    .setOrigin(0.5, 1).setDepth(v(V.DEPTH, 4));
                // NEVER PAST THE AREA'S EDGES: shrunk if the free space is
                // narrower than the villain, and pulled in from the right edge
                // by EDGE_PAD rather than centred off it (portrait is narrow).
                const pad = v(V.EDGE_PAD, 12) * sc;
                const f   = img.frame;
                const k   = Math.min(h / f.realHeight, Math.max(1, A.width - 2 * pad) / f.realWidth)
                          * v(V.SCALE, 1);
                const w   = f.realWidth * k;
                img.setScale(k).setX(Math.max(A.x + pad + w / 2,
                    Math.min(A.x + A.width * v(V.X_FRAC, 0.7), A.x + A.width - pad - w / 2)));
                img.baseScale = img.scaleX;
                img.setVisible(!lane.caught);
                if (enter && !lane.caught) {
                    img.setAlpha(0).setScale(img.baseScale * 0.85);
                    this.tweens.add({ targets: img, alpha: 1, scale: img.baseScale,
                        duration: v(V.ENTER_MS, 400), delay: i * 90, ease: 'Back.easeOut' });
                }
                this.villains[i] = img;
            }

            // WHERE THE CAR'S DRIVE ENDS: its front bumper STOP_GAP short of
            // the villain. Never behind where it starts.
            if (car) {
                const vl = this.villains[i];
                const stopAt = vl ? vl.x - vl.displayWidth / 2 : A.x + A.width;
                const reach = Math.max(car.homeX, stopAt - v(V.STOP_GAP, 10) * sc - car.carW / 2);
                car.endX = car.homeX + (reach - car.homeX) * Math.max(0, Math.min(1, v(V.DRIVE_SHARE, 0.5)));
                // A GETAWAY CAR is driven right up to: at the last metre the
                // piggy car's front bumper is at CHASE_TARGET along it — so
                // the catch only has the last few px of overtaking left to do.
                //
                // THEY MEET IN THE MIDDLE: the getaway car drifts back as the
                // piggy car comes on (the gap still only closes), so the two
                // come level around MEET_AT of the car area, not at its end.
                if (vl && vl.isCar) {
                    const K = V.CAR || {};
                    const tgt = v(K.CHASE_TARGET, 0.85);
                    const k = -vl.carW / 2 + tgt * vl.carW - car.carW / 2;   // piggy centre − getaway centre
                    const CA = this.carArea;
                    let e1 = Math.min(vl.homeX, CA.x + CA.width * v(K.MEET_AT, 0.55) - k / 2);
                    if (e1 + k < car.homeX) e1 = car.homeX - k;
                    car.endX = e1 + k;
                    vl.endX = e1;
                }
                // A NEW LEVEL rolls the car back to the start; otherwise it is
                // put straight where its lane's progress says.
                if (enter) {
                    car.driveV = 0;
                    car.targetX = this._carXFor(i);
                    this.tweens.add({ targets: car, x: car.targetX,
                        duration: v(V.ENTER_MS, 400) + 200, ease: 'Sine.easeInOut' });
                } else {
                    this._placeCar(i, false);
                }
                // The getaway car where its lane's progress puts it — or
                // where it was blocked.
                const en = this.villains[i];
                if (en && en.isCar && !enter) { en.x = en.targetX = this._enemyXFor(i); en.driveV = 0; }
            }

            // THE DISTANCE, on the gap line — placed every frame (_drawGapLines).
            const fs = Math.max(10, Math.round(v(LB.SIZE, 30) * sc));
            this.laneLabels[i] = this.add.text(0, 0, '', {
                fontSize: fs + 'px', fontFamily: CONFIG.FONT_FAMILY, fontStyle: CONFIG.FONT_WEIGHT,
                color: LB.COLOR || '#ffffff', stroke: LB.STROKE || '#2b2013',
                strokeThickness: Math.round(v(LB.STROKE_W, 5) * sc),
            }).setOrigin(0.5).setDepth(v(V.DEPTH, 4) + 0.2);
            this._setLaneLabel(i);

            // A CAUGHT LANE keeps its badge — so a rebuild (a relayout, a
            // resumed save) shows it as it was.
            if (lane.caught) this._placeBadge(i);
        });
        this.gapLines = this.add.graphics().setDepth(v(V.DEPTH, 4) + 0.1);
        this._drawGapLines();
        const R = CONFIG.ROAD || {};
        this.roadGfx = this.add.graphics().setDepth(R.DEPTH !== undefined ? R.DEPTH : 3.8);
        this._drawRoads(0);
    }

    // ONE LANE'S ROAD, as a pattern over one PERIOD: its marks (where each sits
    // along it, what it is, its size) and its bumps (where, how high, how
    // long, as shares). Fixed per lane (hashed, not random), so a rebuild
    // draws the same road, and the three lanes differ.
    _roadPattern(lane) {
        const R = CONFIG.ROAD || {};
        const n = Math.max(1, R.MARKS || 8);
        const marks = [];
        for (let k = 0; k < n; k++) {
            const h = (s) => this._cellHash(lane, k, s);
            // Spread evenly, then nudged — irregular, but never bunched.
            const at = (k + 0.15 + 0.7 * h(1)) / n;
            marks.push({ at, kind: h(2) < 0.5 ? 'dash' : 'pebble', size: h(3), drop: h(4) });
        }
        // ONE BUMP per bump spacing (see _bumpEvery), somewhere along it.
        const h = (s) => this._cellHash(lane + 7, 0, s);
        const bumps = [{ at: 0.15 + 0.7 * h(1), h: 0.7 + 0.3 * h(2), w: 0.7 + 0.3 * h(3) }];
        return { marks, bumps };
    }

    // HOW FAR APART THE BUMPS ARE this level, px: EVERY on level 1, closing
    // in to EVERY_MIN by MIN_AT_LEVEL. Fixed for the level, so a bump never
    // jumps mid-road.
    _bumpEvery() {
        const B = (CONFIG.ROAD || {}).BUMPS || {};
        const v = (x, d) => (x !== undefined ? x : d);
        const a = v(B.EVERY, 2400), b = v(B.EVERY_MIN, 1000);
        const t = Math.min(1, Math.max(0, (this.level - 1) / Math.max(1, v(B.MIN_AT_LEVEL, 30) - 1)));
        return Math.max(20, (a + (b - a) * t) * this.layoutConfig.platformScale);
    }

    // THE ROADS, redrawn each frame — the line (with its bumps), the marks,
    // slid back by how far that lane has driven and faded out before its
    // villain — and each car's suspension stepped over the road under it.
    _drawRoads(delta) {
        const g = this.roadGfx;
        if (!g || !g.scene) return;
        g.clear();
        const R  = CONFIG.ROAD || {}, C = CONFIG.CAR || {}, BU = R.BUMPS || {};
        const v  = (x, d) => (x !== undefined ? x : d);
        const sc = this.layoutConfig.platformScale;
        const A  = this.carArea, B = this.layoutConfig.partB;
        if (!A) return;
        const x0 = A.x, xEnd = B.x + B.width;
        const period = Math.max(20, v(R.PERIOD, 420) * sc);
        const lineW  = Math.max(1, v(R.LINE_W, 3) * sc);
        const lineC  = hexColor(R.LINE_COLOR || '#a3825c');
        const markC  = hexColor(R.MARK_COLOR || '#7e6044');
        const bumpH  = v(BU.H, 6) * sc, bumpW = Math.max(2, v(BU.W, 40) * sc);
        const step   = Math.max(1, v(R.SAMPLE, 4) * sc);
        const top    = v(C.SPIN_DEG_PER_SEC, 540) || 1;
        if (!this._roadSets) this._roadSets = [0, 1, 2].map((i) => this._roadPattern(i));

        this.platforms.forEach((p, i) => {
            const y   = p.slotY + p.slotSize / 2;
            const car = this.cars[i], vl = this.villains[i];
            const set = this._roadSets[i];

            // IN STEP WITH THE TYRES: the share of full spin they are at.
            const k = car && car.scene ? Math.max(0, (car.wheelSpeed || 0) / top) : 0;
            // HOW FAR THE ROAD HAS SLID — kept whole, since the marks and the
            // bumps repeat at different spacings and each takes its own share.
            this.roadOffsets[i] += v(R.SPEED, 420) * sc * k * delta / 1000;
            const off = this.roadOffsets[i] % period;
            const bumpP = this._bumpEvery(), bumpOff = this.roadOffsets[i] % bumpP;

            // WHERE THE ROAD GOES QUIET: from just past the bumper, flat and
            // bare before the villain.
            // A GETAWAY CAR drives this same road, so none of that: the
            // road runs whole, marks and bumps, under both cars.
            const chase = !!(vl && vl.isCar);
            const front = car ? car.x + car.carW / 2 : x0;
            const vLeft = vl && vl.visible && !chase ? vl.x - vl.displayWidth / 2 : xEnd;

            // THE BREAK BEFORE THE VILLAIN: open while it is still to be
            // reached, eased shut once caught (and open again for the next).
            // Its place is kept from while the villain was there, since a
            // caught one is gone.
            const GP = R.GAP || {};
            const lane = this.lanes && this.lanes[i];
            if (vl && vl.visible && !chase) this.roadGapAt[i] = vLeft - v(GP.VILLAIN_PAD, 14) * sc;
            const want = lane && !lane.caught && !chase ? 1 : 0;
            const rate = delta / Math.max(1, v(GP.CLOSE_MS, 250));
            this.roadGapOpen[i] = want > this.roadGapOpen[i]
                ? Math.min(want, this.roadGapOpen[i] + rate)
                : Math.max(want, this.roadGapOpen[i] - rate);
            const gapEnd   = this.roadGapAt[i] !== null ? this.roadGapAt[i] : xEnd;
            const gapStart = chase ? gapEnd : gapEnd - v(GP.W, 26) * sc * this.roadGapOpen[i];

            const hardEnd = Math.min(vLeft - v(R.CLEAR, 18) * sc, gapStart);
            const f0 = Math.min(front + v(R.FADE_AHEAD, 20) * sc, hardEnd);
            const f1 = Math.min(f0 + v(R.FADE_LEN, 140) * sc, hardEnd);
            const fade = (x) => chase || x <= f0 ? 1 : x >= f1 ? 0 : 1 - (x - f0) / Math.max(1, f1 - f0);

            // THE ROAD'S HEIGHT at a screen x (px, up is +): the bumps, each a
            // smooth rise, slid back with the marks and flattened by the fade.
            const heightAt = (x) => {
                let hgt = 0;
                for (const b of set.bumps) {
                    const w = bumpW * b.w;
                    // The nearest copy of this bump, spacing by spacing.
                    let c = x0 + b.at * bumpP - bumpOff;
                    c += Math.round((x - c) / bumpP) * bumpP;
                    const d = Math.abs(x - c);
                    if (d < w / 2) hgt += bumpH * b.h * 0.5 * (1 + Math.cos(Math.PI * d / (w / 2)));
                }
                return hgt * fade(x);
            };

            // THE LINE, bumps and all — the car's piece up to the break, the
            // villain's piece after it (one piece once the break has shut).
            g.lineStyle(lineW, lineC, 1);
            const piece = (a, b) => {
                if (b - a < 0.5) return;
                g.beginPath();
                g.moveTo(a, y - heightAt(a));
                for (let x = a + step; x < b; x += step) g.lineTo(x, y - heightAt(x));
                g.lineTo(b, y - heightAt(b));
                g.strokePath();
            };
            if (gapEnd - gapStart < 0.5) piece(x0, xEnd);
            else { piece(x0, gapStart); piece(gapEnd, xEnd); }

            // THE MARKS, every period across the lane, slid back by the offset.
            for (let base = x0 - period; base < xEnd + period; base += period) {
                for (const m of set.marks) {
                    const x = base + m.at * period - off;
                    if (x < x0 || x > xEnd) continue;
                    const a = fade(x);
                    if (a <= 0.01 || (x > gapStart && x < gapEnd)) continue;
                    const yy = y - heightAt(x);
                    if (m.kind === 'dash') {
                        const len = (8 + 14 * m.size) * sc;
                        g.lineStyle(lineW, markC, a);
                        g.lineBetween(x, yy, Math.min(x + len, xEnd), y - heightAt(Math.min(x + len, xEnd)));
                    } else {
                        g.fillStyle(markC, a);
                        g.fillCircle(x, yy + (4 + 5 * m.drop) * sc, (1.2 + 1.6 * m.size) * sc);
                    }
                }
            }

            if (car && car.scene) this._suspend(car, heightAt, k, delta);
            if (chase && vl.scene) this._suspend(vl, heightAt, k, delta);
        });
    }

    // THE SUSPENSION, one step. Each tyre sits on the road straight under it;
    // each end of the body is a damped spring pulled toward its tyre's height,
    // with a kick back on pulling away and forward on stopping (the squat).
    // The body then takes the two ends' average height and the tilt between
    // them. See CONFIG.SUSPENSION.
    _suspend(car, heightAt, k, delta) {
        const S  = CONFIG.SUSPENSION || {};
        const v  = (x, d) => (x !== undefined ? x : d);
        const sc = this.layoutConfig.platformScale;
        const s  = car.susp, ends = s.ends;
        if (!ends.length) return;
        const scale = car.scaleX || 1;
        const dt = Math.min(delta, 50) / 1000;
        const w  = v(S.STIFFNESS, 16), z = v(S.DAMPING, 0.35);
        const max = v(S.MAX, 9) * sc;
        const kick = v(S.SQUAT, 60) * sc * (k - s.k);   // + speeding up, − slowing
        s.k = k;

        car.tyres.forEach((ty, j) => {
            const hgt = heightAt(car.x + car.tyreDX[j] * scale);
            ty.y = car.tyreBaseY[j] - hgt / scale;
            const end = ends[j];
            // The rear (first) squats as the car pulls away, the front lifts.
            end.v += (j === 0 ? -kick : kick);
            // Two half-steps: steadier at a dropped frame.
            for (let n = 0; n < 2; n++) {
                const h = dt / 2;
                end.v += (w * w * (hgt - end.e) - 2 * z * w * end.v) * h;
                end.e += end.v * h;
            }
            if (end.e - hgt > max)  { end.e = hgt + max; end.v = Math.min(0, end.v); }
            if (hgt - end.e > max)  { end.e = hgt - max; end.v = Math.max(0, end.v); }
        });

        // The body: halfway between its ends, tilted to the line between them.
        const r = ends[0], f = ends[ends.length - 1];
        const base = (car.tyreDX[ends.length - 1] - car.tyreDX[0]) * scale || 1;
        car.bodyImg.y = car.bodyBaseY - ((r.e + f.e) / 2) / scale;
        car.bodyImg.rotation = -Math.atan2(f.e - r.e, base);
        // A getaway car's driver rides with the body.
        if (car.face) {
            car.face.y = car.faceBaseY + (car.bodyImg.y - car.bodyBaseY);
            car.face.rotation = car.bodyImg.rotation;
        }
    }

    // WHERE LANE i's CAR SHOULD BE: from its home spot to its end, by the share
    // of the level's distance already covered.
    _carXFor(i) {
        const car = this.cars[i], lane = this.lanes && this.lanes[i];
        if (!car) return 0;
        // CAUGHT IN A CHASE: pulled ahead of the getaway car (_blockGetaway).
        if (lane && lane.caught && this._chaseCars()) return this._blockedCarX(i);
        const done = lane && lane.total > 0 ? 1 - lane.left / lane.total : 0;
        return car.homeX + (car.endX - car.homeX) * Math.max(0, Math.min(1, done));
    }

    // Send lane i's car to where its distance says: rolled there over DRIVE_MS
    // (a tick), or put there at once (a rebuild).
    _placeCar(i, roll) {
        const ms = (CONFIG.VILLAIN || {}).DRIVE_MS;
        const secs = (ms !== undefined ? ms : 950) / 1000;
        // The getaway car with it: drifting back as the gap closes.
        const en = this.villains[i];
        if (en && en.isCar && en.scene && !(this.lanes && this.lanes[i] && this.lanes[i].caught)) {
            en.targetX = this._enemyXFor(i);
            if (!roll) { en.x = en.targetX; en.driveV = 0; }
            else en.driveV = (en.targetX - en.x) / secs;
        }
        const car = this.cars[i];
        if (!car || !car.scene) return;
        car.targetX = this._carXFor(i);
        if (!roll) { car.x = car.targetX; car.driveV = 0; return; }
        car.driveV = (car.targetX - car.x) / secs;
    }

    // WHERE LANE i's GETAWAY CAR SHOULD BE: from its home back to where the
    // two meet, by the share of the distance covered — or, caught, blocked.
    _enemyXFor(i) {
        const en = this.villains[i], lane = this.lanes && this.lanes[i];
        if (!en || !en.isCar) return en ? en.x : 0;
        if (lane && lane.caught) return this._blockedX(i);
        const done = lane && lane.total > 0 ? 1 - lane.left / lane.total : 0;
        const end = en.endX !== undefined ? en.endX : en.homeX;
        return en.homeX + (end - en.homeX) * Math.max(0, Math.min(1, done));
    }

    // Each frame: every rolling car a step nearer its target, never past it.
    _driveCars(delta) {
        const dt = delta / 1000;
        for (const car of [...this.cars, ...this.villains]) {
            if (!car || !car.scene || !car.driveV) continue;
            const step = car.driveV * dt, gap = car.targetX - car.x;
            if (Math.abs(step) >= Math.abs(gap)) { car.x = car.targetX; car.driveV = 0; }
            else car.x += step;
        }
    }

    // THE MEASURING LINES, redrawn each frame since the cars move: above each
    // lane, from the car's centre to its villain's centre — an upright bar and
    // an arrowhead at either end, a faint leader down to each, and the
    // distance in the middle with the line broken around it. A line too short
    // for the figure gets it just above instead.
    _drawGapLines() {
        const g = this.gapLines;
        if (!g || !g.scene || !this.lanes) return;
        g.clear();
        const V  = CONFIG.VILLAIN || {}, G = V.GAP_LINE || {};
        const v  = (x, d) => (x !== undefined ? x : d);
        const sc = this.layoutConfig.platformScale;
        const arrow = v(G.ARROW, 11) * sc, lw = Math.max(1, v(G.W, 3) * sc);
        const tick = v(G.END_TICK, 18) * sc / 2, tpad = v(G.TEXT_PAD, 8) * sc;
        const col = hexColor(G.COLOR || '#ffffff'), alpha = v(G.ALPHA, 0.95);

        this.platforms.forEach((p, i) => {
            const lane = this.lanes[i], car = this.cars[i], vl = this.villains[i];
            const t = this.laneLabels[i];
            // NO LINE (GAP_LINE.ENABLED false): the figure rides BETWEEN the
            // two cars, over the taller of them (and the villain's head, if
            // it pokes above the roof), and never hides for want of room —
            // and stays up a moment at 0 once caught (LABEL.ZERO_MS).
            if (G.ENABLED === false && lane && car && vl && vl.visible && (!lane.caught || this._showingZero(lane))) {
                const ground = p.slotY + p.slotSize / 2;
                let top = Math.min(ground - car.carH, ground - vl.displayHeight);
                if (vl.face && vl.face.visible) top = Math.min(top, this._faceAt(vl).y - (vl.faceH || 0) * vl.scaleY / 2);
                if (t) t.setPosition((car.x + vl.x) / 2, top - v((V.LABEL || {}).ABOVE, 14) * sc - t.height / 2).setVisible(true);
                return;
            }
            if (!lane || lane.caught || !car || !vl || !vl.visible) { if (t) t.setVisible(false); return; }
            const ground = p.slotY + p.slotSize / 2;
            // CENTRE TO CENTRE, above whichever of the two stands taller.
            const carTop = ground - car.carH, vTop = ground - vl.displayHeight;
            const y  = Math.min(carTop, vTop) - v(G.ABOVE, 14) * sc;
            const x0 = car.x, x1 = vl.x;
            if (x1 - x0 < 2 * arrow) { if (t) t.setVisible(false); return; }

            // The leaders, faint, down toward the roof and the head.
            if (G.LEADERS !== false) {
                const lg = v(G.LEADER_GAP, 6) * sc;
                g.lineStyle(lw, col, alpha * v(G.LEADER_ALPHA, 0.45));
                if (carTop - lg > y + tick) g.lineBetween(x0, y + tick, x0, carTop - lg);
                if (vTop - lg > y + tick)   g.lineBetween(x1, y + tick, x1, vTop - lg);
            }

            // The two end bars and the arrowheads pointing out at them.
            g.lineStyle(lw, col, alpha);
            g.lineBetween(x0, y - tick, x0, y + tick);
            g.lineBetween(x1, y - tick, x1, y + tick);
            g.fillStyle(col, alpha);
            g.fillTriangle(x0, y, x0 + arrow, y - arrow * 0.55, x0 + arrow, y + arrow * 0.55);
            g.fillTriangle(x1, y, x1 - arrow, y - arrow * 0.55, x1 - arrow, y + arrow * 0.55);
            // The line itself, broken around the figure when it fits.
            const mid = (x0 + x1) / 2, half = t ? t.width / 2 + tpad : 0;
            if (t && x1 - x0 - 2 * arrow > 2 * half) {
                t.setPosition(mid, y).setVisible(true);
                g.lineBetween(x0 + arrow, y, mid - half, y);
                g.lineBetween(mid + half, y, x1 - arrow, y);
            } else {
                g.lineBetween(x0 + arrow, y, x1 - arrow, y);
                if (t) t.setPosition(mid, y - t.height / 2 - tpad / 2).setVisible(true);
            }
        });
    }

    // A caught lane's figure still showing its 0.
    _showingZero(lane) {
        return !!(lane && lane.caught && lane.zeroUntil && this.time.now < lane.zeroUntil);
    }

    _setLaneLabel(i) {
        const t = this.laneLabels[i], lane = this.lanes && this.lanes[i];
        if (!t || !t.scene || !lane) return;
        const LB = (CONFIG.VILLAIN || {}).LABEL || {};
        t.setText(this._bigNum(Math.ceil(lane.left)) + (LB.SUFFIX !== undefined ? LB.SUFFIX : ' m'))
            .setVisible(!lane.caught || this._showingZero(lane));
    }

    // CAUGHT. The villain goes (a fade for now — the kill animation comes
    // later), its payout showers to the coin counter, and if it was the
    // level's last, the next level follows.
    _catchVillain(i) {
        const V = CONFIG.VILLAIN || {};
        const lane = this.lanes[i];
        if (lane.caught) return;
        lane.caught = true;
        lane.left = 0;
        // THE 0 IS SHOWN before the figure goes (LABEL.ZERO_MS).
        const zm = ((V.LABEL || {}).ZERO_MS);
        lane.zeroUntil = this.time.now + (zm !== undefined ? zm : 600);
        this._setLaneLabel(i);

        const img = this.villains[i];
        const at = img && img.scene
            ? { x: img.x, y: img.y - img.displayHeight / 2 }
            : { x: this.villainArea.x + this.villainArea.width / 2, y: this.platforms[i].slotY };
        // A GETAWAY CAR is cut off and blocked; a villain on foot just goes.
        let blockMs = 0;
        if (img && img.scene && img.isCar) {
            blockMs = this._blockGetaway(i);
        } else if (img && img.scene) {
            this.tweens.add({ targets: img, alpha: 0, scale: img.baseScale * 0.8,
                duration: V.CAUGHT_MS !== undefined ? V.CAUGHT_MS : 350, ease: 'Cubic.easeIn',
                onComplete: () => { if (img.scene) img.setVisible(false); } });
        }
        // THE BOUNTY: from the CAUGHT card, once it is stamped — or straight
        // from the villain with no cards.
        const seq = this._showCaughtCard(i, (x, y) => this.animateCoinReward(x, y, lane.payout), blockMs);
        if (seq === null) this.animateCoinReward(at.x, at.y, lane.payout);

        if (this.lanes.every((l) => l.caught)) {
            this._levelTurning = true;
            this.time.delayedCall((seq || 0) + (V.NEXT_LEVEL_MS !== undefined ? V.NEXT_LEVEL_MS : 900),
                () => this._nextLevel());
        }
    }

    // THE NEXT LEVEL: its villain, three times, and fresh distances.
    _nextLevel() {
        this.level += 1;
        this.lanes = this._levelLanes(this.level);
        this._buildVillains(true);
        this._levelTurning = false;
        this._showWanted();
    }

    // ================================================================
    // THE WANTED CARDS — see CONFIG.WANTED
    // ================================================================
    // Where lane i's card goes: over its villain, centred on the lane's band,
    // kept inside the villain area. Its badge (the caught marker) stands on
    // the road line where the villain stood.
    // A CAUGHT getaway car's card goes on the road AHEAD of the stopped cars
    // instead, as large as the room there allows, and stays (no badge).
    _wantedSpot(i, caught) {
        const W = CONFIG.WANTED || {}, v = (x, d) => (x !== undefined ? x : d);
        const L = this.layoutConfig, p = this.platforms[i];
        const vl = this.villains[i];
        let A = this.villainArea, ahead = false;
        if (caught && vl && vl.isCar && this.carArea && this.cars[i]) {
            const CA = this.carArea, x0 = this._blockedCarX(i) + this.cars[i].carW / 2;
            A = { x: x0, width: Math.max(0, CA.x + CA.width - x0) };
            ahead = true;
        }
        if (!A || !p) return null;
        const pad = v(W.EDGE_PAD, 8) * L.platformScale;
        const asp = v(W.ASPECT, 0.78);
        let h = L.slotBandH * v(W.H_FRAC, 0.95);
        let w = h * asp;
        const room = Math.max(10, A.width - 2 * pad);
        if (w > room) { w = room; h = w / asp; }
        // Where the villain stands — a getaway car's home, wherever it is now.
        const cx = ahead ? A.x + A.width / 2
                 : vl ? (vl.homeX !== undefined ? vl.homeX : vl.x) : A.x + A.width / 2;
        const x  = Math.max(A.x + pad + w / 2, Math.min(cx, A.x + A.width - pad - w / 2));
        const ground = p.slotY + p.slotSize / 2;
        const bs = ahead ? 1 : v((W.CATCH || {}).BADGE_SCALE, 0.5);
        return { x, y: p.slotY, w, h, badgeY: ahead ? p.slotY : ground - h * bs / 2, badgeScale: bs, ahead };
    }

    // ONE CARD, built at its spot at full size: the paper, WANTED, the
    // villain's face and its bounty. `caught` adds the cuffs and the stamp, as
    // card.stamp, so they can be slammed on separately.
    _makeWantedCard(i, caught) {
        const W = CONFIG.WANTED || {}, C = W.CATCH || {};
        const spot = this._wantedSpot(i, caught), lane = this.lanes && this.lanes[i];
        if (!spot || !lane) return null;
        const { w, h } = spot;
        const font = (px, color, extra) => Object.assign({
            fontSize: Math.max(8, Math.round(px)) + 'px', fontFamily: CONFIG.FONT_FAMILY,
            fontStyle: CONFIG.FONT_WEIGHT, color,
        }, extra || {});

        const card = this.add.container(spot.x, spot.y).setDepth(W.DEPTH !== undefined ? W.DEPTH : 5);
        const g = this.add.graphics();
        const r = Math.min(w, h) * 0.06, bw = Math.max(1.5, w * 0.035);
        g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + bw, -h / 2 + bw * 1.5, w, h, r);
        g.fillStyle(hexColor(W.PAPER || '#f4e2b4'), 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
        g.lineStyle(bw, hexColor(W.BORDER || '#6b4423'), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        g.lineStyle(Math.max(1, bw * 0.4), hexColor(W.BORDER || '#6b4423'), 0.5)
            .strokeRoundedRect(-w / 2 + bw * 2, -h / 2 + bw * 2, w - bw * 4, h - bw * 4, r * 0.6);
        card.add(g);

        const title = this.add.text(0, -h * 0.36, W.TITLE || 'WANTED',
            font(h * 0.13, W.TITLE_COLOR || '#8a1c10')).setOrigin(0.5);
        if (title.width > w * 0.86) title.setScale(w * 0.86 / title.width);
        card.add(title);

        // The face, fitted to the middle of the card.
        const key = villainKey(villainIndexFor(this.level));
        let face = null;
        if (this.textures.exists(key)) {
            face = this.add.image(0, -h * 0.02, key);
            const f = face.frame;
            face.setScale(Math.min(w * 0.74 / f.realWidth, h * 0.46 / f.realHeight));
            if (caught) face.setTint(0xa8a8a8);
            card.add(face);
        }

        // The bounty: the coin and the figure, centred together.
        const fy = h * 0.35, cs = h * 0.12;
        const amt = this.add.text(0, fy, this._bigNum(lane.payout),
            font(h * 0.12, W.REWARD_COLOR || '#3b2412')).setOrigin(0, 0.5);
        const coin = this.textures.exists('coin') ? this.add.image(0, fy, 'coin').setDisplaySize(cs, cs) : null;
        const gap = cs * 0.25;
        let tw = amt.width + (coin ? cs + gap : 0);
        if (tw > w * 0.86) { const k = w * 0.86 / tw; amt.setScale(k); tw *= k; }
        if (coin) { coin.setX(-tw / 2 + coin.displayWidth / 2); card.add(coin); }
        amt.setX(-tw / 2 + (coin ? cs + gap : 0));
        card.add(amt);
        card.reward = coin ? [coin, amt] : [amt];   // the bounty line, gone once paid
        card.rewardY = fy;

        if (caught) {
            // A RED CROSS over the photo — this one is done.
            const stamp = this.add.container(0, -h * 0.02);
            const x = this.add.graphics();
            const cw = w * 0.34, chh = h * 0.21, lw = Math.max(3, w * 0.07);
            for (const [col, wid] of [[0xffffff, lw * 1.5], [hexColor(C.CROSS_COLOR || '#d32f2f'), lw]]) {
                x.lineStyle(wid, col, 1);
                x.lineBetween(-cw, -chh, cw, chh);
                x.lineBetween(-cw, chh, cw, -chh);
            }
            stamp.add(x);
            card.add(stamp);
            card.stamp = stamp;
        }
        card.spot = spot;
        return card;
    }

    // HANDCUFFS, drawn: two rings joined by a short chain, `size` px across,
    // centred on (x, y). A dark outline under a light steel stroke.
    _drawCuffs(g, x, y, size, C) {
        const s = size, rr = s * 0.2, lw = s * 0.07;
        const dark = hexColor(C.CUFF_DARK || '#3a4048'), steel = hexColor(C.CUFF_COLOR || '#b8c0c8');
        const rings = [[x - s * 0.27, y + s * 0.06], [x + s * 0.27, y + s * 0.06]];
        const links = [[x - s * 0.1, y - s * 0.1], [x, y - s * 0.14], [x + s * 0.1, y - s * 0.1]];
        for (const [col, wid] of [[dark, lw * 1.7], [steel, lw]]) {
            g.lineStyle(wid, col, 1);
            for (const [cx, cy] of rings) g.strokeCircle(cx, cy, rr);
            g.lineStyle(wid * 0.6, col, 1);
            for (const [cx, cy] of links) g.strokeCircle(cx, cy, s * 0.045);
        }
        // The lock on each ring, where the chain meets it.
        for (const [cx, cy] of rings) {
            const bx = cx + (cx < x ? rr * 0.55 : -rr * 0.55), by = cy - rr * 0.75;
            g.fillStyle(dark, 1).fillRect(bx - lw * 1.2, by - lw * 1.2, lw * 2.4, lw * 2.4);
            g.fillStyle(steel, 1).fillRect(bx - lw * 0.7, by - lw * 0.7, lw * 1.4, lw * 1.4);
        }
    }

    // Every card gone — the intro's and the caught ones — and the intro over.
    _clearWantedCards() {
        for (const c of [...this.wantedCards, ...this.caughtCards]) {
            if (c && c.scene) { this.tweens.killTweensOf(c); if (c.stamp) this.tweens.killTweensOf(c.stamp); c.destroy(); }
        }
        for (const o of this.perps) if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); }
        this.wantedCards = []; this.caughtCards = []; this.perps = [];
        this._endWantedTimers();
        this._briefing = false;
        for (const en of this.villains) if (en && en.isCar && en.face) en.face.setVisible(true);
    }

    _endWantedTimers() {
        if (this._wantedTimer) { this._wantedTimer.remove(false); this._wantedTimer = null; }
        if (this._wantedSkip) { this.input.off('pointerdown', this._wantedSkip); this._wantedSkip = null; }
    }

    // A level that has not been touched yet: nobody caught, nobody closer.
    _levelFresh() {
        return !!this.lanes && this.lanes.every((l) => !l.caught && l.left >= l.total);
    }

    // THE INTRO: each villain's card pops up over it in turn, holds, and
    // shrinks into it — then the chase starts. A tap anywhere ends it early.
    _showWanted() {
        const W = CONFIG.WANTED || {}, I = W.INTRO || {}, v = (x, d) => (x !== undefined ? x : d);
        if (W.ENABLED === false || !this._levelFresh()) return;
        this._clearWantedCards();
        this._briefing = true;
        const start = v(I.START_DELAY_MS, 150), stag = v(I.STAGGER_MS, 150), pop = v(I.POP_MS, 320);
        this.lanes.forEach((lane, i) => {
            const card = this._makeWantedCard(i, false);
            if (!card) return;
            // The getaway car waits empty until the card lands in it.
            const en = this.villains[i];
            if (en && en.isCar && en.face) en.face.setVisible(false);
            card.setScale(0).setAngle(Phaser.Math.Between(-6, 6));
            this.tweens.add({ targets: card, scale: 1, angle: 0, duration: pop,
                delay: start + i * stag, ease: 'Back.easeOut' });
            this.wantedCards.push(card);
        });
        if (!this.wantedCards.length) { this._briefing = false; return; }
        const n = this.wantedCards.length;
        this._wantedTimer = this.time.delayedCall(start + (n - 1) * stag + pop + v(I.HOLD_MS, 1200),
            () => this._endWanted());
        // Not the tap that dismissed the start tutorial — the next one.
        this._wantedSkip = () => this._endWanted();
        this.time.delayedCall(0, () => { if (this._briefing && this._wantedSkip) this.input.once('pointerdown', this._wantedSkip); });
    }

    // The intro's cards shrink into their villains, and the chase is on.
    _endWanted() {
        if (!this._briefing) return;
        this._endWantedTimers();
        this._briefing = false;
        const out = (CONFIG.WANTED && CONFIG.WANTED.INTRO && CONFIG.WANTED.INTRO.OUT_MS) || 280;
        const cards = this.wantedCards;
        this.wantedCards = [];
        cards.forEach((card, i) => {
            if (!card || !card.scene) return;
            this.tweens.killTweensOf(card);
            // INTO THE VILLAIN — a getaway car's window: it has jumped in.
            const vl = this.villains[i];
            const to = vl && vl.isCar ? this._faceAt(vl)
                     : vl ? { x: vl.x, y: vl.y - vl.displayHeight / 2 } : { x: card.x, y: card.y };
            this.tweens.add({ targets: card, x: to.x, y: to.y, scale: 0.1, alpha: 0,
                duration: out, ease: 'Cubic.easeIn', onComplete: () => {
                    card.destroy();
                    if (vl && vl.isCar && vl.scene) {
                        if (vl.face) vl.face.setVisible(true);
                        this._getawayStart(vl);
                    }
                } });
        });
    }

    // THE CATCH: in a chase, the villain steps out in front of the stopped
    // cars and the cuffs go on (_showPerp); then lane i's card pops up ahead
    // of the cars, the cross slams onto the photo and `pay` throws the bounty
    // from the card as its bounty line goes. The card stays as the lane's
    // done marker. Without getaway cars the card shrinks to a badge where the
    // villain stood. Returns how long it all takes, ms — or null with the
    // cards switched off.
    _showCaughtCard(i, pay, after = 0) {
        const W = CONFIG.WANTED || {}, C = W.CATCH || {}, v = (x, d) => (x !== undefined ? x : d);
        if (W.ENABLED === false) return null;
        const perpMs = this._showPerp(i, after);
        const card = this._makeWantedCard(i, true);
        if (!card) return null;
        const old = this.caughtCards[i];
        if (old && old.scene) old.destroy();
        this.caughtCards[i] = card;

        const d = after + perpMs + v(C.DELAY_MS, 200), pop = v(C.POP_MS, 260), stampMs = v(C.STAMP_MS, 220);
        const hold = v(C.HOLD_MS, 700), spot = card.spot;
        const shrink = spot.ahead ? 0 : v(C.SHRINK_MS, 300);
        card.setScale(0);
        card.stamp.setScale(2.4).setAlpha(0);
        this.tweens.add({ targets: card, scale: 1, duration: pop, delay: d, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: card.stamp, scale: 1, alpha: 1, duration: stampMs, delay: d + pop, ease: 'Cubic.easeIn',
            onComplete: () => {
                if (C.SHAKE) this.cameras.main.shake(v(C.SHAKE_MS, 120), C.SHAKE);
                // THE BOUNTY IS PAID: the coins fly from the card's bounty
                // line, and the line goes.
                pay(card.x, card.y + card.rewardY * card.scaleY);
                for (const o of card.reward) {
                    this.tweens.add({ targets: o, alpha: 0, scaleX: o.scaleX * 0.6, scaleY: o.scaleY * 0.6,
                        duration: 260, delay: 120, ease: 'Cubic.easeIn' });
                }
            },
        });
        if (shrink) {
            this.tweens.add({ targets: card, scale: spot.badgeScale, y: spot.badgeY,
                duration: shrink, delay: d + pop + stampMs + hold, ease: 'Cubic.easeInOut' });
        }
        return d - after + pop + stampMs + hold + shrink;
    }

    // A caught lane as it ends up, put straight there (a rebuild): the
    // cuffed villain in front of the cars, the card with its cross and no
    // bounty left on it.
    _placeBadge(i) {
        if ((CONFIG.WANTED || {}).ENABLED === false) return;
        this._showPerp(i, -1);
        const card = this._makeWantedCard(i, true);
        if (!card) return;
        card.setScale(card.spot.badgeScale).setY(card.spot.badgeY);
        for (const o of card.reward || []) o.setVisible(false);   // already paid
        this.caughtCards[i] = card;
    }

    // THE VILLAIN, OUT OF THE CAR: lane i's villain standing on the road in
    // front of both stopped cars, centred on them, with the cuffs on — popped
    // out `after` ms from now and cuffed after it, or put straight there
    // (`after` < 0, a rebuild). Its head leaves the window. Returns how long
    // until it is cuffed, ms (0 without a getaway car).
    _showPerp(i, after) {
        const V = CONFIG.VILLAIN || {}, PP = (V.CAR || {}).PERP || {}, C = (CONFIG.WANTED || {}).CATCH || {};
        const v = (x, d) => (x !== undefined ? x : d);
        const en = this.villains[i], car = this.cars[i], p = this.platforms[i];
        const key = villainKey(villainIndexFor(this.level));
        if (PP.ENABLED === false || !en || !en.isCar || !car || !p || !this.textures.exists(key)) return 0;
        const old = this.perps[i];
        if (old && old.scene) old.destroy();

        const ground = p.slotY + p.slotSize / 2;
        const x = ((this._blockedX(i) - en.carW / 2) + (this._blockedCarX(i) + car.carW / 2)) / 2;
        const perp = this.add.container(x, ground).setDepth(v(PP.DEPTH, 4.5));
        const img = this.add.image(0, 0, key).setOrigin(0.5, 1);
        const f = img.frame;
        const h = Math.min(car.carH * v(PP.H_FRAC, 1.05), this.layoutConfig.slotBandH * v(V.MAX_BAND_FRAC, 0.85));
        img.setScale(h / f.realHeight);
        // THE CUFFS, over its middle — its hands.
        const cuffs = this.add.graphics({ x: 0, y: -h * v(PP.CUFF_AT, 0.4) });
        this._drawCuffs(cuffs, 0, 0, img.displayWidth * v(PP.CUFF_W, 0.6), C);
        perp.add([img, cuffs]);
        this.perps[i] = perp;

        const hide = () => { if (en.face) en.face.setVisible(false); };
        if (after < 0) { hide(); return 0; }
        const pop = v(PP.POP_MS, 260), cuffMs = v(PP.CUFF_MS, 220);
        perp.setScale(0);
        cuffs.setScale(2.4).setAlpha(0);
        this.time.delayedCall(after, hide);
        this.tweens.add({ targets: perp, scale: 1, duration: pop, delay: after, ease: 'Back.easeOut' });
        this.tweens.add({ targets: cuffs, scale: 1, alpha: 1, duration: cuffMs, delay: after + pop, ease: 'Cubic.easeIn' });
        return pop + cuffMs;
    }

    // ================================================================
    // THE GETAWAY CARS — see CONFIG.VILLAIN.CAR
    // ================================================================
    _chaseCars() {
        const K = (CONFIG.VILLAIN || {}).CAR;
        return !!(K && K.ENABLED !== false && this.textures.exists('car_body'));
    }

    // THIS LEVEL'S GETAWAY CAR DESIGN from VILLAIN.CAR.CARS — a new one each
    // level, looping once all are used — with the texture keys it loaded under; null if there are
    // none (or its art is missing), and the piggy car's art stands in.
    _getawaySpec() {
        const cars = ((CONFIG.VILLAIN || {}).CAR || {}).CARS || [];
        if (!cars.length) return null;
        const n = (Math.max(1, Math.floor(this.level)) - 1) % cars.length + 1;
        const spec = Object.assign({}, cars[n - 1], { bodyKey: getawayBodyKey(n), tyreKey: getawayTyreKey(n) });
        return this.textures.exists(spec.bodyKey) && this.textures.exists(spec.tyreKey) ? spec : null;
    }

    // LANE i's GETAWAY CAR: the piggy car's body, tinted, the villain's head
    // in the driver's window — standing on the road at `ground` where the
    // villain would, behind the piggy car. Sized like a container image of
    // the car (setSize), so displayWidth / displayHeight read as they do for
    // a villain picture, and the code that measures villains measures it.
    _makeGetawayCar(i, ground, key) {
        const V = CONFIG.VILLAIN || {}, K = V.CAR || {};
        const v = (x, d) => (x !== undefined ? x : d);
        const A = this.villainArea, car = this.cars[i], p = this.platforms[i];
        const sc = this.layoutConfig.platformScale;
        // THE LEVEL'S CAR DESIGN (CARS, a new one each level), or the
        // piggy car's own art if none is loaded.
        const spec = this._getawaySpec();
        const C  = spec || CONFIG.CAR || {}, F = (spec && spec.FACE) || K.FACE || {};
        const bw = v(C.BODY_W, 254), gy = this._carGround(C);
        // AT THE PIGGY CAR'S PIXEL SCALE — the two arts drawn alike, so a
        // lower, longer car comes out lower and longer, not stretched to match.
        const k  = (car ? car.scaleX : p.slotSize / gy) * v(K.SCALE, 1);
        const en = this._makeCar(0, ground, gy * k, C).setDepth(v(K.DEPTH, 3.9));
        en.setSize(bw, gy);
        en.isCar = true;
        if (K.TINT) en.bodyImg.setTint(hexColor(K.TINT));

        // THE DRIVER: the top of the villain's picture — its head — in the window.
        if (this.textures.exists(key)) {
            // Anchored at its CUT EDGE, on the window's sill — so it pops up
            // from the sill when it peeks (_peekFaces), and sinks back to it.
            const sill = -gy + v(F.Y, 28) + v(F.H, 40) / 2;
            const face = this.add.image(-bw / 2 + v(F.X, 126), sill, key);
            const fw = face.frame.realWidth, fh = face.frame.realHeight;
            const ch = fh * v(F.HEAD_FRAC, 0.55);
            face.setCrop(0, 0, fw, ch).setOrigin(0.5, ch / fh).setScale(v(F.H, 40) / ch);
            face.baseScale = face.scaleX;
            en.addAt(face, 1);
            en.face = face;
            en.faceH = v(F.H, 40);
            en.faceBaseY = face.y;
            // THE PEEK (_peekFaces): 1 fully up, 0 out of sight; ducked, its
            // next look at the first milestone the lane has not yet passed.
            en.peek = { v: 0, want: 0, t: 0, up: false, mi: this._nextMilestone(i) };
        }

        // WHERE THE VILLAIN WOULD STAND; past the area's right edge rather
        // than over the piggy car if the area is too narrow — just in sight.
        const pad = v(V.EDGE_PAD, 12) * sc, w = en.carW;
        en.x = en.homeX = en.endX = en.targetX = Math.max(A.x + pad + w / 2,
            Math.min(A.x + A.width * v(V.X_FRAC, 0.7), A.x + A.width - pad - w / 2));
        en.baseScale = en.scaleX;
        return en;
    }

    // Lane i's share of its distance covered, 0..1.
    _laneDone(i) {
        const lane = this.lanes && this.lanes[i];
        return lane && lane.total > 0 ? 1 - lane.left / lane.total : 0;
    }

    // The index of the first look-back milestone (PEEK.AT) lane i has not
    // reached yet.
    _nextMilestone(i) {
        const M = (((CONFIG.VILLAIN || {}).CAR || {}).PEEK || {}).AT || [];
        const done = this._laneDone(i);
        let mi = 0;
        while (mi < M.length && M[mi] <= done) mi++;
        return mi;
    }

    // THE VILLAINS LOOK BACK: each getaway car's driver stays down out of
    // sight — just the window — and pops up from the sill to glance back
    // only as the piggy car reaches a milestone (PEEK.AT: a share of the
    // distance covered), then ducks again. Several passed in one go are one
    // look. Caught, it stays up. See VILLAIN.CAR.PEEK.
    _peekFaces(delta) {
        const P = ((CONFIG.VILLAIN || {}).CAR || {}).PEEK || {}, v = (x, d) => (x !== undefined ? x : d);
        const dt = Math.min(delta, 50) / 1000, S = P.SHOW || [0.8, 1.6];
        this.villains.forEach((en, i) => {
            if (!en || !en.isCar || !en.face || !en.peek || !en.scene) return;
            const pk = en.peek, lane = this.lanes && this.lanes[i];
            const M = P.AT || [];
            if (P.ENABLED === false || (lane && lane.caught)) pk.want = 1;
            else if (pk.up) {
                if ((pk.t -= dt) <= 0) { pk.up = false; pk.want = 0; }
            } else if (pk.mi < M.length && this._laneDone(i) >= M[pk.mi]) {
                pk.up = true; pk.want = 1;
                pk.t = Phaser.Math.FloatBetween(S[0], S[1]);
                pk.mi = this._nextMilestone(i);
            }
            // 0 ms is instant: the head simply appears / is gone.
            const ms = pk.want > pk.v ? v(P.UP_MS, 160) : v(P.DOWN_MS, 0);
            const step = ms > 0 ? dt * 1000 / ms : 1;
            pk.v = pk.want > pk.v ? Math.min(pk.want, pk.v + step) : Math.max(pk.want, pk.v - step);
            // Up with a little overshoot, down straight.
            // (Back-out by hand: Phaser.Math.Easing is not in the custom build.)
            const b = 1.70158, u = pk.v - 1;
            const e = pk.want ? 1 + u * u * ((b + 1) * u + b) : pk.v;
            en.face.setScale(en.face.baseScale, en.face.baseScale * Math.max(0, e));
        });
    }

    // Where a getaway car's driver's head is, on screen.
    _faceAt(en) {
        const f = en.face;
        // Its middle when fully up — it stands on the sill (see _makeGetawayCar).
        return f ? { x: en.x + f.x * en.scaleX, y: en.y + (f.y - (en.faceH || 0) / 2) * en.scaleY }
                 : { x: en.x, y: en.y - en.displayHeight / 2 };
    }

    // The villain has jumped in: the car hops on its springs and kicks up dust.
    _getawayStart(en) {
        const sc = this.layoutConfig.platformScale;
        // Seen getting in — up — before its first duck.
        const S = (((CONFIG.VILLAIN || {}).CAR || {}).PEEK || {}).SHOW || [0.8, 1.6];
        if (en.peek) Object.assign(en.peek, { v: 1, want: 1, up: true, t: Phaser.Math.FloatBetween(S[0], S[1]) });
        this.tweens.add({ targets: en, y: en.y - 5 * sc, duration: 110, yoyo: true, ease: 'Sine.easeOut' });
        this._dust(en, 0, 3);
    }

    // WHERE THE PIGGY CAR STOPS, CAUGHT: its front bumper SURGE px past
    // where the getaway car's was — the piggy car has done the driving and
    // overtaken; the getaway car has only given way.
    _blockedCarX(i) {
        const B = ((CONFIG.VILLAIN || {}).CAR || {}).BLOCK || {};
        const car = this.cars[i], en = this.villains[i];
        if (!car) return 0;
        if (!en || !en.isCar) return car.endX;
        // SURGE past where the chase left it — level with the getaway car —
        // but never past the screen's edge.
        const sc = this.layoutConfig.platformScale;
        const surge = (B.SURGE !== undefined ? B.SURGE : 22) * sc;
        const A = this.villainArea, pad = ((CONFIG.VILLAIN || {}).EDGE_PAD || 12) * sc;
        return Math.min(car.endX + surge, A.x + A.width - pad / 2 - car.carW / 2);
    }

    // WHERE A BLOCKED GETAWAY CAR ENDS UP: OVERLAP of it hidden behind the
    // piggy car at its caught spot. Never off the car area's left edge.
    _blockedX(i) {
        const B = ((CONFIG.VILLAIN || {}).CAR || {}).BLOCK || {};
        const car = this.cars[i], en = this.villains[i];
        if (!car || !en) return en ? en.x : 0;
        const ov = B.OVERLAP !== undefined ? B.OVERLAP : 0.55;
        const x  = this._blockedCarX(i) - car.carW / 2 + (ov - 0.5) * en.carW;
        return Math.max(this.carArea.x + en.carW / 2, x);
    }

    // CAUGHT IN A CHASE: the piggy car sprints, closes the gap and overtakes
    // — and only once its bumper reaches the getaway car does that one give
    // way, braking back behind it: a jolt, skid marks, dust.
    // Returns how long it takes, ms.
    _blockGetaway(i) {
        const B = ((CONFIG.VILLAIN || {}).CAR || {}).BLOCK || {};
        const v = (x, d) => (x !== undefined ? x : d);
        const car = this.cars[i], en = this.villains[i];
        if (!car || !car.scene || !en || !en.scene) return 0;
        const slide = v(B.SLIDE_MS, 700), brake = v(B.BRAKE_MS, 140);

        this.tweens.killTweensOf(car);
        car.driveV = en.driveV = 0;
        const x0 = car.x, x1 = this._carXFor(i);
        car.targetX = x1;
        // EASING OUT: it carries on at chase pace and slows to its stop —
        // no burst of speed.
        this.tweens.add({ targets: car, x: x1, duration: slide, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: car, angle: -v(B.CUT_TILT, 4), duration: slide / 2,
            delay: slide * 0.3, yoyo: true, ease: 'Sine.easeInOut' });

        // WHEN THE BUMPERS MEET: the share of the piggy car's run at which
        // its front reaches the getaway car's rear, turned into time through
        // the run's easing (Sine out: x = sin(πt / 2)). Already alongside —
        // the usual case — the getaway car brakes at once.
        const meet = en.x - en.carW / 2 - car.carW / 2;
        const f = x1 > x0 ? Math.max(0, Math.min(1, (meet - x0) / (x1 - x0))) : 0;
        const t = Math.asin(f) * 2 / Math.PI;
        const back = Math.max(160, slide * (1 - t) + brake);
        this.tweens.add({
            targets: en, x: this._blockedX(i), delay: slide * t,
            duration: back, ease: 'Quad.easeOut',
            onComplete: () => {
                if (!en.scene) return;
                this.tweens.add({ targets: en, angle: v(B.BRAKE_TILT, 5), duration: brake,
                    yoyo: true, ease: 'Quad.easeOut' });
                this._skid(en);
                this._dust(en, -1, v(B.PUFFS, 5));
                if (B.SHAKE) this.cameras.main.shake(v(B.SHAKE_MS, 140), B.SHAKE);
            },
        });
        return slide * t + back + brake * 2 + v(B.SETTLE_MS, 260);
    }

    // SKID MARKS behind each of a car's tyres, fading.
    _skid(en) {
        const B = ((CONFIG.VILLAIN || {}).CAR || {}).BLOCK || {};
        const sc = this.layoutConfig.platformScale;
        const len = (B.SKID_LEN !== undefined ? B.SKID_LEN : 46) * sc;
        const g = this.add.graphics().setDepth(3.85);
        g.lineStyle(Math.max(1.5, 3 * sc), 0x4a3a2a, 0.7);
        for (const dx of en.tyreDX) {
            const tx = en.x + dx * en.scaleX;
            g.lineBetween(tx - len, en.y, tx, en.y);
        }
        this.tweens.add({ targets: g, alpha: 0, delay: 400, duration: 900, onComplete: () => g.destroy() });
    }

    // DUST at a car's tyres, drifting back: `n` puffs, at the rear tyre
    // (side 0) or both (side -1).
    _dust(en, side, n) {
        const B = ((CONFIG.VILLAIN || {}).CAR || {}).BLOCK || {};
        const sc = this.layoutConfig.platformScale;
        const col = hexColor(B.DUST || '#d9c3a0');
        const at = side === 0 ? [en.tyreDX[0]] : en.tyreDX;
        for (let k = 0; k < n; k++) {
            const tx = en.x + at[k % at.length] * en.scaleX;
            // A graphics, not this.add.circle: shapes are not in the custom build.
            const c = this.add.graphics({ x: tx + Phaser.Math.Between(-6, 6) * sc,
                                          y: en.y - Phaser.Math.Between(0, 6) * sc })
                .fillStyle(col, 0.9).fillCircle(0, 0, Phaser.Math.Between(4, 8) * sc).setDepth(4.05);
            this.tweens.add({ targets: c, x: c.x - Phaser.Math.Between(10, 32) * sc,
                y: c.y - Phaser.Math.Between(6, 18) * sc, scale: 2.4, alpha: 0,
                duration: Phaser.Math.Between(420, 620), ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
        }
    }

    // A slot's figure: metres per second.
    _rateText(mps) {
        const CA = CONFIG.CAR_AREA || {};
        return this._bigNum(mps) + (CA.RATE_SUFFIX !== undefined ? CA.RATE_SUFFIX : ' m/s');
    }
    // ── POOLED FLOATING TEXT ─────────────────────────────────────────────────
    // The numbers that float up and fade — a pick's "-N", a plant's "+N", a
    // section's bonus — are TAKEN FROM A POOL, one per `kind`, not made and
    // thrown away each time. A finished one is only hidden; the next of its
    // kind takes it back, re-texted and moved. A new one is made only when
    // every one of its kind is still in the air, so a pool grows to the most
    // ever up at once and stays there. Its style is set again only if it
    // changed (a relayout's new scale), since a restyle redraws it.
    _floatText(kind, style) {
        const pools = this._textPools || (this._textPools = {});
        const list  = (pools[kind] || []).filter((o) => o.scene);
        pools[kind] = list;
        const key = JSON.stringify(style);
        let t = list.find((o) => !o.visible);
        if (!t) {
            t = this.add.text(0, 0, '', style);
            list.push(t);
        } else {
            this.tweens.killTweensOf(t);
            if (t._styleKey !== key) t.setStyle(style);
        }
        t._styleKey = key;
        return t.setVisible(true).setAlpha(1).setScale(1).setAngle(0);
    }

    // Back to its pool — hidden, not destroyed.
    _floatTextDone(t) {
        if (t && t.scene) { this.tweens.killTweensOf(t); t.setVisible(false); }
    }

    // ── Cell faces ───────────────────────────────────────────────────────────
    // The grid cell, its filled twin and the battery case's occupied division
    // are baked ONCE into textures rather than drawn per cell: a rounded square
    // in the flat colour, the noise tile blended over it (the same overlay-at-
    // low-alpha composite you would build in an image editor, done here so the
    // COLOUR stays a config value — one grain file serves every face), then the
    // inset bevel ring. Nine cells then cost nine images sharing two textures,
    // where they used to cost eighteen graphics objects.
    //
    // Baked at the cell's true pixel size, and rebaked only if that size changes.
    _makeCellTextures(px) {
        const C = CONFIG.CELL;
        const N = C.NOISE || {};
        px = Math.max(8, Math.round(px));
        if (this._cellTexPx === px) return;
        this._cellTexPx = px;

        const inset = Math.max(1, Math.round(C.INSET_BORDER_WIDTH * px / C.SIZE));
        const rad   = Math.max(1, Math.round(C.RADIUS * px / C.SIZE));
        const noise = (N.ENABLED !== false && this.textures.exists('cell_noise'))
                    ? this.textures.get('cell_noise').getSourceImage() : null;
        // Canvas wants CSS colours; the config already uses them, but tolerate a
        // hex number in case one slips in.
        const hexStr = (c) => typeof c === 'number'
            ? '#' + (c >>> 0).toString(16).padStart(6, '0') : c;
        // Rounded-rect path by hand: roundRect() is too new to rely on.
        const path = (ctx, x, y, w, h, r) => {
            r = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y,     x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x,     y + h, r);
            ctx.arcTo(x,     y + h, x,     y,     r);
            ctx.arcTo(x,     y,     x + w, y,     r);
            ctx.closePath();
        };
        const bake = (key, faceColor, bevel) => {
            if (this.textures.exists(key)) this.textures.remove(key);
            const canvas = this.textures.createCanvas(key, px, px);
            const ctx = canvas.getContext();
            ctx.clearRect(0, 0, px, px);
            if (bevel) {                       // the ring that fakes a recessed edge
                path(ctx, 0, 0, px, px, rad);
                ctx.fillStyle = C.INSET_SHADOW_COLOR;
                ctx.fill();
            }
            const o = bevel ? inset : 0;
            path(ctx, o, o, px - 2 * o, px - 2 * o, rad - o);
            ctx.fillStyle = faceColor;
            ctx.fill();
            if (noise) {
                // Clipped to the face just drawn, so the grain never crosses the
                // rounded edge or tints the bevel.
                ctx.save();
                ctx.clip();
                // CONTRAST first: the tile is blurred noise on neutral grey and
                // only spans about ±18% around mid — at a few percent alpha that
                // works out to a level or two of 255, i.e. nothing. Stretching it
                // before the blend is what an image editor's "noise layer at 100%,
                // group at 7%" actually gives you.
                const k = N.CONTRAST || 1;
                if (k !== 1 && typeof ctx.filter === 'string') ctx.filter = `contrast(${k})`;
                ctx.globalCompositeOperation = N.BLEND || 'overlay';
                ctx.globalAlpha = N.ALPHA !== undefined ? N.ALPHA : 0.6;
                const z = N.TILE || 1;         // <1 = coarser grain (tile blown up)
                ctx.drawImage(noise, o, o, (px - 2 * o) / z, (px - 2 * o) / z);
                ctx.restore();
            }
            canvas.refresh();
        };
        bake('cell_empty',  hexStr(C.EMPTY_BG_COLOR),  true);
        bake('cell_filled', hexStr(C.FILLED_BG_COLOR), true);
        bake('cell_face',   hexStr(C.FILLED_BG_COLOR), false);   // no bevel: inside the battery case
    }

    // The stand-alone slot face (portrait only — inside the battery case the
    // divisions use the baked cell texture instead).
    // A stable pseudo-random value in [0,1) for a cell, per `salt`. Same cell,
    // same number, every rebuild — which is the point: it decides which way each
    // cell's grain is mirrored, and a Math.random() there would reshuffle the
    // grid's whole speckle every time the scene is built.
    _cellHash(col, row, salt) {
        let h = (col * 374761393) ^ (row * 668265263) ^ ((salt || 0) * 2147483647);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    _drawSlot(gfx, x, y, size, filled) {
        const shadow = hexColor(CONFIG.CELL.INSET_SHADOW_COLOR);
        const fill   = filled ? hexColor(CONFIG.CELL.FILLED_BG_COLOR) : hexColor(CONFIG.CELL.EMPTY_BG_COLOR);
        const inset  = Math.max(1, Math.round(CONFIG.CELL.INSET_BORDER_WIDTH * size / CONFIG.PLATFORM.SLOT_SIZE));
        const r      = Math.round(CONFIG.PLATFORM.SLOT_RADIUS * size / CONFIG.PLATFORM.SLOT_SIZE);
        // THE EMPTY FACE IS SEE-THROUGH (PLATFORM.SLOT_EMPTY_ALPHA), so an
        // empty slot reads as a hole in the ground rather than a tile of some
        // other colour. So the rim is a RING, stroked, not a full square under
        // the face — a square there would show through the face instead of
        // the ground.
        const a = filled ? 1 : (CONFIG.PLATFORM.SLOT_EMPTY_ALPHA !== undefined
                                ? CONFIG.PLATFORM.SLOT_EMPTY_ALPHA : 1);
        gfx.clear();
        gfx.fillStyle(fill, a);
        gfx.fillRoundedRect(x - size / 2 + inset, y - size / 2 + inset,
            size - inset * 2, size - inset * 2, Math.max(1, r - inset));
        gfx.lineStyle(inset, shadow, 1);
        gfx.strokeRoundedRect(x - size / 2 + inset / 2, y - size / 2 + inset / 2,
            size - inset, size - inset, Math.max(1, r - inset / 2));
    }

    // THE RULE BETWEEN THE TWO HALVES.
    //
    // It used to need a camera of its own to sit ON the boundary: the old farm had
    // its own viewport starting at exactly this line and drawn after the main
    // one, so half the rule was painted over. With one camera left there is
    // nothing to draw over it, and a plain graphics object is the whole story.
    _buildSplitLine() {
        const S = (CONFIG.BACKGROUND || {}).SPLIT_LINE || {};
        if (S.ENABLED === false) return;
        const L = this.layoutConfig, B = L.partB;
        if (!B) return;
        const w = Math.max(1, (S.W !== undefined ? S.W : 3) * L.scale);
        const g = this.add.graphics().setDepth(99998);
        g.lineStyle(w, S.COLOR !== undefined ? S.COLOR : 0x364549,
                       S.ALPHA !== undefined ? S.ALPHA : 0.9);
        if (this.isPortrait) {
            const y = B.y + B.height;              // the car area is the top band
            g.lineBetween(0, y, this.scale.width, y);
        } else {
            const x = B.x;                         // the car area is the right half
            g.lineBetween(x, 0, x, this.scale.height);
        }
        this.splitLine = g;
        // BORN HIDDEN IF THE TUTORIAL IS ALREADY UP. The start overlay is built
        // earlier in create() than this is, so it cannot hide a line that does
        // not exist yet — it leaves word instead, and this honours it.
        if (this._splitLineOff) g.setVisible(false);
    }

    // Show or hide the rule between the halves, remembering the answer for a
    // line that has not been built yet.
    _showSplitLine(on) {
        this._splitLineOff = !on;
        if (this.splitLine && this.splitLine.scene) this.splitLine.setVisible(on);
    }





    // ================================================================
    // LEVEL ART — loaded as levels come near
    // ================================================================
    // WHAT a level needs is decided in assets.js (levelArtFor), from the level's
    // entry and its map — the build runs the same rules to write the page's
    // preload hints. What is here is only WHEN: fetched as levels come near,
    // and waited for before a level is built.




    // ── EVERY BATTERY, QUIETLY, ONCE THE GAME IS RUNNING ─────────────────────
    // The icons are ~2.5KB each and the whole set is 250KB, so nothing is gained
    // by making a player wait for one mid-merge — but nothing is gained by
    // putting 250KB in front of the first frame either.
    //
    // So they are fetched AFTER the loading screen has gone, a few at a time,
    // in the background. A player who loses signal (or a phone that drops to no
    // data on a train) keeps merging as far as they like, and the opening load
    // never grew. Levels the player is about to reach are fetched ahead of this
    // anyway (prefetchAhead), which is what covers the first minute.
    _startBatteryBackfill() {
        const B = CONFIG.BATTERY_BACKFILL || {};
        if (B.ENABLED === false) return;
        const top = getHighestBatteryLevel();
        let next = 1;
        // The timer is held rather than read from the callback's arguments:
        // Phaser hands a repeating callback whatever is in `args`, not the event
        // itself, so asking the argument to remove itself throws.
        let ev = null;
        ev = this.time.addEvent({
            delay: B.EVERY_MS !== undefined ? B.EVERY_MS : 900,
            loop: true,
            callback: () => {
                // NOT WHILE THE OPENING VIEW IS STILL COMING IN. These are the
                // least urgent files in the game; they wait their turn behind
                // the art the player is looking at.
                if (!loadingScreenDone) return;
                let sent = 0;
                const batch = Math.max(1, B.BATCH || 4);
                while (next <= top && sent < batch) {
                    const lvl = next++;
                    if (this.textures.exists(`battery${lvl}`)) continue;
                    this.assets.prefetchBattery(lvl);
                    sent++;
                }
                if (next > top && ev) ev.remove();
            },
        });
    }


    // Big numbers, readably. The economy reaches 27 trillion by level 65, so
    // every figure the player sees goes through this.
    _bigNum(v) {
        const N = CONFIG.NUMBERS || {};
        const a = Math.max(0, v);
        // SHORTEN ONLY WHEN IT BUYS SOMETHING. Abbreviating from a thousand up
        // costs the player the very granularity they are watching: coins going
        // 1,240 → 1,260 → 1,290 reads as progress, and the same run as
        // "1.2K → 1.2K → 1.3K" reads as stuck. Full figures hold until they stop
        // fitting (ABBREV_FROM), and only then does a unit take over.
        const from = N.ABBREV_FROM !== undefined ? N.ABBREV_FROM : 1e6;
        if (a >= from) {
            // ONE DECIMAL IN EACH UNIT'S FIRST DECADE — 1.2M, 9.9M, then 12M —
            // so a big figure still visibly moves instead of sitting on the same
            // two digits for a minute.
            for (const [at, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
                // Cut, not rounded, so 999,600 reads 999K rather than 1000K.
                const d = a < at * 10 ? 1 : 0, k = Math.pow(10, d);
                if (a >= at) return (Math.floor(a / at * k) / k).toFixed(d) + suffix;
            }
        }
        // Grouped, so six digits read at a glance: 50,000 not 50000.
        const whole = String(Math.ceil(a));
        const sep = N.SEPARATOR !== undefined ? N.SEPARATOR : ',';
        return sep ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : whole;
    }

    // Stop the world, or start it again.
    //
    // update() returning early is only half of it. Tweens, the clock, the
    // animations and the particle emitters all run on their own and would carry
    // on regardless — lilies drifting, the belt turning, charge still arriving —
    // so each is stopped explicitly. Anything missed here reads as a bug rather
    // than as a pause.
    _setPaused(on) {
        if (this.gamePaused === on) return;
        this.gamePaused = on;
        // Poki's gameplay events are sent by the CALLERS (the ads), in the
        // order each needs them.

        if (on) { this.tweens.pauseAll(); this.anims.pauseAll(); }
        else    { this.tweens.resumeAll(); this.anims.resumeAll(); }
        this.time.paused = on;                 // the 1s charge tick, and every
                                               // delayedCall

    }




    /**
     * Calculate display dimensions to fit sprite to target rectangle while preserving aspect ratio.
     * Automatically constrains by width or height to maximize area within the target rect.
     * 
     * @param {Phaser.Textures.Texture} texture - The sprite texture
     * @param {number} targetWidth - The target width
     * @param {number} targetHeight - The target height (optional, defaults to targetWidth for square)
     * @returns {{width: number, height: number}} - Display width and height
     */


    async addBatteryToSlot(slotIndex, level) {
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (this.chargingSlots[slotIndex] !== null) return;
        const p   = this.platforms[slotIndex];
        const distPerSec  = getBatteryChargeValue(level);
        const batteryIconLevel = getBatteryIconLevel(level);
        // The SLOT's figures, not the grid cell's — see calculateLayout.
        const yOff  = this.slotBatteryYOffset;
        const tOff  = this.slotLevelTextYOffset;

        // Transparent draggable overlay that covers the whole slot cell —
        // gives a reliable pick-up region independent of sprite texture.
        const draggableBg = this.add.rectangle(
            p.slotX, p.slotY, p.slotSize, p.slotSize, 0xFFFFFF, 0)
            .setDepth(10)
            .setInteractive({ draggable: true, useHandCursor: true });

        // As in the grid: drawn on this frame with whatever art exists, dressed
        // in its own the moment that arrives.
        const batterySprite = this.add.image(p.slotX, p.slotY + yOff,
            this.assets.iconKey(batteryIconLevel));
        fitItemIcon(batterySprite, this.slotBatteryW, this.slotBatteryH);
        batterySprite.setDepth(11);
        // ITS STEERING WHEEL, a sprite of its own here so it can turn. Placed
        // over the piggy every frame (_steerWheels).
        const wheel = this.add.image(p.slotX, p.slotY, '__DEFAULT').setVisible(false);
        wheel.ready = false;
        this.assets.dressSlotWhenReady(batterySprite, wheel, batteryIconLevel);

        const levelText = this.add.text(p.slotX, p.slotY + yOff + tOff, `PIGGY ${level}`, {
            fontSize: this.slotLevelTextSize, fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: CONFIG.FONT_WEIGHT,
        }).setOrigin(0.5).setDepth(12);

        p.slotBgFilled.setVisible(true);
        p.batterySprite    = batterySprite;
        p.batteryLevelText = levelText;

        // Show charge-rate label above the slot
        p.chargeRateText.setText(this._rateText(distPerSec)).setVisible(true);

        const batteryData = {
            sprite: batterySprite, levelText,
            draggableBg, level,
            slotIndex,
            originalX: p.slotX,
            originalY: p.slotY + yOff,
            inGrid: false, inChargingSlot: true,
            wheel, steer: { angle: 0, vel: 0, target: 0, hold: 0 },
        };
        this.steeringItems.push(batteryData);
        draggableBg.setData('batteryData', batteryData);
        this.chargingSlots[slotIndex] = { level, distPerSec, batteryData };
        this._hideSlotHint(slotIndex);
    }

    removeBatteryFromSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (!this.chargingSlots[slotIndex]) return;
        const slot = this.chargingSlots[slotIndex];
        const bd   = slot.batteryData;
        const p    = this.platforms[slotIndex];
        if (bd && bd.draggableBg) { bd.draggableBg.destroy(); bd.draggableBg = null; }
        if (p.batterySprite)    p.batterySprite.destroy();
        if (p.batteryLevelText) p.batteryLevelText.destroy();
        p.batterySprite = p.batteryLevelText = null;
        p.slotBg.setVisible(true);
        p.slotBgFilled.setVisible(false);
        p.chargeRateText.setVisible(false);
        this.chargingSlots[slotIndex] = null;
    }

    // ================================================================
    // CHARGING
    // ================================================================
    // ONE 1-SECOND TICK, and it is the whole game's heartbeat. Each slot with a
    // piggy in it drives its car that piggy's distance closer to its lane's
    // villain; at zero the villain is caught and pays out (_catchVillain).
    // Merge a better piggy, catch them sooner.
    startCharging() {
        if (this.chargingInterval) return;
        this.chargingInterval = this.time.addEvent({
            delay: 1000, callback: this.chargeCycle, callbackScope: this, loop: true,
        });
    }

    chargeCycle() {
        // HELD WHILE A RELAYOUT WAITS, so everything can come to rest — see
        // _pollOrientation. A second or so of driving, never lost work. Held
        // too between levels: there is nobody to chase — and while the wanted
        // cards are up.
        if (this._relayoutPending || this._levelTurning || this._briefing || !this.lanes) return;
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (!slot || !this._laneDriving(i)) continue;
            // THE PIGGY'S M/S OFF ITS LANE'S DISTANCE — its damage, in effect.
            const lane = this.lanes[i];
            const got  = Math.min(slot.distPerSec, lane.left);
            this.distance += got;
            lane.left = Math.max(0, lane.left - slot.distPerSec);
            this._distPop(i, got);
            this._setLaneLabel(i);
            this._placeCar(i, true);
            if (lane.left <= 0) this._catchVillain(i);
        }
    }

    // THE DISTANCE POP: the metres lane i just closed, floating up off its
    // gap line (or over its car, when the line is too short to show).
    _distPop(i, amt) {
        const D = (CONFIG.CHASE_FX || {}).DIST_POP || {};
        if (D.ENABLED === false || !(amt > 0)) return;
        const v = (x, d) => (x !== undefined ? x : d);
        const sc = this.layoutConfig.platformScale;
        const t = this.laneLabels[i], car = this.cars[i], p = this.platforms[i];
        if (!car || !p) return;
        const ground = p.slotY + p.slotSize / 2;
        const x = t && t.visible ? t.x : car.x;
        const y = t && t.visible ? t.y - t.height / 2 : ground - car.carH;
        const LB = ((CONFIG.VILLAIN || {}).LABEL) || {};
        const f = this._floatText('distPop', {
            fontSize: Math.max(10, Math.round(v(D.SIZE, 24) * sc)) + 'px',
            fontFamily: CONFIG.FONT_FAMILY, fontStyle: CONFIG.FONT_WEIGHT,
            color: D.COLOR || '#ffe27a', stroke: D.STROKE || '#2b2013',
            strokeThickness: Math.round(v(D.STROKE_W, 4) * sc),
        });
        const j = v(D.JITTER, 10) * sc;
        f.setText('−' + this._bigNum(Math.round(amt)) + (LB.SUFFIX !== undefined ? LB.SUFFIX : ' m'))
            .setOrigin(0.5, 1).setDepth(4.3).setPosition(x + Phaser.Math.FloatBetween(-j, j), y);
        this.tweens.add({ targets: f, y: y - v(D.RISE, 34) * sc, alpha: 0,
            duration: v(D.MS, 800), ease: 'Cubic.easeOut', onComplete: () => this._floatTextDone(f) });
    }

    // HOW HARD LANE i IS BEING CHASED, 0..1: by how many seconds its piggy
    // would take over the whole level distance (CHASE_FX.SPEED), times how
    // fast its tyres are turning — so it fades in and out with them.
    _chaseIntensity(i) {
        const S = (CONFIG.CHASE_FX || {}).SPEED || {}, v = (x, d) => (x !== undefined ? x : d);
        const C = CONFIG.CAR || {};
        const car = this.cars[i], slot = this.chargingSlots[i], lane = this.lanes && this.lanes[i];
        if (!car || !car.scene || !slot || !lane || !(slot.distPerSec > 0)) return { k: 0, p: 0 };
        const k = Math.min(1, (car.wheelSpeed || 0) / (v(C.SPIN_DEG_PER_SEC, 540) || 1));
        const secs = lane.total / slot.distPerSec;
        const slow = v(S.SLOW_SECS, 40), fast = v(S.FAST_SECS, 4);
        const p = Math.max(0, Math.min(1, (slow - secs) / Math.max(0.001, slow - fast)));
        const min = v(S.MIN, 0.35);
        return { k: k * (min + (1 - min) * p), p };
    }

    // SPEED LINES AND EXHAUST behind each driving piggy car, every frame, as
    // strong as its chase is quick (_chaseIntensity). One graphics for all
    // three lanes; the puffs are plain records drawn into it, not objects.
    _drawSpeedFx(delta) {
        const S = (CONFIG.CHASE_FX || {}).SPEED || {};
        if (S.ENABLED === false || !this.platforms) return;
        const v = (x, d) => (x !== undefined ? x : d);
        if (!this.speedFx || !this.speedFx.scene) {
            this.speedFx = this.add.graphics().setDepth(v(S.DEPTH, 3.85));
            this._puffs = []; this._puffAcc = [0, 0, 0]; this._fxT = 0;
        }
        const g = this.speedFx, sc = this.layoutConfig.platformScale, dt = Math.min(delta, 50) / 1000;
        const C = CONFIG.CAR || {}, EX = S.EXHAUST || {}, LL = S.LINE_LEN || [22, 70];
        const bw = v(C.BODY_W, 254), gy = this._carGround();
        const lineC = hexColor(S.LINE_COLOR || '#ffffff'), lineA = v(S.LINE_ALPHA, 0.6);
        const left = this.carArea ? this.carArea.x : 0;
        this._fxT += dt;
        g.clear();

        this.platforms.forEach((p, i) => {
            const car = this.cars[i];
            if (!car || !car.scene) return;
            const { k, p: pw } = this._chaseIntensity(i);
            if (k <= 0.01) { this._puffAcc[i] = 0; return; }
            const ground = p.slotY + p.slotSize / 2;
            const rear = car.x - car.carW / 2;

            // THE STREAKS: each its own pace and height (hashed, so steady),
            // sliding back from the bumper and fading in and out on the way.
            const n = v(S.LINES, 6);
            for (let m = 0; m < n; m++) {
                const h1 = this._cellHash(i, m, 11), h2 = this._cellHash(i, m, 12), h3 = this._cellHash(i, m, 13);
                const ph = (this._fxT * v(S.LINE_SPEED, 2.4) * (0.7 + 0.6 * h1) + h2) % 1;
                const len = (LL[0] + (LL[1] - LL[0]) * h1) * sc * (0.5 + 0.5 * pw);
                const x0 = rear - 6 * sc - ph * v(S.LINE_SPAN, 150) * sc;
                const x1 = Math.max(left, x0 - len);
                if (x0 <= x1) continue;
                const y = ground - car.carH * (0.18 + 0.62 * h3);
                g.lineStyle(Math.max(1, v(S.LINE_W, 3) * sc), lineC, lineA * k * Math.sin(Math.PI * ph));
                g.lineBetween(x1, y, x0, y);
            }

            // THE EXHAUST: puffs at a rate that rises with the chase.
            const rate = v((EX.RATE || [])[0], 1.5) + (v((EX.RATE || [])[1], 9) - v((EX.RATE || [])[0], 1.5)) * pw;
            this._puffAcc[i] += rate * k * dt;
            while (this._puffAcc[i] >= 1 && this._puffs.length < v(EX.MAX, 60)) {
                this._puffAcc[i] -= 1;
                const s = car.scaleX;
                const R = EX.R || [3, 6];
                this._puffs.push({
                    x: car.x + (-bw / 2 + v(EX.X, 6)) * s, y: car.y + (-gy + v(EX.Y, 86)) * s,
                    vx: -Phaser.Math.FloatBetween(30, 70) * sc, vy: -Phaser.Math.FloatBetween(4, 16) * sc,
                    r: Phaser.Math.FloatBetween(R[0], R[1]) * sc, age: 0,
                });
            }
            if (this._puffAcc[i] > 1) this._puffAcc[i] = 1;
        });

        // The puffs drift back, swell and fade.
        const life = v(EX.LIFE, 0.6), pc = hexColor(EX.COLOR || '#ffffff'), pa = v(EX.ALPHA, 0.55);
        this._puffs = this._puffs.filter((q) => (q.age += dt) < life);
        for (const q of this._puffs) {
            q.x += q.vx * dt; q.y += q.vy * dt;
            const a = q.age / life;
            g.fillStyle(pc, pa * (1 - a));
            g.fillCircle(q.x, q.y, q.r * (1 + 1.5 * a));
        }
    }

    // The distance the slots cover per second — the sum of the three.
    _slotPower() {
        let total = 0;
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) total += slot.distPerSec;
        }
        return total;
    }


    // ================================================================
    // STEERING — the slot piggies' wheels
    // ================================================================
    // Every piggy that went into a slot carries its own wheel sprite. Each
    // frame the wheel is laid over its piggy (wherever the piggy is — in the
    // slot, mid-drag, springing back) at the piggy's scale, and turned by its
    // slot's driver (CONFIG.STEERING). A piggy that has left the slots for the
    // grid gets its one-piece picture back and the wheel goes.
    _steerWheels(delta) {
        const dt = Math.min(delta, 50) / 1000;
        const ST = CONFIG.STEERING || {};
        const drivers = ST.DRIVERS || [];
        const at = ITEM_ART.WHEEL_AT;
        this.steeringItems = this.steeringItems.filter((bd) => {
            const spr = bd.sprite, wheel = bd.wheel;
            if (!wheel || !wheel.scene) return false;
            if (!spr || !spr.scene) { wheel.destroy(); return false; }
            // Off to the grid — the one-piece picture again, no wheel.
            if (!bd.inChargingSlot && bd !== this.draggingBattery) {
                wheel.destroy();
                bd.wheel = bd.steer = null;
                this.assets.dressWhenReady(spr, getBatteryIconLevel(bd.level));
                return false;
            }

            // THE DRIVER. Only while the piggy is actually sitting in its
            // slot; picked up, it lets go and the wheel drifts back to centre.
            const st = bd.steer;
            const slot = this.chargingSlots[bd.slotIndex];
            const driving = slot && slot.batteryData === bd && this._laneDriving(bd.slotIndex);
            const D = drivers[bd.slotIndex % Math.max(1, drivers.length)] || {};
            if (driving) {
                st.hold -= dt;
                if (st.hold <= 0) {
                    const r = Math.random(), side = Math.random() < 0.5 ? -1 : 1;
                    if (r < (D.CENTER_CHANCE || 0)) st.target = 0;
                    else if (r < (D.CENTER_CHANCE || 0) + (D.BIG_CHANCE || 0))
                        st.target = side * (D.BIG_DEG || 90) * (0.55 + 0.45 * Math.random());
                    else st.target = side * (D.SMALL_DEG || 20) * Math.random();
                    const lo = D.HOLD_MIN !== undefined ? D.HOLD_MIN : 0.5;
                    const hi = D.HOLD_MAX !== undefined ? D.HOLD_MAX : 1.5;
                    st.hold = lo + (hi - lo) * Math.random();
                }
            } else {
                st.target = 0;
            }
            // A spring toward the target: hands on a wheel, not a dial.
            const w = D.STIFFNESS || 5, z = D.DAMPING !== undefined ? D.DAMPING : 0.9;
            st.vel += (w * w * (st.target - st.angle) - 2 * z * w * st.vel) * dt;
            st.angle += st.vel * dt;

            // OVER THE PIGGY, at the piggy's scale — measured off its frame
            // the same way the two were drawn together (composeBattery).
            const f = spr.frame;
            const kx = f.realWidth / ITEM_ART.REF_W, ky = f.realHeight / ITEM_ART.REF_H;
            const cx = (at.x + at.size / 2) * kx, cy = (at.y + at.size / 2) * ky;
            wheel.setPosition(spr.x + (cx - spr.originX * f.realWidth) * spr.scaleX,
                              spr.y + (cy - spr.originY * f.realHeight) * spr.scaleY)
                .setScale(at.size * kx * spr.scaleX / wheel.frame.realWidth,
                          at.size * ky * spr.scaleY / wheel.frame.realHeight)
                .setAngle(st.angle)
                .setDepth(spr.depth + 0.5)
                .setAlpha(spr.alpha)
                .setVisible(!!wheel.ready && spr.visible);
            return true;
        });
    }

    
    
    
    
    
    
    
    


    // ================================================================
    // BATTERY MERGE GRID (BOTTOM HALF)
    // ================================================================
    createGrid() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        const gridW = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        
        // Grid panel centre is anchored to a fixed fraction of partA.height
        // (L.panelCenterY); cells are laid around it using the actual scale-sized
        // gridH. Horizontally centred in the half (works in both orientations).
        const gridStartY = L.panelCenterY - gridH / 2 + this.CELL_SIZE / 2;
        const gridStartX = L.partA.x + (L.partA.width - gridW) / 2 + this.CELL_SIZE / 2;
        const gridCenterX = L.partA.x + L.partA.width / 2;

        this.gridStartX = gridStartX;
        this.gridStartY = gridStartY;

        const pad  = L.panPad;
        const panW = gridW + 2 * pad;
        const panH = gridH + 2 * pad;
        const cx   = gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const cy   = gridStartY - this.CELL_SIZE / 2 + gridH / 2;

        // The panel is drawn, not art: a rounded square hugging the cells with a
        // small even padding. The old grid_panel.png carried a lot of baked
        // margin and shadow around the nine cells, which cost vertical space the
        // half does not have to spare.
        const C     = CONFIG.CELL;
        const panel = this.gridPanel = this.add.graphics().setDepth(3.4);   // over the slots (3)
        const radius = Math.round(C.GRID_PANEL_RADIUS * L.colScale);
        const border = Math.max(1, Math.round(C.GRID_PANEL_BORDER_WIDTH * L.colScale));
        panel.fillStyle(hexColor(C.GRID_PANEL_COLOR), 1);
        panel.fillRoundedRect(cx - panW / 2, cy - panH / 2, panW, panH, radius);
        if (border > 0) {
            panel.lineStyle(border, hexColor(C.GRID_PANEL_BORDER_COLOR), 1);
            panel.strokeRoundedRect(cx - panW / 2, cy - panH / 2, panW, panH, radius);
        }

        this._makeCellTextures(this.CELL_SIZE);
        for (let row = 0; row < this.GRID_ROWS; row++) {
            this.gridCells[row] = [];
            for (let col = 0; col < this.GRID_COLS; col++) {
                const x = gridStartX + col * (this.CELL_SIZE + this.CELL_GAP);
                const y = gridStartY + row * (this.CELL_SIZE + this.CELL_GAP);

                // Both states are the baked textures. The grain is mirrored per
                // cell — from the cell's own hash, so it survives a rebuild —
                // otherwise the same speckle pattern repeats nine times over.
                const fx = this._cellHash(col, row, 9) < 0.5;
                const fy = this._cellHash(col, row, 10) < 0.5;
                const face = (key, visible) => this.add.image(x, y, key)
                    .setDisplaySize(this.CELL_SIZE, this.CELL_SIZE)
                    .setFlipX(fx).setFlipY(fy)
                    .setDepth(3.5).setVisible(visible);
                const emptyCell = face('cell_empty',  true);
                const filledBg  = face('cell_filled', false);

                this.gridCells[row][col] = { x, y, row, col, isEmpty: true, cell: emptyCell, filledBg };
            }
        }
    }

    createCoinDisplay() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = L.panPad;
        const panW   = gridW + 2 * pad;
        const panH   = gridH + 2 * pad;
        
        // Unified: derive panel centre from gridStartX/Y (set by createGrid)
        const panCX   = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const panCY   = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
        const coinY     = L.coinCenterY;            // hangs off the panel's top edge
        const rightEdge = panCX + panW / 2;         // right-aligned to grid panel (relational)

        // Icon right edge aligns with grid panel right edge; scaled gap to text
        const iconX = rightEdge - L.coinIconSize / 2;
        this.coinIcon = this.add.image(iconX, coinY, 'coin')
            .setDisplaySize(L.coinIconSize, L.coinIconSize)
            .setDepth(10);

        const textX = iconX - L.coinIconSize / 2 - L.coinTextIconGap;
        this.coinText = this.add.text(textX, coinY, this._bigNum(this.coins), {
            fontSize: L.coinTextSize,
            fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.COIN_COUNTER.TEXT_COLOR,
            fontStyle: CONFIG.FONT_WEIGHT,
            stroke: CONFIG.COIN_COUNTER.TEXT_STROKE_COLOR,
            strokeThickness: CONFIG.COIN_COUNTER.TEXT_STROKE_THICKNESS,
        }).setOrigin(1, 0.5).setDepth(10);
    }

    // `animate` false: no spawn bounce — a pig being PUT BACK (a save
    // restored), not newly made, simply stands there at its size.
    async spawnBatteryInGrid(row, col, level, animate = true) {
        const cell = this.gridCells[row][col];
        const iconLvl = getBatteryIconLevel(level);

        const draggableBg = this.add.rectangle(
            cell.x, cell.y, this.CELL_SIZE, this.CELL_SIZE,
            hexColor(CONFIG.CELL.DRAGGABLE_BG_COLOR), CONFIG.CELL.DRAGGABLE_BG_ALPHA)
            .setDepth(10)
            .setInteractive({ draggable: true, useHandCursor: true });

        // BUILT NOW, whatever art is to hand (see AssetManager.iconKey). The
        // cell is filled on this frame, so nothing can be dropped into it while
        // a picture downloads.
        const battery = fitItemIcon(this.add.image(cell.x, cell.y + this.batteryYOffset,
                this.assets.iconKey(iconLvl)), this.batteryDisplayW, this.batteryDisplayH)
            .setDepth(11);
        this.assets.dressWhenReady(battery, iconLvl);

        const levelText = this.add.text(
            cell.x, cell.y + this.batteryYOffset + this.levelTextYOffset,
            `PIGGY ${level}`,
            { fontSize: this.levelTextSize, fontFamily: CONFIG.FONT_FAMILY,
              color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: CONFIG.FONT_WEIGHT })
            .setOrigin(0.5).setDepth(12);

        const batteryData = {
            draggableBg, sprite: battery, levelText, level, row, col,
            originalX: cell.x,
            originalY: cell.y + this.batteryYOffset,
            inGrid: true, inChargingSlot: false,
        };
        draggableBg.setData('batteryData', batteryData);
        this.batteries.push(batteryData);
        this.grid[row][col] = batteryData;
        cell.filledBg.setVisible(true);
        cell.isEmpty = false;
        if (animate) this.playSpawnAnimation(batteryData);
        return batteryData;
    
    }

    playSpawnAnimation(bd) {
        // The icon is no longer square, so the squash and stretch has to run
        // off its two sides separately rather than one figure for both.
        //
        // ON THE SPRITE'S SCALE, NOT ITS ON-SCREEN SIZE. A pig whose picture is
        // still downloading wears a stand-in — maybe Phaser's 32×32 missing
        // texture — and swaps to its own mid-bounce (dressWhenReady). A swap
        // keeps the SCALE, which is the same for every pig picture (see
        // fitItemIcon); a bounce tweening the stand-in's pixel size would end
        // on that size and squeeze the real picture into it, leaving the pig
        // small for good.
        const bx = bd.sprite.scaleX, by = bd.sprite.scaleY;
        const a    = CONFIG.SPAWN_ANIMATION;
        bd.sprite.setScale(bx * a.INITIAL_SCALE_X, by * a.INITIAL_SCALE_Y);
        bd.levelText.setScale(a.INITIAL_SCALE_X, a.INITIAL_SCALE_Y);
        const seq = [
            [a.STRETCH_SCALE_X, a.STRETCH_SCALE_Y, a.STRETCH_DURATION],
            [a.BOUNCE_SCALE_X,  a.BOUNCE_SCALE_Y,  a.BOUNCE_DURATION],
            [1, 1, a.SETTLE_DURATION],
        ];
        let chain = Promise.resolve();
        seq.forEach(([sx, sy, dur]) => {
            chain = chain.then(() => new Promise(res => {
                this.tweens.add({
                    targets: bd.sprite,
                    scaleX: bx * sx, scaleY: by * sy,
                    duration: dur, ease: 'Cubic.easeOut', onComplete: res,
                });
                this.tweens.add({
                    targets: bd.levelText, scaleX: sx, scaleY: sy,
                    duration: dur, ease: 'Cubic.easeOut',
                });
            }));
        });
    }

    async createButtons() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        // Spawn button: horizontally centred, vertically at a fixed fraction of partA.height
        const spawnButtonX = L.partA.x + L.partA.width / 2;
        const spawnButtonY = L.buttonCenterY;
        // Level-up sits to the left of spawn at the same Y (horizontal gap × sW)
        const levelUpButtonX = spawnButtonX - L.spawnBtnDisplayW / 2 - 20 * L.sW - L.spawnBtnDisplayH * 0.44;
        const levelUpButtonY = spawnButtonY;

        // Spawn button
        const spawnBtn = this.add.container(spawnButtonX, spawnButtonY).setDepth(100);
        const spawnBg  = this.add.image(0, 0, 'button')
            .setDisplaySize(L.spawnBtnDisplayW, L.spawnBtnDisplayH)
            .setInteractive({ useHandCursor: true });
        this.spawnButtonText = this.add.text(
            L.spawnCoinTextX, 0, this._bigNum(this.spawnCost), {
                fontSize: L.spawnCoinTextSize, fontFamily: CONFIG.FONT_FAMILY,
                color: '#2b2013', fontStyle: CONFIG.FONT_WEIGHT,   // near-black, not pure
            }).setOrigin(0.5);
        const spawnCoinIcon = this.add.image(L.spawnCoinIconX, 0, 'coin')
            .setDisplaySize(L.spawnCoinIconSize, L.spawnCoinIconSize);

        spawnBtn.add([spawnBg, this.spawnButtonText, spawnCoinIcon]);
        spawnBg.on('pointerdown', () => this.spawnBattery());
        this.spawnButton   = spawnBtn;
        this.spawnButtonBg = spawnBg;
        this.spawnButtonIcon = null;

        // The button's own battery, drawn at once with whatever art exists and
        // dressed in its own when that lands — the button is pressable from the
        // first frame, so its icon must be there from the first frame too.
        const iconLvl = getBatteryIconLevel(this.spawnButtonLevel);
        const spawnIcon = fitItemIcon(this.add.image(L.spawnBattIconX, 0, this.assets.iconKey(iconLvl)),
            L.spawnBattIconSize, L.spawnBattIconSize);
        this.assets.dressWhenReady(spawnIcon, iconLvl);
        spawnBtn.add(spawnIcon);
        this.spawnButtonIcon = spawnIcon;

        // Level-up button — one sprite, everything baked in (text, icon, the
        // lot), so it is drawn and wired exactly like any other icon button:
        // no separate label or fill to keep in step with it.
        const lvlBtn = this.add.container(levelUpButtonX, levelUpButtonY).setDepth(100);
        const lvlBg  = this.add.image(0, 0, 'upgrade_button')
            .setDisplaySize(L.spawnBtnDisplayH * 0.88, L.spawnBtnDisplayH * 0.88)
            .setInteractive({ useHandCursor: true });
        lvlBtn.add(lvlBg);
        lvlBg.on('pointerdown', () => { if (this.levelUpButtonVisible) this.levelUpAll(); });
        this.levelUpButton   = lvlBtn;
        this.levelUpButtonBg = lvlBg;
        this.levelUpButton.setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonShowTime = null;

    }

    createStartOverlay() {
        // Dev toggle: with the tutorial off there is no mask and no pointer, and
        // play starts immediately (removeStartOverlay's side effects run here).
        if (!CONFIG.POINTER.TUTORIAL_ENABLED) {
            this.startOverlay = null;
            this.startPointer = null;
            this.hasStartedPlaying = true;
            this.levelUpTimer = this.time.now;
            this.firstLevelUpTimer = true;
            return;
        }
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        // Use actual camera/game dimensions for the overlay rect to ensure full coverage
        const gameW = this.cameras.main.width;
        const gameH = this.cameras.main.height;
        
        const maskColor = parseInt(CONFIG.POINTER.TUTORIAL_MASK_COLOR.substring(1), 16);
        this.startOverlay = this.add.rectangle(gameW / 2, gameH / 2, gameW, gameH, maskColor,
            CONFIG.POINTER.TUTORIAL_MASK_OPACITY).setAlpha(0).setDepth(99);

        // THE RULE BETWEEN THE HALVES IS HIDDEN, not masked. It is one thin
        // rule; taking it away for the length of the tutorial costs nothing and
        // dims nothing else.
        this._showSplitLine(false);

        // Position pointer based on spawn button location
        let pointerX = this.spawnButton.x;
        const pY = this.spawnButton.y + CONFIG.POINTER.OFFSET_Y;
        
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pCont = this.add.container(pointerX, pY).setAlpha(0).setDepth(102);
        for (let a = 0; a < 360; a += 45) {
            const rad = a * Math.PI / 180;
            const sc  = this.add.image(
                Math.cos(rad) * CONFIG.POINTER.STROKE_WIDTH,
                Math.sin(rad) * CONFIG.POINTER.STROKE_WIDTH, 'point')
                .setScale(CONFIG.POINTER.SCALE).setTint(strokeColor).setOrigin(0.5, 0);
            pCont.add(sc);
        }
        const fp = this.add.image(0, 0, 'point')
            .setScale(CONFIG.POINTER.SCALE).setTint(fillColor).setOrigin(0.5, 0);
        pCont.add(fp);
        this.startPointer = pCont;

        this.time.delayedCall(CONFIG.POINTER.TUTORIAL_START_DELAY, () => {
            if (!this.startOverlay || !pCont.active) return;
            this._shadePage(CONFIG.POINTER.TUTORIAL_MASK_COLOR, CONFIG.POINTER.TUTORIAL_MASK_OPACITY,
                CONFIG.POINTER.TUTORIAL_FADE_DURATION);
            this.tweens.add({
                targets: this.startOverlay, alpha: 1,
                duration: CONFIG.POINTER.TUTORIAL_FADE_DURATION, ease: 'Linear',
                onComplete: () => {
                    if (!pCont.active) return;
                    pCont.setAlpha(1);
                    this.tweens.add({
                        targets: pCont,
                        y: pY - CONFIG.POINTER.ANIMATION_MOVE_UP,
                        scaleX: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                        scaleY: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                        duration: CONFIG.POINTER.ANIMATION_DURATION,
                        yoyo: CONFIG.POINTER.ANIMATION_YOYO,
                        repeat: CONFIG.POINTER.ANIMATION_REPEAT,
                    });
                },
            });
        });
    }

    // THE PAGE AROUND THE CANVAS, SHADED WITH AN OVERLAY. An overlay is drawn
    // inside the canvas, but on a frame whose shape the stage does not match
    // exactly, a strip of the page (html/body, the ground's #d5ba95) shows
    // round it — invisible normally, a bright line once the game is darkened.
    // So the page takes the colour the overlay makes over the ground, fading
    // with it: `color` + `alpha` the overlay's, null to put the page back.
    _shadePage(color, alpha, ms) {
        if (typeof document === 'undefined') return;
        const ground = '#d5ba95';
        let css = '';
        if (color) {
            const g = hexColor(ground), c = hexColor(color), a = Math.max(0, Math.min(1, alpha));
            const mix = (sh) => Math.round(((g >> sh) & 255) * (1 - a) + ((c >> sh) & 255) * a);
            css = `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
        }
        for (const el of [document.documentElement, document.body]) {
            if (!el) continue;
            el.style.transition = ms > 0 ? `background-color ${ms}ms linear` : '';
            el.style.backgroundColor = css || ground;
        }
    }

    removeStartOverlay() {
        if (!this.startOverlay) return;
        this._shadePage(null);
        this.startOverlay.destroy();
        if (this.startPointer) this.startPointer.destroy();
        this.startOverlay = null;
        this._showSplitLine(true);
        this.hasStartedPlaying = true;
        this.levelUpTimer = this.time.now;
        this.firstLevelUpTimer = true;
        this._showWanted();
    }

    checkAndShowMergeTutorial() {
        if (!CONFIG.MERGE_TUTORIAL.ENABLED) return;   // disabled during development
        // AT LEAST two, not exactly two.
        //
        // An exact test only passes on the single frame the count is 2, and the
        // count does not only count spawns: a battery moved into a charging slot
        // leaves this list, so two on the grid can read as one. Miss that frame
        // and the lesson can never appear, because the number only climbs — which
        // is why it seemed to need three batteries rather than two.
        if (!this.mergeTutorialShown && this.batteries.length >= 2 && !this.mergePointer) {
            this.createMergeTutorial();
        }
    }

    createMergeTutorial() {
        const x1 = this.gridStartX;
        const y1 = this.gridStartY;
        const x2 = this.gridStartX + (this.CELL_SIZE + this.CELL_GAP);
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pc = this.add.container(x1, y1).setDepth(102);
        for (let a = 0; a < 360; a += 45) {
            const rad = a * Math.PI / 180;
            const sc  = this.add.image(
                Math.cos(rad) * CONFIG.POINTER.STROKE_WIDTH,
                Math.sin(rad) * CONFIG.POINTER.STROKE_WIDTH, 'point')
                .setScale(CONFIG.POINTER.SCALE).setTint(strokeColor).setOrigin(0.5, 0);
            pc.add(sc);
        }
        const fp = this.add.image(0, 0, 'point')
            .setScale(CONFIG.POINTER.SCALE).setTint(fillColor).setOrigin(0.5, 0);
        pc.add(fp);
        this.tweens.add({
            targets: pc, x: x2,
            duration: CONFIG.MERGE_TUTORIAL.ANIMATION_DURATION,
            ease: CONFIG.MERGE_TUTORIAL.ANIMATION_EASE,
            yoyo: false, repeat: -1, repeatDelay: 200,
        });
        this.mergePointer = pc;
    }

    removeMergeTutorial() {
        if (this.mergePointer) {
            this.mergePointer.destroy();
            this.mergePointer = null;
            this.mergeTutorialShown = true;
        }
    }

    // A MERGE HAPPENED — whether or not the hand was being shown for it.
    //
    // The next lesson used to be scheduled inside removeMergeTutorial, which
    // only runs when that pointer is up. A player who merged without ever seeing
    // the hand — merged early, or merged again later — got no arrows at all,
    // because the thing that starts their clock had nothing to remove.
    _afterMerge() {
        this.removeMergeTutorial();
        const H = CONFIG.SLOT_HINT || {};
        if (H.ENABLED === false || this.slotHintDone || this.slotHintPending) return;
        this.slotHintPending = true;
        this.time.delayedCall(H.DELAY_MS !== undefined ? H.DELAY_MS : 900,
            () => { this.slotHintPending = false; this._showSlotHint(); });
    }

    // AN ARROW AT EACH EMPTY SLOT, nodding toward it.
    //
    // Three of them rather than one, because the lesson is about the column: a
    // single arrow would read as "that slot", and the player would wonder what
    // the other two are for. In-and-back rather than a full bounce — the motion
    // has to point, and a symmetric bob points at nothing.
    //
    // FROM THE RIGHT, in both orientations: the slots are stacked, so above and
    // below each one are its neighbours, and the empty car area beside the
    // column is the one clear approach.
    _showSlotHint() {
        const H = CONFIG.SLOT_HINT || {};
        if (H.ENABLED === false || this.slotHintDone || this.slotHints) return;
        if (!this.platforms) return;
        // PER SLOT: one already filled has had its lesson, and an arrow
        // pointing at a job already done is worse than no arrow. The others
        // keep theirs until each gets its own first pig.
        for (let i = 0; i < 3; i++) {
            if (this.chargingSlots && this.chargingSlots[i]) this.slotHintSeen[i] = true;
        }
        if (this.slotHintSeen.every(Boolean)) { this.slotHintDone = true; return; }

        const s = this.layoutConfig.scale;
        const P = CONFIG.POINTER || {};
        const HI = CONFIG.HINT_ICON || {};
        const len  = (H.SIZE || 23) * s;
        this.slotHints = [null, null, null];
        this.platforms.forEach((p, i) => {
            if (!p || p.slotX === undefined || this.slotHintSeen[i]) return;
            const lot = this.slotHints[i] = [];
            const size = p.slotSize || (100 * s);
            // DRAWN, rather than drawn
            // ON: one shape, one outline, no art file, and it turns to face
            // whichever way the layout needs without a second drawing.
            const arrow = this._makeArrow('w', len,
                    len * (H.W_FRAC !== undefined ? H.W_FRAC : 1.35),
                    P.FILL_COLOR || '#ffd251', P.STROKE_COLOR || '#6d5727',
                    (P.STROKE_WIDTH || 3) * s)
                // OVER EVERYTHING IT CAN CROSS — coins in flight (100+)
                // included. Still under a pig being dragged (10000+).
                .setDepth(121).setAlpha(0);
            // IT CROSSES THE SLOT'S EDGE rather than hovering outside it. The
            // crossing is what reads as "in here" instead of "over there".
            const run = (H.TRAVEL !== undefined ? H.TRAVEL : 0.193) * size;
            const gap = (H.SIDE_GAP !== undefined ? H.SIDE_GAP : 0.12) * size;

            // THE PIG, ON THE FAR SIDE OF THE ARROW FROM THE SLOT — to its
            // right — so "pig, then arrow, then slot" reads as "drag the pig in
            // here". It rides along with the arrow (same relative travel from
            // each one's own start), so the two never drift apart. See
            // CONFIG.HINT_ICON.
            const iconSize = (HI.SIZE !== undefined ? HI.SIZE : 32) * s;
            const iconGap  = (HI.GAP !== undefined ? HI.GAP : 4) * s;
            let icon = null;
            const x0 = p.slotX + size / 2 + gap + len / 2;
            arrow.setPosition(x0, p.slotY);
            if (HI.ENABLED !== false && this.textures.exists('pig_hint')) {
                icon = this.add.image(x0 + len / 2 + iconGap + iconSize / 2, p.slotY, 'pig_hint')
                    .setDisplaySize(iconSize, iconSize)
                    .setDepth(120)    // just behind its arrow (121)
                    .setAlpha(0);
            }
            this.tweens.add({ targets: icon ? [arrow, icon] : arrow, x: `-=${run}`,
                duration: H.MS || 380, ease: H.EASE || 'Sine.easeInOut',
                yoyo: true, repeat: -1 });

            this.tweens.add({ targets: arrow, alpha: 1,
                duration: H.FADE_MS !== undefined ? H.FADE_MS : 260 });
            if (icon) {
                this.tweens.add({ targets: icon,
                    alpha: HI.ALPHA !== undefined ? HI.ALPHA : 0.6,
                    duration: H.FADE_MS !== undefined ? H.FADE_MS : 260 });
                lot.push(icon);
            }
            lot.push(arrow);
        });
    }

    // ONE ARROW, DRAWN. A filled triangle with an outline, its apex on the
    // object's own origin line and pointing `dir` ('s' down, 'e' right, 'n', 'w')
    // — so placing one is a single point wherever it is used. `len` is along the
    // way it points, `wide` across.
    _makeArrow(dir, len, wide, fill, stroke, strokeW) {
        const g = this.add.graphics();
        g.fillStyle(hexColor(fill), 1);
        g.lineStyle(Math.max(1, strokeW || 2), hexColor(stroke), 1);
        const L = len / 2, W = wide / 2;
        const pts = dir === 'e' ? [[-L, -W], [-L, W], [L, 0]]
                  : dir === 'w' ? [[L, -W], [L, W], [-L, 0]]
                  : dir === 'n' ? [[-W, L], [W, L], [0, -L]]
                  :               [[-W, -L], [W, -L], [0, L]];   // 's'
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        g.lineTo(pts[1][0], pts[1][1]);
        g.lineTo(pts[2][0], pts[2][1]);
        g.closePath();
        g.fillPath();
        g.strokePath();
        return g;
    }

    // Gone for good from THIS slot once its first battery is in; the other
    // slots keep theirs. `slotHintSeen` is what stops it coming back when the
    // slot is later emptied — the lesson was learnt, and a hint that returns
    // reads as the game not having noticed.
    _hideSlotHint(slotIndex) {
        this.slotHintSeen[slotIndex] = true;
        if (this.slotHintSeen.every(Boolean)) this.slotHintDone = true;
        const lot = this.slotHints && this.slotHints[slotIndex];
        if (!lot) return;
        this.slotHints[slotIndex] = null;
        const H = CONFIG.SLOT_HINT || {};
        for (const img of lot) {
            if (!img || !img.scene) continue;
            this.tweens.killTweensOf(img);
            this.tweens.add({ targets: img, alpha: 0,
                duration: H.FADE_MS !== undefined ? H.FADE_MS : 260,
                onComplete: () => img.destroy() });
        }
    }

    spawnBattery() {
        if (this.isWatchingAd) return;  // Block spawning during ad
        if (this.coins < this.spawnCost) return;
        let emptyCell = null;
        outer: for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                if (!this.grid[row][col]) { emptyCell = { row, col }; break outer; }
            }
        }
        if (!emptyCell) return;
        this.coins -= this.spawnCost;
        this.updateCoinDisplay();
        // AFTER THE BATTERY ACTUALLY EXISTS. Spawning is async — it waits on the
        // battery's texture before the new battery joins the list — so a check
        // fired on the next line counts the grid as it was BEFORE this spawn.
        // That is one battery behind, which is why the merge lesson appeared a
        // click late: two on the grid still read as one.
        this.spawnBatteryInGrid(emptyCell.row, emptyCell.col, this.spawnButtonLevel)
            .then(() => this.checkAndShowMergeTutorial());
        if (this.startOverlay) this.removeStartOverlay();
        this.updateSpawnButton();
    }

    async updateSpawnButton() {
        if (this.highestBatteryLevel >= 9) {
            const nl = this.highestBatteryLevel - 7;
            if (nl > this.spawnButtonLevel) {
                this.spawnButtonLevel = nl;
                this.spawnCost = nl * CONFIG.ECONOMY.SPAWN_COST_PER_LEVEL;
                this.spawnButtonText.setText(this._bigNum(this.spawnCost));
                const iconLvl = getBatteryIconLevel(nl);
                if (this.spawnButtonIcon) {
                    itemPigOrigin(this.spawnButtonIcon.setTexture(this.assets.iconKey(iconLvl)));
                    this.assets.dressWhenReady(this.spawnButtonIcon, iconLvl);
                }
            }
        }
        if (this.coins < this.spawnCost) {
            this.spawnButtonBg.setTint(0x888888).disableInteractive();
        } else {
            this.spawnButtonBg.setTint(0xffffff).setInteractive({ useHandCursor: true });
        }
    }

    // ================================================================
    // DRAG / DROP
    // ================================================================
    onDragStart(pointer, gameObject) {
        if (this.isWatchingAd) return;  // Block dragging during ad
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        this.draggingBattery = bd;

        if (bd.inChargingSlot) {
            const p = this.platforms[bd.slotIndex];
            this.chargingSlots[bd.slotIndex] = null;
            p.slotBg.setVisible(true);
            p.slotBgFilled.setVisible(false);
            p.chargeRateText.setVisible(false);
            p.batterySprite = p.batteryLevelText = null;
        }
        if (bd.draggableBg) bd.draggableBg.setDepth(10000);
        bd.sprite.setDepth(10001);
        bd.levelText.setDepth(10002);
        // HIDDEN WHILE HELD — "PIGGY 5" following the finger under the drag
        // adds a second thing to read right where the player is looking at
        // the art itself. It comes back the moment the drag ends, whatever
        // the outcome (see onDragEnd) — dropped, swapped, merged or bounced
        // back, there is always a fresh or restored levelText to show again.
        bd.levelText.setVisible(false);
        if (this.startOverlay) this.removeStartOverlay();
    }

    onDrag(pointer, gameObject, dragX, dragY) {
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        if (bd.draggableBg) { bd.draggableBg.x = dragX; bd.draggableBg.y = dragY; }
        bd.sprite.setPosition(dragX, dragY);
        bd.levelText.setPosition(dragX, dragY + this.levelTextYOffset);
        if (bd.inGrid) {
            const cd = this.gridCells[bd.row][bd.col];
            const b  = new Phaser.Geom.Rectangle(
                cd.x - this.CELL_SIZE / 2, cd.y - this.CELL_SIZE / 2,
                this.CELL_SIZE, this.CELL_SIZE);
            cd.filledBg.setVisible(Phaser.Geom.Rectangle.Contains(b, dragX, dragY));
        }
    }

    onDragEnd(pointer, gameObject) {
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        // BACK ON, before whatever the drop resolves to. A plain move or
        // swap keeps this same levelText, which needs showing again; a merge
        // destroys it in favour of a fresh one on the result, which is
        // visible by default — so unconditionally is correct either way.
        bd.levelText.setVisible(true);
        const dx = bd.sprite.x;
        const dy = bd.sprite.y;

        // Check platform slots first
        for (let i = 0; i < this.platforms.length; i++) {
            const p    = this.platforms[i];
            const half = p.slotSize / 2;
            if (Math.abs(dx - p.slotX) <= half && Math.abs(dy - p.slotY) <= half) {
                this.handleDropOnPlatformSlot(i, bd);
                this.draggingBattery = null;
                return;
            }
        }

        // Check grid cells
        for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                const cd = this.gridCells[row][col];
                if (Math.abs(dx - cd.x) <= this.CELL_SIZE / 2 &&
                    Math.abs(dy - cd.y) <= this.CELL_SIZE / 2) {
                    this.handleDrop(bd, { row, col, cellData: cd });
                    this.draggingBattery = null;
                    return;
                }
            }
        }
        this.returnBatteryToPosition(bd);
        this.draggingBattery = null;
    }

    handleDropOnPlatformSlot(slotIndex, bd) {
        const slot = this.chargingSlots[slotIndex];
        if (slot === null) {
            this.moveBatteryToSlot(bd, slotIndex);
        } else if (bd.inChargingSlot && bd.slotIndex === slotIndex) {
            this.returnBatteryToPosition(bd);
        } else if (slot.batteryData.level === bd.level) {
            this.mergeBatteriesInSlot(bd, slot.batteryData, slotIndex);
        } else {
            this.swapBatteryWithSlot(bd, slot.batteryData, slotIndex);
        }
    }

    handleDrop(bd, target) {
        const tBat = this.grid[target.row][target.col];
        if (!tBat)              this.moveBattery(bd, target.row, target.col);
        else if (tBat === bd)   this.returnBatteryToPosition(bd);
        else if (tBat.level === bd.level) this.mergeBatteries(bd, tBat, target.row, target.col);
        // FROM A SLOT ONTO AN OCCUPIED CELL. swapBatteries reads both batteries'
        // grid positions, and one dragged out of a charging slot has none — so
        // it left the slot's battery lying loose over the cell with the board
        // believing it was still in its slot. The two change places instead,
        // which is what the same drag does in the other direction.
        else if (bd.inChargingSlot) this.swapSlotWithCell(bd, tBat, target.row, target.col);
        else                    this.swapBatteries(bd, tBat);
    }

    // ================================================================
    // BATTERY OPERATIONS
    // ================================================================
    _clearBatterySource(bd) {
        if (bd.inGrid) {
            this.grid[bd.row][bd.col] = null;
            this.gridCells[bd.row][bd.col].filledBg.setVisible(false);
            this.gridCells[bd.row][bd.col].isEmpty = true;
        } else if (bd.inChargingSlot) {
            const p = this.platforms[bd.slotIndex];
            this.chargingSlots[bd.slotIndex] = null;
            p.slotBg.setVisible(true);
            p.slotBgFilled.setVisible(false);
            p.batterySprite = p.batteryLevelText = null;
        }
    }

    moveBattery(bd, newRow, newCol) {
        this._clearBatterySource(bd);
        bd.row  = newRow; bd.col = newCol;
        bd.inGrid = true; bd.inChargingSlot = false;
        this.grid[newRow][newCol] = bd;
        if (!this.batteries.includes(bd)) this.batteries.push(bd);
        const cd = this.gridCells[newRow][newCol];
        bd.originalX = cd.x;
        bd.originalY = cd.y + this.batteryYOffset;
        this.returnBatteryToPosition(bd);
        cd.filledBg.setVisible(true);
        cd.isEmpty = false;
    }

    mergeBatteries(dragged, target, tRow, tCol) {
        this._afterMerge();
        this.removeBattery(dragged);
        this.removeBattery(target);
        const newLevel = target.level + 1;
        this.spawnBatteryInGrid(tRow, tCol, newLevel);
        if (newLevel > this.highestBatteryLevel) {
            this.highestBatteryLevel = newLevel; this.updateSpawnButton();
            this.assets.prefetchAhead(newLevel + 1);
        }
        this.createMergeEffect(this.gridCells[tRow][tCol].x, this.gridCells[tRow][tCol].y);
    }

    // A battery dragged out of a CHARGING SLOT onto an occupied grid cell: the
    // two change places. Both are taken off the board and rebuilt on the other
    // side, the same way a grid-to-slot swap works — a battery's record carries
    // where it lives, so moving one is remaking it rather than editing it.
    swapSlotWithCell(bd, tBat, row, col) {
        const si = bd.slotIndex, lvSlot = bd.level, lvGrid = tBat.level;
        const p  = this.platforms[si];
        this.removeBattery(bd);           // empties the slot it came from
        if (p && p.chargeRateText) p.chargeRateText.setVisible(false);
        this.removeBattery(tBat);         // empties the cell it was dropped on
        this.spawnBatteryInGrid(row, col, lvSlot);
        this.addBatteryToSlot(si, lvGrid);
    }

    swapBatteries(b1, b2) {
        const r1 = b1.row, c1 = b1.col, r2 = b2.row, c2 = b2.col;
        this.grid[r1][c1] = b2; this.grid[r2][c2] = b1;
        b1.row = r2; b1.col = c2;
        b1.originalX = this.gridCells[r2][c2].x;
        b1.originalY = this.gridCells[r2][c2].y + this.batteryYOffset;
        b2.row = r1; b2.col = c1;
        b2.originalX = this.gridCells[r1][c1].x;
        b2.originalY = this.gridCells[r1][c1].y + this.batteryYOffset;
        this.returnBatteryToPosition(b1);
        this.returnBatteryToPosition(b2);
    }

    moveBatteryToSlot(bd, slotIndex) {
        if (bd.inGrid) {
            this.removeBattery(bd);
        } else if (bd.inChargingSlot) {
            const oldSI = bd.slotIndex;
            const oldP  = this.platforms[oldSI];
            this.chargingSlots[oldSI] = null;
            oldP.slotBg.setVisible(true);
            oldP.slotBgFilled.setVisible(false);
            oldP.chargeRateText.setVisible(false);
            oldP.batterySprite = oldP.batteryLevelText = null;
            if (bd.draggableBg) { bd.draggableBg.destroy(); bd.draggableBg = null; }
            if (bd.sprite)    bd.sprite.destroy();
            if (bd.levelText) bd.levelText.destroy();
        }
        this.addBatteryToSlot(slotIndex, bd.level);
    }

    swapBatteryWithSlot(b1, b2, slotIndex) {
        if (b1.inGrid) {
            const r1 = b1.row, c1 = b1.col;
            const lv2 = b2.level;
            this.removeBattery(b1);
            const p2 = this.platforms[slotIndex];
            this.chargingSlots[slotIndex] = null;
            p2.slotBg.setVisible(true);
            p2.slotBgFilled.setVisible(false);
            p2.chargeRateText.setVisible(false);
            if (b2.draggableBg) { b2.draggableBg.destroy(); b2.draggableBg = null; }
            if (b2.sprite)    b2.sprite.destroy();
            if (b2.levelText) b2.levelText.destroy();
            p2.batterySprite = p2.batteryLevelText = null;
            this.spawnBatteryInGrid(r1, c1, lv2);
            this.addBatteryToSlot(slotIndex, b1.level);
        } else if (b1.inChargingSlot) {
            const si1 = b1.slotIndex, si2 = slotIndex;
            const lv1 = b1.level, lv2 = b2.level;
            [b1, b2].forEach(b => {
                if (b.draggableBg) { b.draggableBg.destroy(); b.draggableBg = null; }
                if (b.sprite)    b.sprite.destroy();
                if (b.levelText) b.levelText.destroy();
            });
            const p1 = this.platforms[si1], p2 = this.platforms[si2];
            this.chargingSlots[si1] = this.chargingSlots[si2] = null;
            p1.batterySprite = p1.batteryLevelText = null;
            p2.batterySprite = p2.batteryLevelText = null;
            p1.slotBg.setVisible(true); p1.slotBgFilled.setVisible(false);
            p2.slotBg.setVisible(true); p2.slotBgFilled.setVisible(false);
            p1.chargeRateText.setVisible(false);
            p2.chargeRateText.setVisible(false);
            this.addBatteryToSlot(si1, lv2);
            this.addBatteryToSlot(si2, lv1);
        }
    }

    mergeBatteriesInSlot(dragged, target, targetSlotIndex) {
        this._afterMerge();
        if (dragged.inGrid) {
            this.removeBattery(dragged);
        } else if (dragged.inChargingSlot) {
            const si = dragged.slotIndex;
            const op = this.platforms[si];
            this.chargingSlots[si] = null;
            if (dragged.draggableBg) { dragged.draggableBg.destroy(); dragged.draggableBg = null; }
            if (dragged.sprite)    dragged.sprite.destroy();
            if (dragged.levelText) dragged.levelText.destroy();
            op.batterySprite = op.batteryLevelText = null;
            op.slotBg.setVisible(true); op.slotBgFilled.setVisible(false);
            op.chargeRateText.setVisible(false);
        }
        const tp = this.platforms[targetSlotIndex];
        this.chargingSlots[targetSlotIndex] = null;
        if (target.draggableBg) { target.draggableBg.destroy(); target.draggableBg = null; }
        if (target.sprite)    target.sprite.destroy();
        if (target.levelText) target.levelText.destroy();
        tp.batterySprite = tp.batteryLevelText = null;
        tp.slotBg.setVisible(true); tp.slotBgFilled.setVisible(false);
        tp.chargeRateText.setVisible(false);

        const newLevel = target.level + 1;
        this.addBatteryToSlot(targetSlotIndex, newLevel);
        if (newLevel > this.highestBatteryLevel) {
            this.highestBatteryLevel = newLevel; this.updateSpawnButton();
            this.assets.prefetchAhead(newLevel + 1);
        }
        this.createMergeEffect(tp.slotX, tp.slotY);
    }

    removeBattery(bd) {
        this._clearBatterySource(bd);
        const idx = this.batteries.indexOf(bd);
        if (idx > -1) this.batteries.splice(idx, 1);
        if (bd.draggableBg) bd.draggableBg.destroy();
        bd.sprite.destroy();
        bd.levelText.destroy();
    }

    returnBatteryToPosition(bd) {
        if (bd.draggableBg) bd.draggableBg.setDepth(10);
        bd.sprite.setDepth(11);
        bd.levelText.setDepth(12);

        if (bd.inChargingSlot) {
            const p  = this.platforms[bd.slotIndex];
            const cpm = getBatteryChargeValue(bd.level);
            this.chargingSlots[bd.slotIndex] = { level: bd.level, distPerSec: cpm, batteryData: bd };
            p.slotBgFilled.setVisible(true);
            p.batterySprite    = bd.sprite;
            p.batteryLevelText = bd.levelText;
            p.chargeRateText.setText(this._rateText(cpm)).setVisible(true);
            }

        if (bd.inGrid) {
            const cd = this.gridCells[bd.row][bd.col];
            cd.filledBg.setVisible(true);
            cd.isEmpty = false;
        }

        const tY = bd.originalY + this.levelTextYOffset;
        if (bd.draggableBg) {
            this.tweens.add({
                targets: bd.draggableBg,
                x: bd.originalX,
                y: bd.originalY - this.batteryYOffset,
                duration: 200, ease: 'Back.easeOut',
            });
        }
        this.tweens.add({ targets: bd.sprite,    x: bd.originalX, y: bd.originalY, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: bd.levelText, x: bd.originalX, y: tY,           duration: 200, ease: 'Back.easeOut' });
    }

    // OFF ON PURPOSE. This used to draw a white circle that scaled up and
    // faded at the merge point; removed at the art's request. Left as a no-op
    // rather than deleted from both call sites, so a merge effect can come
    // back here without re-wiring where it fires from.
    createMergeEffect(x, y) {}

    // ================================================================
    // LEVEL-UP TIMER
    // ================================================================
    checkLevelUpTimer() {
        if (!this.hasStartedPlaying) return;
        const now = this.time.now;
        if (this.levelUpButtonVisible && this.levelUpButtonShowTime) {
            if (now - this.levelUpButtonShowTime >= 30000) {
                this.tweens.killTweensOf(this.levelUpButton);
                this.levelUpButton.setScale(1).setVisible(false);
                this.levelUpButtonVisible = false;
                this.levelUpButtonBg.setAlpha(0.5);
                this.levelUpTimer = now;
            }
        } else if (!this.levelUpButtonVisible && this.levelUpTimer) {
            const wait = this.firstLevelUpTimer ? 20000 : 30000;
            if (now - this.levelUpTimer >= wait) {
                this.levelUpButton.setVisible(true);
                this.levelUpButtonVisible = true;
                this.levelUpButtonBg.setAlpha(1);
                this.levelUpButtonShowTime = now;
                this.firstLevelUpTimer = false;
                this.tweens.add({
                    targets: this.levelUpButton,
                    scaleX: 1.05, scaleY: 1.05, duration: 300,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        }
    }

    // THE LEVEL-UP-ALL REWARD, BEHIND A REWARDED AD. Poki's rewardedBreak:
    // gameplay stopped and the world frozen for it, and the reward given ONLY
    // if it reports success — an ad blocker, no fill or a skipped ad give
    // nothing, which Poki requires. Without the SDK at all: the mock ad on a
    // local dev server (to test the flow), and no reward anywhere else — an
    // ad blocker on the live site removes the SDK, and must not be a free
    // upgrade.
    levelUpAll() {
        if (this.isWatchingAd) return;  // Prevent multiple ad triggers
        if (pokiReady) {
            this.isWatchingAd = true;
            this._setPaused(true);
            pokiGameplay(false);
            pokiRewardedBreak().then((ok) => {
                this.isWatchingAd = false;
                this._setPaused(false);
                if (pokiFirstInput) pokiGameplay(true);
                if (ok) this.performLevelUpAll();
                else this._adUnavailable();
            });
            return;
        }
        if (isLocalDev()) { this.showMockAd(() => this.performLevelUpAll()); return; }
        this._adUnavailable();
    }

    // No ad to show, so no reward: said briefly over the button rather than
    // the tap simply doing nothing.
    _adUnavailable() {
        const b = this.levelUpButton;
        if (!b || !b.scene) return;
        const s = this.layoutConfig.colScale || this.layoutConfig.scale;
        const t = this.add.text(b.x, b.y - (this.layoutConfig.spawnBtnDisplayH || 60) * 0.6,
            (CONFIG.AD || {}).UNAVAILABLE_TEXT || 'No ad available right now', {
                fontSize: Math.round(22 * s) + 'px', fontFamily: CONFIG.FONT_FAMILY, fontStyle: CONFIG.FONT_WEIGHT,
                color: '#fff6e0', stroke: '#3b2a17', strokeThickness: Math.max(2, Math.round(3 * s)),
            }).setOrigin(0.5, 1).setDepth(101);
        this.tweens.add({ targets: t, y: t.y - 24 * s, alpha: 0, delay: 900, duration: 500,
            onComplete: () => t.destroy() });
    }

    showMockAd(onComplete) {
        this.isWatchingAd = true;  // Block all interactions during ad
        // THE WORLD STOPS FOR THE AD — distance tick, tweens mid-flight, every
        // timer — and picks up exactly where it was once the ad is over, the
        // way Poki requires.
        this._setPaused(true);
        pokiGameplay(false);
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const A = CONFIG.AD;
        
        // Create overlay
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 
            parseInt(A.OVERLAY_COLOR.substring(1), 16), A.OVERLAY_ALPHA)
            .setDepth(10000)
            .setInteractive();  // Block clicks from passing through overlay
        this._shadePage(A.OVERLAY_COLOR, A.OVERLAY_ALPHA, 0);
        
        // Create countdown timer text in center
        const timerText = this.add.text(W / 2, H / 2, `${A.DURATION}`, {
            fontSize: A.TIMER_TEXT_SIZE,
            fontFamily: CONFIG.FONT_FAMILY,
            color: A.TIMER_TEXT_COLOR,
            fontStyle: CONFIG.FONT_WEIGHT,
        }).setOrigin(0.5).setDepth(10001);

        // "REWARD IN PROGRESS", sat just above the countdown — the number
        // alone read as a bare timer with nothing to say what it was
        // counting down TO. Static for the whole wait; only the number below
        // it moves. Measured off the number's own TOP edge, not the screen's
        // centre line: the number is centred there, so its top half would
        // otherwise run straight through this line.
        const rewardText = this.add.text(W / 2,
                timerText.y - timerText.height / 2
                    - (A.REWARD_TEXT_GAP !== undefined ? A.REWARD_TEXT_GAP : 20),
                A.REWARD_TEXT || 'Reward in progress', {
            fontSize: A.REWARD_TEXT_SIZE || '40px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: A.REWARD_TEXT_COLOR || '#FFFFFF',
            fontStyle: CONFIG.FONT_WEIGHT,
        }).setOrigin(0.5, 1).setDepth(10001);

        // Countdown from AD.DURATION to 0. ON THE BROWSER'S CLOCK, not the
        // scene's: the scene's is the one stopped for the ad, and a countdown
        // on it would never reach zero.
        let timeLeft = A.DURATION;
        const countdown = window.setInterval(() => {
            if (!overlay.scene) { window.clearInterval(countdown); return; }   // scene gone
            timeLeft--;
            if (timeLeft > 0) {
                timerText.setText(`${timeLeft}`);
            } else {
                // Ad complete - destroy immediately and upgrade
                window.clearInterval(countdown);
                this._shadePage(null);
                overlay.destroy();
                rewardText.destroy();
                timerText.destroy();
                this.isWatchingAd = false;  // Re-enable interactions
                this._setPaused(false);     // the world carries on from where it stopped
                if (pokiFirstInput) pokiGameplay(true);
                onComplete();  // Instant upgrade after ad
            }
        }, 1000);
    }

    performLevelUpAll() {
        for (const bd of this.batteries) {
            if (bd.inGrid) {
                bd.level += 1;
                bd.levelText.setText(`PIGGY ${bd.level}`);
                this.assets.dressWhenReady(bd.sprite, getBatteryIconLevel(bd.level));
                if (bd.level > this.highestBatteryLevel) this.highestBatteryLevel = bd.level;
            }
        }
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) {
                const p = this.platforms[i];
                slot.level += 1;
                slot.distPerSec = getBatteryChargeValue(slot.level);
                if (slot.batteryData) slot.batteryData.level = slot.level;
                const sbd = slot.batteryData;
                if (p.batterySprite && sbd && sbd.wheel) {
                    sbd.wheel.ready = false;
                    this.assets.dressSlotWhenReady(p.batterySprite, sbd.wheel, getBatteryIconLevel(slot.level));
                }
                if (p.batteryLevelText) p.batteryLevelText.setText(`PIGGY ${slot.level}`);
                p.chargeRateText.setText(this._rateText(slot.distPerSec));
            }
        }
        this.updateSpawnButton();
        this.assets.prefetchAhead(this.highestBatteryLevel + 1);
        this.tweens.killTweensOf(this.levelUpButton);
        this.levelUpButton.setScale(1).setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonBg.setAlpha(0.5);
        this.levelUpTimer = this.time.now;
    }

    // ================================================================
    // COIN DISPLAY
    // ================================================================
    updateCoinDisplay() {
        // Text is right-aligned (origin 1, 0.5), so its right edge stays fixed
        // at coinText.x and the icon never needs to move.
        this.coinText.setText(this._bigNum(this.coins));
        this.updateSpawnButton();
    }

    animateCoinReward(startX, startY, amount, delayBeforeFly = 0, platform = null, onComplete = null) {
        const C   = CONFIG.COIN_REWARD_ANIMATION;
        // No counter on screen, no flight — but the coins are still earned. This
        // is called at every level end now, so it must not be able to take the
        // game down with it if the UI half is ever built without one.
        if (!this.coinIcon || !this.coinIcon.scene) {
            this.coins += amount;
            if (this.coinText) this.updateCoinDisplay();
            if (onComplete) onComplete();
            return;
        }
        const tX  = this.coinIcon.x, tY = this.coinIcon.y;
        this._coinFlights = (this._coinFlights || 0) + 1;   // see _isSettled
        const n   = Math.max(1, C.COIN_COUNT);
        let done  = 0;

        // THE PAYOUT GOES WHERE THE EYES ARE. A player mid-merge is looking at
        // the grid, not at the field that just paid them — so the coins are
        // SCATTERED ACROSS THE WHOLE SCREEN, the grid half included, and then
        // swept to the counter. Motion crossing what someone is looking at
        // cannot be missed; a neat line sliding into a corner can.
        //
        // Nothing here is interactive, so a coin under a finger is invisible to
        // input and a drag runs straight through it. They still keep clear of a
        // dragging finger: a coin over the battery being placed is in the way
        // even when it cannot be pressed.
        const S       = C.SCATTER || {};
        const scatter = S.ENABLED !== false;
        const L       = this.layoutConfig;
        const size    = scatter ? (S.SIZE !== undefined ? S.SIZE : 34) * L.scale
                                : this.rewardCoinSize;
        const burst   = scatter ? 0
                      : (C.BURST_RADIUS !== undefined ? C.BURST_RADIUS : 55) * L.scale;
        const popMs   = S.POP_MS !== undefined ? S.POP_MS : 180;
        const popGap  = S.POP_STAGGER !== undefined ? S.POP_STAGGER : 22;
        // How long a coin's THROW OUT of the bank takes — S.OUT_MS if it is
        // set, popMs (the old "arrival pop" duration) otherwise, so an unedited
        // config keeps the same pacing it always had.
        const outMs   = S.OUT_MS !== undefined ? S.OUT_MS : popMs;
        // Somewhere on screen to fall: mostly over the car area, the rest over the
        // panel, and never on top of a finger that is mid-drag.
        const spot = () => {
            const r = Math.random() < (S.CAR_SHARE !== undefined ? S.CAR_SHARE : 0.65)
                    ? L.partB : L.partA;
            const keep = (S.AVOID_POINTER !== undefined ? S.AVOID_POINTER : 90) * L.scale;
            const p = this.input && this.input.activePointer;
            for (let t = 0; t < 8; t++) {
                const x = r.x + r.width  * (0.08 + Math.random() * 0.84);
                const y = r.y + r.height * (0.08 + Math.random() * 0.84);
                if (!this.draggingBattery || !p || Math.hypot(x - p.x, y - p.y) > keep) return { x, y };
            }
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        };

        const coins = [];
        for (let i = 0; i < n; i++) {
            if (scatter) {
                // OUT OF WHERE IT WAS EARNED, QUICKLY — a coin does not simply
                // appear where it lands; it is thrown there from startX/startY
                // (the bank that just went off, or whatever paid out), a moment
                // after the last one so the screen RAINS across it rather than
                // blinking every coin on at once.
                const to = spot();
                const coin = this.add.image(startX, startY, 'coin')
                    .setDisplaySize(size, size)
                    .setDepth(100 + i)
                    .setAlpha(0);
                coins.push(coin);
                const sx = coin.scaleX, sy = coin.scaleY;
                coin.setScale(sx * 0.4, sy * 0.4);
                // STRAIGHT THERE AND STOPPED — no overshoot. Back.easeOut
                // sails past x/y before springing back, which on a COIN'S
                // POSITION reads as it swinging around where it landed; a coin
                // has to sit dead still once it arrives; the only motion left
                // in it after this is the later sweep to the counter.
                this.tweens.add({
                    targets: coin, x: to.x, y: to.y,
                    scaleX: sx, scaleY: sy, alpha: 1,
                    delay: i * popGap,
                    duration: outMs,
                    ease: 'Cubic.easeOut',
                });
                continue;
            }
            const at = { x: startX, y: startY - i * C.INITIAL_STACK_OFFSET };
            const coin = this.add.image(at.x, at.y, 'coin')
                .setDisplaySize(size, size)
                .setDepth(100 + i);
            coins.push(coin);
            if (burst > 0) {
                // The single-source version: thrown out and up, each its own way.
                const a2 = (i / n) * Math.PI * 2 + Math.random() * 0.6;
                const r2 = burst * (0.45 + Math.random() * 0.55);
                this.tweens.add({
                    targets: coin,
                    x: startX + Math.cos(a2) * r2,
                    y: startY + Math.sin(a2) * r2 * 0.7 - burst * 0.35,
                    duration: C.BURST_MS !== undefined ? C.BURST_MS : 260,
                    ease: 'Back.easeOut',
                });
            }
        }

        // Then in, one after another, to the counter. Quick: the sweep crosses
        // the board, so it must not linger over it.
        const settle = scatter ? outMs + n * popGap
                               : (C.BURST_MS !== undefined ? C.BURST_MS : 260);
        const flyMs  = scatter ? (S.SWEEP_MS !== undefined ? S.SWEEP_MS : 520)
                               : C.TOP_SPEED_DURATION;
        const gap    = scatter ? (S.STAGGER !== undefined ? S.STAGGER : 26)
                               : C.STAGGER_DELAY;
        // The size a coin lands at, as a fraction of its flying size.
        const arrive = C.ARRIVE_FRAC !== undefined ? C.ARRIVE_FRAC : 1.1;
        this.time.delayedCall(delayBeforeFly + settle, () => {
            coins.forEach((coin, i) => {
                // Scatter: one duration and (with STAGGER 0) one start, so every
                // coin lands on the counter at the same instant.
                const dur = scatter ? flyMs
                                    : flyMs * (1 + i * C.SPEED_VARIATION / Math.max(1, n - 1));
                this.time.delayedCall(i * gap, () => {
                    if (!coin.scene) return; // Already destroyed
                    this.tweens.add({
                        targets: coin, x: tX, y: tY,
                        displayWidth: size * arrive, displayHeight: size * arrive,
                        duration: dur, ease: C.EASE,
                        onComplete: () => {
                            coin.destroy();
                            // EACH ARRIVAL LANDS. The counter's icon takes a hit
                            // per coin, so a payout is felt as a run of blows
                            // rather than a number quietly changing.
                            this._punchCoinCounter(i === n - 1);
                            if (++done === n) {
                                this._coinFlights--;
                                this.coins += amount;
                                this.updateCoinDisplay();
                                // Mark coin animation complete for this platform
                                if (platform) platform.coinAnimationComplete = true;
                                if (onComplete) onComplete();
                            }
                        },
                    });
                });
            });
        });
    }

    // The counter reacting to a coin landing on it: the icon knocks back, and on
    // the last one the figure itself does too.
    _punchCoinCounter(last) {
        const C = CONFIG.COIN_REWARD_ANIMATION || {};
        const amt = C.PUNCH !== undefined ? C.PUNCH : 0.16;
        const ms  = C.PUNCH_MS !== undefined ? C.PUNCH_MS : 110;
        const hit = (o, mul) => {
            if (!o || !o.scene) return;
            if (o._punchBase === undefined) o._punchBase = o.scaleX;
            this.tweens.killTweensOf(o);
            o.setScale(o._punchBase);
            this.tweens.add({ targets: o, scale: o._punchBase * (1 + amt * mul),
                duration: ms, yoyo: true, ease: 'Sine.easeOut',
                onComplete: () => { if (o.scene) o.setScale(o._punchBase); } });
        };
        hit(this.coinIcon, 1);
        if (last) hit(this.coinText, 0.7);
    }

    // ================================================================
    // UPDATE
    // ================================================================
    update(time, delta) {
        if (!this._firstFrameMarked) { this._firstFrameMarked = true; loadMark('first frame — create() finished'); }
        if (this.gamePaused) return;
        this._pollOrientation();
        if (this._relayoutPending) {
            const why = this._unsettledBy();
            if (why !== this._orientWaitWhy) { this._orientWaitWhy = why; if (why) orientLog(`relayout waiting: ${why}`); }
            if (!why) { this._fastForward(false); this._relayout(); }
            // Not while a pig is held: that wait is the player's, and the
            // field racing along under their finger would look broken.
            else this._fastForward(!this.draggingBattery);
        } else {
            this._fastForward(false);   // turned back before it ran
        }
        // The one thing stepped per frame: the cars' tyres. Everything else
        // that moves is tween- or timer-driven, and _setPaused stops those.
        this._spinWheels(delta);
        this._steerWheels(delta);
        this._driveCars(delta);
        this._drawGapLines();
        this._drawRoads(delta);
        this._drawSpeedFx(delta);
        this._peekFaces(delta);
    }
}

// ================================================================
// PHASER CONFIG + BOOT
// ================================================================
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// [orient] console lines — CONFIG.DEBUG_ORIENTATION.
function orientLog(msg) {
    if (typeof CONFIG !== 'undefined' && CONFIG.DEBUG_ORIENTATION) console.log(`[orient] ${msg}`);
}

// ── THE STAGE ──────────────────────────────────────────────────────────────
// One fixed render size, decided once, scaled by the browser to fill whatever
// window it lands in.
//
// This used to be the opposite: the canvas was sized to the live viewport in
// device pixels and the scene was RESTARTED on every resize to re-lay it out.
// That was sharp, but a restart destroys the scene, so dragging a window — or
// rotating a phone, which is the same event — reset the run to level one.
//
// Fixing the size removes the problem rather than saving around it. Nothing
// inside the game ever learns the window changed, so there is nothing to
// preserve and nothing to replay.
//
// Chosen from the window's SHAPE — at boot, and again when the screen turns
// between portrait and landscape OR changes shape enough within one
// (STAGE.RESHAPE_TOLERANCE — see _pollOrientation). Neither restarts
// anything: the scene takes the new size and re-lays itself out in place, run
// and all (see _relayout). A smaller resize is just the browser scaling this
// stage.
function pickStage() {
    const S = (typeof CONFIG !== 'undefined' && CONFIG.STAGE) || {};
    const P = S.PORTRAIT  || { W: 1080, H: 1920 };
    const L = S.LANDSCAPE || { W: 1920, H: 1080 };
    const winW = window.innerWidth  || 1280;
    const winH = window.innerHeight || 720;
    let portrait;
    if (S.FORCE === 'portrait')       portrait = true;
    else if (S.FORCE === 'landscape') portrait = false;
    else portrait = winH > winW;
    const d = portrait ? P : L;

    // The WIDTH is the fixed half. The HEIGHT is taken from the window so the
    // stage matches the screen's shape and fills it with no bars — both halves
    // lay themselves out against the height they are given.
    let height = d.H;
    if (S.DERIVE_HEIGHT !== false) {
        const ratio = Math.min(Math.max(winH / winW, d.MIN_RATIO || 0.3), d.MAX_RATIO || 3);
        height = Math.round(d.W * ratio);
    }
    return { portrait, width: d.W, height };
}
const STAGE = pickStage();
orientLog(`boot: frame ${window.innerWidth} x ${window.innerHeight} -> ` +
    `${STAGE.portrait ? 'PORTRAIT' : 'LANDSCAPE'} stage ${STAGE.width} x ${STAGE.height}`);

const GAME_WIDTH  = STAGE.width;
const GAME_HEIGHT = STAGE.height;

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    // The canvas's own clear colour — what shows wherever nothing is drawn,
    // which since the panel's corners were rounded means those four notches.
    // Matched to the page behind it so the two cannot be told apart.
    backgroundColor: '#d5ba95',
    scene: [GameScene],
    scale: {
        // FIT/ENVELOP means Phaser owns the canvas's DISPLAY size and keeps it
        // in step with the window on its own — no resize listener of ours, and
        // no restart. The game's own coordinate space stays exactly GAME_WIDTH
        // x GAME_HEIGHT forever, which is what makes a resize a non-event.
        mode: (Phaser.Scale[(CONFIG.STAGE || {}).MODE] || Phaser.Scale.FIT),
        autoCenter: Phaser.Scale.CENTER_BOTH,   // bars split evenly, not all on one side
        width:  GAME_WIDTH,
        height: GAME_HEIGHT,
        expandParent: true,
    },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    // HOW MANY FILES DOWNLOAD AT ONCE. Phaser's own default is 32 — except on
    // Android, where it drops to 6, a guard for old Android browsers that
    // choked on many requests at once. Modern Android Chrome does not, and on a
    // server that takes seconds to answer each file, 6 slots turned the opening
    // load into queues: every file waited for one of six to come free, and the
    // preload ran in rounds. Poki's Inspector reports itself as an Android
    // phone, so it measured exactly that. Set here, it is 32 everywhere.
    //
    // IMAGES AS PLAIN <img> LOADS, not XHR. The build's index.html carries
    // <link rel="preload" as="image"> hints so the browser starts fetching the
    // opening art as soon as the page arrives. The browser only hands that early
    // download to a request of the SAME kind — an image load, CORS-anonymous —
    // and Phaser's default XHR fetch is a different kind, so it would download
    // every hinted image a second time. crossOrigin matches the hints'
    // crossorigin="anonymous"; the files are same-origin, so it costs nothing.
    loader: { maxParallelDownloads: 32, imageLoadType: 'HTMLImageElement', crossOrigin: 'anonymous' },
    callbacks: {
        // Runs after the canvas exists, before the first render: lock in exact
        // device-pixel sizing and keep it in sync on window resize / rotation.
        postBoot: () => { /* Phaser's scale manager tracks the window itself */ },
    },
};

// The font has to be IN HAND before the game starts, not merely declared.
// Phaser renders each Text into its own canvas texture the moment it is created
// and never re-renders it, so a label built before the font arrives keeps the
// fallback for the life of the scene — the classic symptom being the right font
// only after a refresh. document.fonts.load() both triggers the fetch (a
// declared @font-face is not fetched until something asks for it) and tells us
// when it is done.
//
// It resolves rather than rejects on failure, and a missing font is not a
// reason to withhold the game — so a failure here just means the fallback,
// which is what would have happened anyway.
function waitForFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const f = (CONFIG.FONT_FAMILY || '').split(',')[0].trim();
    if (!f) return Promise.resolve();
    return document.fonts.load(`${CONFIG.FONT_WEIGHT || '600'} 16px ${f}`)
        .catch(() => {})
        .then(() => document.fonts.ready)
        .catch(() => {});
}

// The loading screen in index.html. The time before Phaser boots (battery check,
// font) takes the first sliver of the bar; the asset loader fills the rest.
// Everything here is a no-op once the screen is gone — the scene restarts on a
// resize, and a second preload must not bring it back.
// ── Load timing ──────────────────────────────────────────────────────────────
// Where the time before play goes, stage by stage, printed as [timing] lines.
// performance.now() counts from the moment the page was opened, so each mark's
// first number is "ms since page open" — the same clock Poki's loading time
// runs on. The "+" figure is the gap since the mark before; the boot checks run
// side by side, so for those read the first number, not the gap.
const loadMarks = [];
function loadMark(label) {
    if (!CONFIG.DEBUG_LOAD_TIMING || typeof performance === 'undefined') return;
    const t = Math.round(performance.now());
    const prev = loadMarks.length ? loadMarks[loadMarks.length - 1].t : 0;
    loadMarks.push({ label, t });
    console.log(`[timing] ${String(t).padStart(6)}ms  (+${t - prev}ms)  ${label}`);
}
// Once, when loading finishes: the page's own download, then the network
// requests that took longest. A request's time includes waiting its turn, so a
// long list of files all starting late points at queuing, not at size.
function loadTimingReport() {
    if (!CONFIG.DEBUG_LOAD_TIMING || typeof performance === 'undefined' || !performance.getEntriesByType) return;
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
        console.log(`[timing] page HTML: request sent at ${Math.round(nav.requestStart)}ms, ` +
            `downloaded by ${Math.round(nav.responseEnd)}ms, parsed by ${Math.round(nav.domContentLoadedEventEnd)}ms`);
    }
    const res = performance.getEntriesByType('resource');
    const short = (u) => String(u).split('?')[0].split('/').slice(-2).join('/');
    const kb = (r) => r.transferSize ? `${(r.transferSize / 1024).toFixed(0)}KB` : 'size n/a';
    console.log(`[timing] ${res.length} requests before loading finished. Slowest:`);
    for (const r of [...res].sort((a, b) => b.duration - a.duration).slice(0, 10)) {
        console.log(`[timing]    ${String(Math.round(r.duration)).padStart(5)}ms  ` +
            `from ${Math.round(r.startTime)}ms to ${Math.round(r.responseEnd)}ms  ${kb(r)}  ${short(r.name)}`);
    }
}

const LOAD_BOOT_SHARE  = 0.1;
const LOAD_PRELOAD_CAP = 0.85;   // the rest is create() building the view
let loadingScreenDone = false;
let loadingShown = 0;            // never goes back: a batch added mid-load grows
                                 // the total, which would otherwise pull it back
function setLoadingProgress(v) {
    if (loadingScreenDone || typeof window === 'undefined') return;
    // THE PAGE OWNS THE BAR (see the script in index.html): it starts moving on
    // the first paint, long before this file exists, and it refuses to go
    // backwards. Everything here is a request to move it forward.
    const bar = window.__loading;
    if (!bar) return;
    bar.set(Math.max(0, Math.min(1, v)));
    loadingShown = bar.value();
}
function finishLoadingScreen() {
    if (loadingScreenDone) return;
    loadMark('opening view built — LOADING FINISHED (this is what Poki times)');
    loadTimingReport();
    setLoadingProgress(1);
    loadingScreenDone = true;
    // gameplayStart waits for the player's FIRST INPUT, not the load — Poki's
    // rule. See the scene's first pointerdown (create) and pokiFirstInput.
    pokiCall('gameLoadingFinished');
    const screen = typeof document !== 'undefined' && document.getElementById('loading-screen');
    if (!screen) return;
    // A beat at 100% before fading, so the full bar is actually seen — create()
    // blocks the page while it builds, and a fade started now would freeze.
    setTimeout(() => {
        screen.classList.add('done');
        setTimeout(() => screen.remove(), 500);
    }, 250);
}

// ── Poki SDK ─────────────────────────────────────────────────────────────────
// Every call goes through here, because the SDK is optional at runtime: an ad
// blocker removes it, and a page served anywhere but Poki may not have it. A
// missing or throwing SDK must never cost the player the game.
let pokiReady = false;
function pokiCall(fn) {
    if (!pokiReady) return;
    try { window.PokiSDK[fn](); } catch (e) { console.warn(`[poki] ${fn} failed`, e); }
}
// Start/stop are sent only on a real change, so a stray repeat from either
// side never reaches Poki as a double event.
let pokiPlaying = false;
function pokiGameplay(on) {
    if (pokiPlaying === on) return;
    pokiPlaying = on;
    pokiCall(on ? 'gameplayStart' : 'gameplayStop');
}
// The player's first input has happened — gameplayStart may be sent. Before
// it, nothing (not even the end of an ad) may start gameplay.
let pokiFirstInput = false;

// A REWARDED BREAK. Resolves true only if Poki says the ad was watched.
function pokiRewardedBreak() {
    if (!pokiReady) return Promise.resolve(false);
    try {
        return Promise.resolve(window.PokiSDK.rewardedBreak(() => {}))
            .then((ok) => !!ok).catch(() => false);
    } catch (e) { console.warn('[poki] rewardedBreak failed', e); return Promise.resolve(false); }
}

// ── The save, as stored ─────────────────────────────────────────────────────
// Bump SAVE_VERSION if the shape below changes incompatibly: an older save is
// then ignored (a fresh start) rather than misread.
const SAVE_VERSION = 3;   // 3: the level and each lane's chase
function saveKey() { return ((typeof CONFIG !== 'undefined' && CONFIG.SAVE) || {}).KEY || 'mergeDriver.save'; }

// The stored run, checked and tidied — or null for a fresh start: none
// saved, loading switched off, storage blocked, or anything malformed. A bad
// save must never stop the game from starting.
function readSave() {
    const S = (typeof CONFIG !== 'undefined' && CONFIG.SAVE) || {};
    if (S.ENABLED === false || S.LOAD === false) return null;
    try {
        // ?newgame in the page's address wipes the save — a fresh run to test.
        if (typeof location !== 'undefined' && /[?&]newgame\b/.test(location.search)) {
            localStorage.removeItem(saveKey());
            return null;
        }
        const raw = localStorage.getItem(saveKey());
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || d.v !== SAVE_VERSION) return null;
        const int = (v, min) => (Number.isFinite(v) ? Math.max(min, Math.floor(v)) : null);
        const sv = {
            coins: int(d.coins, 0),
            distance: Number.isFinite(d.distance) ? Math.max(0, d.distance) : 0,
            level: int(d.level, 1) || 1,
            lanes: Array.isArray(d.lanes)
                ? [0, 1, 2].map((i) => {
                    const l = d.lanes[i] || {};
                    return { left: Number.isFinite(l.left) ? Math.max(0, l.left) : 0, caught: !!l.caught };
                })
                : null,
            highest: int(d.highest, 1),
            spawnLevel: int(d.spawnLevel, 1),
            spawnCost: int(d.spawnCost, 0),
            started: !!d.started,
            mergeTut: !!d.mergeTut,
            slotSeen: [0, 1, 2].map((i) => !!(d.slotSeen && d.slotSeen[i])),
            grid: [0, 1, 2].map((r) => [0, 1, 2].map((c) => int(d.grid && d.grid[r] && d.grid[r][c], 0) || 0)),
            slots: [0, 1, 2].map((i) => int(d.slots && d.slots[i], 0) || 0),
        };
        if ([sv.coins, sv.highest, sv.spawnLevel, sv.spawnCost].some((v) => v === null)) return null;
        // EVERY VILLAIN CAUGHT is a level that was about to turn: resume on the next.
        if (sv.lanes && sv.lanes.every((l) => l.caught)) { sv.level += 1; sv.lanes = null; }
        return sv;
    } catch (e) {
        return null;
    }
}

// Running on the developer's own machine — where the mock ad stands in.
function isLocalDev() {
    if (typeof location === 'undefined') return false;
    return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
}

// THE PARENT PAGE MUST NOT SCROLL under the game — arrow keys, space and the
// mouse wheel would otherwise scroll Poki's page around it. Poki's rule.
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (ev) => {
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key)) ev.preventDefault();
    });
    window.addEventListener('wheel', (ev) => ev.preventDefault(), { passive: false });
}

// Resolves either way. The timeout is there so a hung init can never hold the
// game on the loading screen — Poki would rather lose a metric than a player.
function initPoki() {
    if (typeof window === 'undefined' || !window.PokiSDK) {
        console.warn('[poki] SDK not present — running without it');
        loadMark('Poki SDK not present');
        return Promise.resolve();
    }
    let settled = false;
    const init = window.PokiSDK.init()
        .then(() => { pokiReady = true; loadMark('Poki SDK ready'); })
        .catch((e) => { console.warn('[poki] init failed — running without it', e); loadMark('Poki SDK init FAILED'); })
        .finally(() => { settled = true; });
    const cap = new Promise((r) => setTimeout(() => {
        if (!settled) loadMark('Poki SDK still not ready after 4000ms — TIMED OUT, carrying on');
        r();
    }, 4000));
    return Promise.race([init, cap]);
}

if (typeof window !== 'undefined' && !window.__LEVEL_VIEWER__) {
    loadMark('game script running (page, Phaser and Poki SDK scripts are in)');
    setLoadingProgress(LOAD_BOOT_SHARE * 0.4);
    Promise.all([
        waitForFont().then(() => loadMark('font ready')),
        initPoki(),
    ]).then(() => {
        loadMark('boot checks done — starting Phaser');
        setLoadingProgress(LOAD_BOOT_SHARE);
        new Phaser.Game(config);
    });
}
