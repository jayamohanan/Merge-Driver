// Helper: convert CSS hex color string to Phaser hex number
function hexColor(cssColor) {
    if (typeof cssColor === 'string' && cssColor.startsWith('#')) {
        return parseInt(cssColor.substring(1), 16);
    }
    return cssColor;
}

var CONFIG = {
    // Quotes are LOAD-BEARING. Phaser passes this straight into a canvas font
    // string, and a family with a space and a digit in it fails to parse
    // unquoted — silently, falling back to the system default with no error.
    FONT_FAMILY: '"Baloo 2", sans-serif',
    FONT_WEIGHT: '600',     // the ONE weight shipped in fonts/. Every label asks
                            // for this rather than 'bold', because 'bold' means
                            // 700 — which is not in the file, so the browser
                            // SYNTHESISES it by smearing the 600 sideways. That
                            // looks worst on small text with a stroke, which is
                            // most of this UI. Ship an 800 file and set this to
                            // '800' if the numbers want more weight.
    TEXT_COLOR: '#1A237E',

    // ── Screen split ──────────────────────────────────────────────────────────
    // Landscape puts the UI (grid, coin, spawn button, battery slots) on the LEFT
    // and the farm on the RIGHT. The farm is what the game is about, so it takes
    // the larger share: the UI needs only the grid panel's width plus margins.
    // Portrait stays a 50/50 top/bottom split — see calculateLayout().
    LAYOUT: {
        // THE UI HALF'S SHARE, and both numbers mean the same thing: what is
        // left goes to the car area. An even split either way.
        //
        //   LANDSCAPE  UI on the LEFT, car area on the right — share of the WIDTH
        //   PORTRAIT   UI at the BOTTOM, car area above — share of the HEIGHT
        LANDSCAPE_SPLIT: 0.5,
        // LANDSCAPE MERGE COLUMN (coin, grid, spawn button). On a half taller
        // than it needs, the column grows up to LANDSCAPE_GRID_GROW × its
        // width-fitted size (1 = never), its panel no wider than
        // LANDSCAPE_GRID_MAX_W of the half; then, with LANDSCAPE_CENTER, it is
        // centred as one block so leftover height splits above and below.
        LANDSCAPE_GRID_GROW:  1.15,
        LANDSCAPE_GRID_MAX_W: 0.9,
        LANDSCAPE_CENTER:     true,
        PORTRAIT_SPLIT:  0.5,

        // The design reference is a 1440x778 MacBook. REF_W is the UI half AT
        // THAT SPLIT, so changing the split alone never resizes the grid: the
        // scale works out to screenWidth/1440 either way.
        REF_W_PORTRAIT: 720,

        // The UI column's reference height — coin, panel, button, nothing else,
        // the same in both orientations now that the battery case has gone to
        // the farm half. Leave it unset to DERIVE it from those three, which is
        // what you want; a number here overrides the derivation and then the
        // grid scales against it.
        REF_H_COLUMN: 0,
    },

    // ── How figures are written ───────────────────────────────────────────────
    // Every number the player sees goes through _bigNum. Full figures while they
    // fit, a unit once they do not — the same rule everywhere, so two readouts
    // never write the same value differently.
    NUMBERS: {
        ABBREV_FROM: 1e5,   // below this the whole number is shown: 50000, not
                            // 50K. From here K takes over with up to three
                            // digits (100K … 999K), then M, B, T. Raise it and
                            // more of the run reads exactly; lower it and the
                            // readouts get narrower.
        SEPARATOR:   '',    // digit grouping, e.g. ',' for 50,000; '' for none
    },

    RESET_PROGRESS: false,
    DEBUG_HALF_LINE: false,  // draw a line splitting partA / partB (vertical in
                             // landscape, horizontal in portrait)
    // White lattice over the farm half, on the TILE boundaries — so it shows
    // where tiles actually are, not just where 22x20 cells would fall. It is
    // world content, so it scrolls with the band and stays welded to the tiles.
    // Columns come from the map's own width; rows are anchored to the map's grid
    // and continued in both directions to fill the visible band.
    DEBUG_PERF: false,        // log object / tween / timer / texture counts each
                             // time the world rebases (once per level). Climbing
                             // numbers = something is outliving its band
    DEBUG_LAYOUT: false,     // log the canvas size, the layout's numbers and
                             // the camera split once at startup: [buffer],
                             // [layout], [camB], and the battery sprite count
    DEBUG_ORIENTATION: false, // [orient] logs: the frame size and stage chosen at
                             // boot, each portrait/landscape turn noticed, what
                             // holds a relayout back, and the stage it picks
    // HOW MANY BATTERY LEVELS ARE FETCHED AHEAD of the highest one reached.
    // Each icon is ~2.5KB — the whole set of 102 is 256KB — so this is nearly
    // free, and it is what keeps a fast run of merges from reaching a level
    // whose picture is still on its way.
    BATTERY_PREFETCH_AHEAD: 3,

    // ...and the WHOLE set, quietly, once the game is running: a few every
    // EVERY_MS until all 102 are in hand (~250KB in total). It never touches the
    // opening load — it waits for the loading screen to go — and it means a
    // player who loses signal mid-run can keep merging as far as they can get.
    BATTERY_BACKFILL: {
        ENABLED:  true,
        EVERY_MS: 900,
        BATCH:    4,        // icons per tick, so ~4.5 per second at the default
    },

    BATTERY_START_LEVEL: 1,
    // Coins a new run starts with. Default 2500; raise it to debug later levels.
    START_COINS: 2500,
    // THE ECONOMY. Coins come from catching villains — see levelData.js.
    ECONOMY: {
        SPAWN_COST_PER_LEVEL: 25,    // a spawn costs this × the spawn level
    },
    BATTERY_IMAGE_EXTENSIONS: ['webp'],

     BACKGROUND: {
        // MATCHED TO THE CAR AREA'S GROUND — partB (the car area) has no
        // fill of its own; it is simply the canvas's own backgroundColor
        // showing through (set on the Phaser game config in game.js). Keeping
        // this the same value makes the seam between the two halves disappear
        // instead of reading as two different panels.
        GRADIENT_START_COLOR: "#d5ba95",
        GRADIENT_END_COLOR: "#d5ba95",
        // HOW OPAQUE THE PANEL CARD IS. It was 0 while the farm's own ground
        // sheet ran under both halves and was the better background; that sheet
        // went with the farm, so the card is what the UI half is made of now.
        OPACITY: 1,

        // THE SEAM between the two halves — the line that says these are two
        // different things rather than one continuous surface.
        SPLIT_LINE: {
            ENABLED: false,
            W:      3,          // px @ design scale
            COLOR:  0x7E6044,   // the tilled-soil brown, so the seam belongs to
                                // the ground it divides rather than to the UI
            ALPHA:  0.9,
        },

        // The UI PANEL's four corners, px @ design scale. 0 squares it off.
        // The fill is the panel half only; what shows through the notches the
        // rounding leaves is the canvas's own colour, matched to it in the page.
        CORNER_RADIUS: 0,
    },

    // ── The stage ─────────────────────────────────────────────────────────────
    // The game renders at ONE fixed size, chosen once at boot, and the canvas is
    // scaled by the browser to whatever the window is. Resizing then changes
    // nothing inside the game: no rebuild, no reflow, and so no progress to
    // lose. It replaces a scene restart that reset the run every time the window
    // moved, and it is what shipped Poki games do.
    //
    // The layout is picked from the window's shape at BOOT and never changes
    // again. Squeezing a desktop window tall leaves the game in landscape with
    // bars rather than reflowing into the phone layout — a desktop player
    // narrowing a window has not become a phone.
    //
    // It also settles a question that had no answer before: on-screen tile size
    // used to follow the viewport and ranged 49-131px, so no asset had a
    // provably correct export size. The farm half is now a constant, so a tile
    // is ONE number and every asset can be sized against it exactly.
    STAGE: {
        ENABLED: true,
        // ONLY THE WIDTH IS FIXED. Height is taken from the window's own aspect
        // at boot, so the stage matches the screen exactly and there are no bars
        // to begin with — a fixed 16:9 stage letterboxes on nearly every real
        // phone, none of which are 16:9 any more.
        //
        // Width is the half that must be constant, because tile size is the farm
        // half's width divided by the map's columns. Height is free: the world
        // scrolls vertically, so a taller stage simply shows more of it.
        //
        // The clamps stop a freak window from producing an absurd stage — a very
        // wide-and-short desktop window, or a phone-shaped browser on a monitor.
        // Beyond them you get bars again, which is the correct outcome.
        PORTRAIT:  { W: 1080, H: 1920, MIN_RATIO: 1.30, MAX_RATIO: 2.40 },
        LANDSCAPE: { W: 1920, H: 1080, MIN_RATIO: 0.45, MAX_RATIO: 0.80 },
        // false pins the stage to the H above, ignoring the window's shape.
        DERIVE_HEIGHT: true,
        // FIT      letterboxes: the whole game always visible, bars on a
        //          mismatched aspect, nothing ever cut off.
        // ENVELOP  fills the window and crops the overflow. No bars, but it eats
        //          the edges of a 22-column field — so FIT is the safer default
        //          for a game whose playfield spans the full width.
        MODE: 'FIT',
        // null decides from the window's shape at boot. 'portrait' / 'landscape'
        // pins it, which is how you test one layout on the other device.
        FORCE: null,
        // ON A TURN between portrait and landscape the game re-lays itself out
        // once whatever is mid-animation has landed (see _relayout in game.js).
        // Until then time runs this many times faster, so that wait is a few
        // frames rather than a second or two of the old layout on the new
        // screen. 1 waits at normal speed.
        RELAYOUT_FAST_FORWARD: 25,
        // How long a new shape has to hold before the game re-lays out for it,
        // ms — a turn passes through in-between sizes on the way round.
        RELAYOUT_DEBOUNCE_MS: 100,
        // A RESHAPE — same orientation, but a frame whose shape would give a
        // stage height more than this share away from the current one —
        // re-lays the game out too, once the size has held still for
        // RESHAPE_DEBOUNCE_MS. Under it (a phone's toolbar sliding), FIT just
        // scales. -1 turns reshapes off: only a turn re-lays out.
        RESHAPE_TOLERANCE:   0.05,
        RESHAPE_DEBOUNCE_MS: 250,
    },

    // ── Level art, loaded as levels come near ─────────────────────────────────
    // A level's OWN art — its crops, animals, produce, buildings, farmer and
    // any tile sheet only its map uses — is fetched when that level is about to
    // be built, not all up front. Shared art (canal and terrain sheets, the
    // trencher, lilies, block, fence poles, UI) still loads before play.
    //
    // What a level needs is read from its level entry and its map, both of
    // which ARE loaded up front — they are a few KB — so nothing has to be
    // listed by hand.
    //
    // The world is built a margin ahead of the view (ENDLESS.FILL_AHEAD). A
    // level whose art has not arrived simply waits to be built, and the margin
    // is what keeps that wait off screen. The loading screen stays up until
    // everything the opening view needs is built.
    // [timing] lines in the console: how long each stage before play took, and
    // the slowest downloads. For finding where the loading time goes; turn off
    // before release.
    DEBUG_LOAD_TIMING: false,

    // ── SAVING ──────────────────────────────────────────────────────────────
    // The run is kept in the browser (localStorage) so a refresh does not lose
    // it: coins, level and how far each plot is picked, every pig in the grid
    // and slots, the spawn button's level, and which tutorials are done.
    // Written every EVERY_MS and when the page is hidden or closed.
    //   LOAD false  — ignore any save at boot (always start fresh), still write
    //   ENABLED false — no saving or loading at all
    //   Add ?newgame to the page's address to wipe the save and start over.
    SAVE: {
        ENABLED:  false,   // OFF FOR NOW: every load starts fresh, nothing is saved
        LOAD:     true,
        KEY:      'mergeDriver.save',
        EVERY_MS: 2000,
    },

    LAZY_LEVELS: {
        // All that is left of per-level loading: the backstop that lifts the
        // loading screen anyway, so a stalled download cannot lock the player out.
        SCREEN_TIMEOUT_MS: 20000,
    },

    BUTTON: {
        SPAWN_WIDTH: 250,
        SPAWN_HEIGHT: 90,
        LEVELUP_WIDTH: 180,
        LEVELUP_HEIGHT: 70,
        BOTTOM_PADDING: 70,
        BUTTON_SPACING: 220,
        BATTERY_ICON_WIDTH: 64,
        BATTERY_ICON_HEIGHT: 64,
        BATTERY_ICON_X: -80,
        BATTERY_ICON_Y: 0,
        COIN_TEXT_SIZE: '32px',
        COIN_TEXT_X: 20,
        COIN_TEXT_Y: 0,
        COIN_ICON_WIDTH: 50,
        COIN_ICON_HEIGHT: 50,
        COIN_ICON_X: 80,
        COIN_ICON_Y: 0,
    },

    AD: {
        DURATION: 15,  // Duration of mock ad in seconds (countdown timer)
        OVERLAY_COLOR: "#000000",
        OVERLAY_ALPHA: 1.0,  // Fully opaque - blocks game view completely
        TIMER_TEXT_SIZE: '120px',
        TIMER_TEXT_COLOR: '#FFFFFF',
        // ABOVE THE COUNTDOWN — a bare number said "waiting" without saying
        // what for. This says it once, and stays up the whole time rather
        // than counting down itself.
        REWARD_TEXT:       'Reward in progress',
        REWARD_TEXT_SIZE:  '40px',
        REWARD_TEXT_COLOR: '#FFFFFF',
        REWARD_TEXT_GAP:   20,   // clearance above the countdown number, px
    },

    MERGE_GRID: {
        PADDING_FROM_BUTTON_TOP: 50,
        // PANEL_DROP is gone: it opened room above the grid for the battery
        // case, and the case has moved to the farm half.
    },

    COIN_COUNTER: {
        ALIGN_WITH_GRID_ROW: 1,
        PADDING_FROM_SCREEN_RIGHT: 20,
        TEXT_SIZE: '48px',
        TEXT_COLOR: '#f7ca42',
        TEXT_STROKE_COLOR: '#7e5d11',
        TEXT_STROKE_THICKNESS: 6,
        COIN_ICON_WIDTH: 40,
        COIN_ICON_HEIGHT: 40,
        TEXT_ICON_SPACING: 10,
    },

    CELL: {
        SIZE: 130,
        GAP: 4,
        RADIUS: 15,
        EMPTY_BG_COLOR: "#c2d1e0",
        FILLED_BG_COLOR: "#eaf0f6",
        INSET_SHADOW_COLOR: "#364549",
        INSET_BORDER_WIDTH: 3.5,
        // Grain over the flat cell colour. ui/merge-grid/cell_noise.webp is neutral
        // grey with blurred noise, blended over the fill when the cell faces are
        // baked — so this is the same composite you would build in an image
        // editor, except the colour underneath stays a config value and one
        // grain file serves every face. A change here needs a reload.
        NOISE: {
            ENABLED:  true,
            BLEND:    'overlay',       // 'overlay' | 'soft-light' | 'multiply'
            CONTRAST: 2,               // stretch the tile before blending. The
                                       // file is blurred noise spanning only
                                       // ±18% around neutral grey, so without
                                       // this an editor-style 7% alpha lands
                                       // under a level of 255 — invisible
            ALPHA:    0.25,            // strength of the blend, AFTER contrast.
                                       // Felt rather than seen: ~2 levels of 255
                                       // on a light cell
            TILE:     1,               // 1 = tile stretched to the cell.
                                       // 0.5 = blown up 2× → coarser grain
        },
        // LANDSCAPE / DESKTOP figures. A 64px battery in a 130px cell, with the
        // label parked 40px BELOW it — sized by eye against a big screen, where
        // there is room to spare and the cell can breathe. The label sits under
        // the tool because a pair of scissors reads from its handles down, and
        // a number over the blades was landing in the middle of the art.
        // ── THE ICON'S SHARE OF THE CELL ────────────────────────────────
        // The cell is padded, the label takes its share of the BOTTOM, and the
        // icon takes everything that is left, with its top edge hard against
        // the top padding line.
        //
        // Both orientations derive it now. The authored figures just below were
        // measured against a desktop cell with room to spare, and left a 64px
        // icon adrift in the middle of a 130px cell with air all round it —
        // fine for a thin tool standing on its own, wrong for a character that
        // is meant to fill its cell. Set this false to go back to them
        // (landscape only: portrait has always derived — see MOBILE).
        FIT_TO_CELL: true,
        // The art's own WIDTH / HEIGHT. The icon is fitted inside the space
        // above the label at this ratio so it is never stretched to reach an
        // edge: 1 for a square canvas, >1 for art wider than it is tall. A
        // character with the tool held out to one side is usually wider than
        // square — measure the file rather than guessing, because too large a
        // number here shrinks the icon to fit a width it does not need.
        ICON_ASPECT: 1,
        // THE PIG IS THE TOP-LEFT ICON_PIG_PX SQUARE of every item's art, in
        // the file's own pixels. That square is what fills the cell's icon box;
        // anything the canvas has past it (the tool) spills out over the edges
        // at the same scale rather than being squeezed in. See fitItemIcon.
        ICON_PIG_PX: 128,
        BATTERY_DISPLAY_SIZE: 64,
        BATTERY_SCALE: 1.0,
        BATTERY_Y_OFFSET: 5,
        LEVEL_TEXT_SIZE: '11px',
        // A NEAR-BLACK, not pure black — softer contrast, and the same warm
        // dark brown already used for label strokes elsewhere (LABEL_STROKE,
        // CROPS.YIELD_LABEL.STROKE) rather than a second dark tone.
        LEVEL_TEXT_COLOR: '#2b2013',
        LEVEL_TEXT_Y_OFFSET: 40,   // + is BELOW the icon

        // ── PORTRAIT: FILL THE CELL ─────────────────────────────────────────
        // The same figures on a phone are a battery half the width of its cell
        // and a label under 8px — legible on a desktop at arm's length and not
        // on a phone at all. The cell itself is not the problem; the content
        // sitting in the middle of it is.
        //
        // So portrait DERIVES all four instead of scaling them: pad the cell top
        // and bottom, give the label its share of what is left, and the battery
        // takes the rest. Nothing is chosen by eye — the cell's own height is
        // the only input, so it stays right at any phone size.
        //
        // The label goes ABOVE the battery, which is the order the desktop
        // offsets already put them in.
        MOBILE: {
            ENABLED:    true,
            // TOP AND BOTTOM PADDING, as a SHARE of the cell — not a fixed
            // number of design pixels.
            //
            // The battery takes the whole remainder, so its edge lands exactly
            // on this line, and the cell draws its own INSET_BORDER_WIDTH (3.5)
            // stroke inside its bounds. A 4px pad therefore left about half a
            // pixel between the battery's ink and that stroke — the padding was
            // being applied and there was nothing to see.
            //
            // A share scales with the cell instead, so the gap reads the same on
            // every device, and PAD_MIN keeps it clear of the border on the
            // smallest one.
            PAD_FRAC:   0.07,   // of the cell's side, each end
            PAD_MIN:    6,      // ...but never less than this, px @ design scale
            GAP:        1,      // between the label and the battery
            TEXT_SHARE: 0.24,   // the label's share of the padded height
            LINE:       1.28,   // font size vs the line box it has to fit — type
                                // is measured with its ascenders and descenders,
                                // so asking for a 20px line means asking for
                                // about 16px of type
            TEXT_SCALE: 0.9,    // ...and then this much of that. LINE is the
                                // arithmetic — what fits — and this is taste:
                                // the label filling its slot exactly reads as
                                // shouting next to the battery. Kept apart so
                                // neither has to pretend to be the other
        },
        DRAGGABLE_BG_COLOR: "#FFFFFF",
        DRAGGABLE_BG_ALPHA: 0,
        GRID_PANEL_PADDING: 14,        // the panel is a drawn rounded square now,
                                       // so this is real padding around the cells
                                       // rather than the old art's baked margin
        GRID_PANEL_COLOR: "#ccd5d7",
        GRID_PANEL_RADIUS: 15,         // px @ design scale
        GRID_PANEL_BORDER_COLOR: "#364549",
        GRID_PANEL_BORDER_WIDTH: 3,
    },

    SPAWN_ANIMATION: {
        INITIAL_SCALE_X: 1.15,
        INITIAL_SCALE_Y: 0.85,
        STRETCH_SCALE_X: 0.9,
        STRETCH_SCALE_Y: 1.1,
        STRETCH_DURATION: 150,
        BOUNCE_SCALE_X: 1.05,
        BOUNCE_SCALE_Y: 0.975,
        BOUNCE_DURATION: 100,
        SETTLE_DURATION: 80,
    },

    POINTER: {
        TUTORIAL_ENABLED: true,        // the start mask + spawn-button pointer
        SCALE: 1,
        FILL_COLOR: "#ffd251",
        STROKE_COLOR: "#6d5727",
        STROKE_WIDTH: 3,
        OFFSET_Y: 20,
        ANIMATION_MOVE_UP: 12,
        ANIMATION_SCALE_DOWN: 0.9,
        ANIMATION_DURATION: 200,
        ANIMATION_YOYO: true,
        ANIMATION_REPEAT: -1,
        TUTORIAL_START_DELAY: 500,
        TUTORIAL_FADE_DURATION: 500,
        TUTORIAL_MASK_COLOR: "#000000",
        TUTORIAL_MASK_OPACITY: 0.75,
    },

    MERGE_TUTORIAL: {
        ENABLED: true,                 // the swap-to-merge hand animation
        POINTER_OFFSET_Y: 50,
        ANIMATION_DURATION: 1000,
        ANIMATION_REPEAT: -1,
        ANIMATION_EASE: 'Sine.easeInOut',
    },

    // ── "PUT ONE HERE" ────────────────────────────────────────────────────────
    // The step after merging. Having made a bigger battery, the player has no
    // reason to guess that it goes in a slot — so an arrow drops toward each of
    // the three, saying where without saying anything.
    //
    // It waits DELAY_MS after the merge lesson ends rather than replacing it on
    // the spot: two hints in the same second read as one busy screen, and the
    // merge wants a beat to land before the next thing asks for attention.
    //
    // It leaves the moment ANY slot is filled. The lesson is "batteries go in
    // slots", and one battery in one slot proves it was learnt — holding the
    // arrows over the remaining two would turn a hint into nagging.
    SLOT_HINT: {
        ENABLED:   true,
        DELAY_MS:  900,      // after a merge. A beat for the merge to land, not
                             // a wait — at three seconds the player has already
                             // started looking for the next thing to do, and the
                             // arrows arrive as an answer to a question they
                             // gave up on
        SIZE:      23,       // arrow LENGTH along the way it points, px @ design
                             // scale. Drawn in code, the same shape as the
                             // roster's pointer, so the game has one arrow
        W_FRAC:    1.35,     // its width across, as a fraction of that length
        // PORTRAIT POINTS SIDEWAYS. The battery case stands on its end there and
        // the three slots are stacked, so an arrow above a slot sits on top of
        // the slot above it. Beside the case, pointing IN, is the only reading
        // that stays clear — and it crosses the case's side edge the same way
        // the landscape one crosses its top.
        SIDE_GAP:  0.12,     // gap from the case's side edge, in slot widths
        // IT CROSSES THE CASE'S TOP EDGE rather than hovering above it. Ending
        // outside the slot leaves the arrow pointing at a boundary; driving it
        // INTO the slot is what says "in here" rather than "down there".
        //
        // START and DISTANCE, not start and end. They used to be coupled — the
        // start was measured back from the end — so shortening the stroke moved
        // the arrow's resting place instead of its reach, which is the opposite
        // of what shortening a stroke should do.
        START_ABOVE: 0.209,  // where it begins, in slot heights ABOVE the case's
                             // top edge. Clamped so it never starts off-screen,
                             // which happens when the slots sit high in the panel
        TRAVEL:      0.193,  // how far it travels down, in slot heights.
                             // Trimmed evenly at both ends — 15% of the run off
                             // each — so the stroke shrank about its own middle
                             // and the arrow did not drift up or down with it
        MS:        253,      // one stroke, down and back (was 380 — 50% faster)
        EASE:     'Sine.easeInOut',
        FADE_MS:   260,      // in when it appears, out when a slot is filled
    },

    // THE PIG, TO THE LEFT OF THE ARROW. graphics/ui/merge-grid/piggy_icon.webp
    // (see assets.js) — an outline-only pig, drawn as-is (no tint) and placed just
    // behind where the arrow's
    // stroke begins, so together "pig, arrow, slot" reads as "drag this here"
    // rather than an arrow pointing at nothing in particular.
    HINT_ICON: {
        ENABLED:   true,
        SIZE:      48,       // px @ design scale
        GAP:       4,        // clearance between the icon and the arrow's
                             // own tail, px @ design scale
        ALPHA:     1,
    },

    COIN_REWARD_ANIMATION: {
        COIN_COUNT: 16,                // a shower, not a trickle
        REWARD_COIN_SIZE: 64,          // px @ design scale; the counter's own
                                       // icon is 40, so these arrive larger than
                                       // the thing they land on and shrink into it
        ARRIVE_FRAC: 1.1,              // the size a coin LANDS at on the counter,
                                       // as a fraction of its flying size (was 0.55)
        BURST_RADIUS: 55,             // how far they scatter first, px @ design
        BURST_MS:     260,             // …and how long that throw takes
        TOP_SPEED_DURATION: 600,
        SPEED_VARIATION: 0.15,
        STAGGER_DELAY: 50,
        INITIAL_STACK_OFFSET: 0,
        DELAY_BEFORE_FLY: 100,        // ms to wait after gadget disappears before coins fly
        EASE: 'Power2',
        PUNCH:    0.16,                // how hard the counter's icon knocks back
        PUNCH_MS: 110,                 // as each coin lands

        // ── THE SHOWER ───────────────────────────────────────────────────────
        // Coins are THROWN OUT from wherever the payout happened — the bank
        // that just burst, most of the time — to scattered spots across the
        // WHOLE screen, the merge grid included, then swept to the counter.
        // The motion goes where the eyes already are, and it starts from where
        // the coins were actually earned rather than blinking into existence
        // at random. ENABLED false falls back to a burst from the farmer who
        // paid.
        //
        // Nothing here can be touched, so a drag runs straight through it.
        SCATTER: {
            ENABLED:  true,
            SIZE:     34,       // px @ design scale. SMALLER than the single
                                // flight's coins: there are many, they move, and
                                // they are over the board
            CAR_SHARE: 0.65,    // the share landing on the car area; the rest
                                // fall over the panel and the grid
            AVOID_POINTER: 90,  // px @ design scale kept clear of a finger that
                                // is mid-drag
            OUT_MS:      180,   // how long the throw from the source to its
                                // landing spot takes — QUICK, on purpose: this
                                // is a coin leaving the bank, not one falling
                                // out of the sky
            POP_MS:      180,   // falls back for OUT_MS if that is unset, and
                                // still the duration used on any older caller
                                // that never gave a source to throw coins FROM
            POP_STAGGER: 22,    // between one coin's throw and the next, so it
                                // sprays rather than leaving all at once
            SWEEP_MS:    520,   // the run to the counter
            STAGGER:      0,    // between one coin's sweep start and the next.
                                // 0 = all leave together and, sharing one
                                // duration, ALL ARRIVE AT THE SAME INSTANT.
                                // Raise it (was 26) to spread the arrivals.
        },
    },

        // Platform stripes (top half) with battery slot on left, gadget on right
    // ── Battery slots ─────────────────────────────────────────────────────────
    // Three slots in one battery-shaped case. In LANDSCAPE they sit in the UI
    // half above the grid; in portrait they stay at the foot of the farm half.
    // The slot SIZE is derived, not set: the three take the row's full width
    // less the gaps, capped at ONE GRID CELL — a battery in a slot should look
    // like a battery in a cell. (See createSlots / calculateLayout.)
    PLATFORM: {
        SLOT_SIZE: 130,                // reference slot square (px) — the ratio
                                       // every slot-derived size is measured in
        SLOT_RADIUS: 15,               // corner radius (px)
        SLOT_EMPTY_ALPHA: 0,           // an EMPTY slot's face: 0 is no face at
                                       // all — just the rim, with the brown
                                       // ground inside it, so it reads as empty
                                       // rather than as another colour. Filled,
                                       // the slot takes its grained face as ever
        CHARGE_RATE_GAP: 2,            // gap (px) between a slot's bottom edge
                                       // and the charge-rate figure under it.
                                       // The font's own top padding adds to
                                       // this on screen

        // The rate on each slot. Was black type on a white outline — the one
        // place in the game that ran that way round — which put it at odds with
        // the sum beside it and with every other readout. White on dark, like
        // the rest.
        SLOT_RATE: {
            COLOR:    '#000000',
            STROKE:   '#ffffff',
            STROKE_W: 0,           // no outline
        },
    },

    // ── THE ROAD ─────────────────────────────────────────────────────────────
    // The only scenery: one thin line per lane at its ground level — the line
    // the tyres and the villain stand on — with small marks along it (dashes
    // on the line, pebbles under it) and a few real BUMPS in it, all sliding
    // BACKWARDS while the lane's car is driving, so the car reads as moving.
    // They run in step with the tyres' spin (CAR.SPIN_*), starting, coasting
    // and stopping with them. The tyres ride over the bumps and the body
    // follows on its springs (SUSPENSION).
    //
    // THE MARKS AND BUMPS FADE OUT BEFORE THE VILLAIN: full under and behind
    // the car, thinning (bumps flattening) from FADE_AHEAD past its front
    // bumper over FADE_LEN, and gone at the latest CLEAR px short of the
    // villain — so the villain stands on still, flat road rather than seeming
    // to slide along with it.
    ROAD: {
        LINE_COLOR:  '#a3825c',
        LINE_W:      3,          // px @ design
        MARK_COLOR:  '#7e6044',
        SPEED:       420,        // px/s @ design the marks slide at, full speed
        PERIOD:      420,        // px @ design before the pattern of marks repeats
        MARKS:       8,          // marks in one period
        FADE_AHEAD:  20,         // px @ design past the bumper before the fade starts
        FADE_LEN:    140,        // px @ design the fade takes
        CLEAR:       18,         // px @ design kept clear before the villain
        DEPTH:       3.8,        // under the cars and villains

        // THE BUMPS: smooth rises in the road, H px high and W px long
        // (@ design), each a random 70–100% of that. RARE, so each one reads
        // as an event: one every EVERY px of road (@ design) on level 1 —
        // about every 5–6 seconds at SPEED — coming closer together level by
        // level down to EVERY_MIN at level MIN_AT_LEVEL and after.
        BUMPS: { H: 6, W: 80, EVERY: 2400, EVERY_MIN: 1000, MIN_AT_LEVEL: 30 },
        // THE BREAK IN THE ROAD before each villain: the car's road and the
        // villain's own short piece of it, W px apart (@ design), so the
        // villain reads as being further off than the screen shows. The
        // villain's piece starts VILLAIN_PAD px before its left edge. The gap
        // closes — the road joins — when the car reaches the villain, over
        // CLOSE_MS, and opens again for the next level's.
        GAP: { W: 26, VILLAIN_PAD: 14, CLOSE_MS: 250 },
        SAMPLE: 4,               // px @ design between points of the drawn road
    },

    // ── THE SUSPENSION ───────────────────────────────────────────────────────
    // Hill Climb Racing style: the tyres follow the road under them, and the
    // body hangs on two springs, one over each tyre. A tyre going over a bump
    // squashes its spring, which lifts that end of the body — front first,
    // then rear, so the car pitches over each bump and settles.
    //   STIFFNESS  how fast the springs answer (rad/s): higher is stiffer
    //   DAMPING    how quickly they settle: 1 = no wobble, lower = bouncier
    //   SQUAT      the body rocking back as the car pulls away and nosing
    //              down as it stops (px/s @ design kicked into the springs
    //              per full change of speed)
    //   MAX        the most a spring may stretch or squash, px @ design — the
    //              lanes are close, so the body never leaves its own lane
    SUSPENSION: {
        STIFFNESS: 16,
        DAMPING:   0.35,
        SQUAT:     60,
        MAX:       9,
    },

    // ── THE VILLAINS ─────────────────────────────────────────────────────────
    // One per lane, three to a level, all the same villain: level 1 wears
    // FILES[0], level 2 FILES[1], level 3 FILES[2], level 4 FILES[0] again, and
    // so on. They stand still at the right of the car area, on their lane's
    // road line. Between each car and its villain is a measuring line with
    // how far apart they are (levelData.js); the lane's piggy takes its m/s off
    // that every tick and the car DRIVES FORWARD along the line to match, so
    // the gap visibly closes. At zero the car is up against the villain and it
    // is caught — gone, and its payout showered to the coin counter. All three
    // caught: the next level, and the cars roll back to the start.
    VILLAIN: {
        DIR:   'graphics/villain/',
        FILES: ['villain_01.webp', 'villain_02.webp', 'villian_03.webp'],
        // Height, ground to head, as a multiple of the CAR's height — capped
        // at MAX_BAND_FRAC of the lane's band so it never reaches the lane above.
        H_FRAC:        1.25,
        MAX_BAND_FRAC: 0.85,
        // …and then scaled by this, whatever capped it above — 0.75 is 25%
        // smaller than the size those give.
        SCALE:         0.75,
        X_FRAC:        0.7,      // its middle, across the free space right of the cars
        EDGE_PAD:      12,       // px @ design kept clear of the screen's right edge
        DEPTH:         4,
        PAYOUT_MULT:   1,        // coins = its distance × this (levels 1–2 are flat)

        CAUGHT_MS:     350,      // how long a caught villain takes to fade out
        NEXT_LEVEL_MS: 900,      // pause after the last catch before the next level
        ENTER_MS:      400,      // how long the next level's villains take to appear

        // THE CAR'S DRIVE. It starts beside its slot and, as the distance
        // runs down, moves toward the villain in proportion to how much of the
        // level's distance is covered. It only goes DRIVE_SHARE of the way —
        // 0.5 stops it halfway between its start and the villain at zero — so
        // a car never LOOKS nearly there while the figure still reads 1000 m.
        // (1 would take its front bumper to STOP_GAP px short of the villain.)
        // Each tick's move is spread over DRIVE_MS so the car rolls rather than
        // jumps.
        DRIVE_SHARE: 0.5,
        STOP_GAP:   10,
        DRIVE_MS:   950,

        // THE MEASURING LINE, ABOVE the lane: from the car's centre to the
        // villain's centre, ABOVE px (@ design) over the taller of the car's
        // roof and the villain's head, with the distance on it:
        //        |<-------- 65 m -------->|
        //        :                        :
        //      [car]                   villain
        // A faint LEADER drops from each end toward what it measures from, to
        // LEADER_GAP px above it.
        GAP_LINE: {
            ABOVE:      32,      // px @ design over the taller of roof and head
            LEADERS:    false,   // the faint drop lines — off: the line floats free
            LEADER_GAP: 6,       // px @ design the leader stops short of them
            LEADER_ALPHA: 0.45,
            W:        3,         // line width, px @ design
            ARROW:    11,        // arrowhead length, px @ design
            END_TICK: 18,        // the upright bar at each end, px @ design
            TEXT_PAD: 8,         // px @ design between the line and the figure
            COLOR:    '#ffffff',
            ALPHA:    0.95,
        },
        // THE FIGURE on the line. Too long for the line (the car nearly
        // there), it sits just above it instead.
        LABEL: {
            SIZE:     30,        // px @ design
            COLOR:    '#ffffff',
            STROKE:   '#2b2013',
            STROKE_W: 5,
            SUFFIX:   ' m',
        },

        // THE GETAWAY CAR. Each villain flees in a car — the piggy car's own
        // body (TINT to recolour it), with the villain's head in the driver's window — so a
        // villain is one front-facing picture (on its wanted card and in the
        // window) and no running frames. It stands where the villain stood,
        // drawn BEHIND the piggy car, and rides the road with it: tyres
        // spinning, bumps and suspension, all while the lane is driving.
        //
        // CAUGHT: the two are level by then (CHASE_TARGET); the piggy car
        // eases ahead and the getaway car brakes back behind it, its front
        // half hidden: cut off and blocked. Then the brakes — a
        // jolt, skid marks, dust, a little shake. The CAUGHT card and badge
        // go on the open road behind them.
        CAR: {
            ENABLED: true,         // false: villains stand on the road instead
            TINT:    null,         // a colour to tint the body with, or null for none
            SCALE:   1,            // of the piggy car's size
            DEPTH:   3.9,          // behind the piggy car (CAR.DEPTH 4)
            // HOW FAR THE PIGGY CAR GETS as the distance runs down (in place
            // of DRIVE_SHARE): at the last metre its front bumper is this far
            // along the getaway car — 0 its rear, 0.5 its middle, 1 its front.
            // Near 1, the two are level by the last metre and the catch is a
            // gentle crossover, not a burst of speed.
            CHASE_TARGET: 0.85,
            // WHERE THEY MEET, as a share of the car area's width (from the
            // slots to the screen's right edge): the two cars come level with
            // their middle here. The piggy car comes forward AND the getaway
            // car drifts back as the gap closes, so the crossover happens
            // mid-road rather than at its far end. Never further than the
            // getaway car's start, nor behind the piggy car's.
            MEET_AT: 0.55,
            // The head in the window, in the BODY's pixels (254 x 107): its
            // centre at X, Y and H tall — the top HEAD_FRAC of the villain's
            // picture, which is the head.
            FACE: { X: 126, Y: 28, H: 40, HEAD_FRAC: 0.55 },
            BLOCK: {
                // THE CROSSOVER, from level (CHASE_TARGET): the piggy car
                // carries on at chase pace and eases to a stop SURGE px further
                // on (never past the screen's edge), while the getaway car
                // brakes back beside it until OVERLAP of it is hidden.
                SURGE:     22,     // px @ design
                OVERLAP:   0.55,   // share of the getaway car hidden behind it
                SLIDE_MS:  700,    // the crossover, start to stop
                CUT_TILT:  4,      // degrees the piggy car noses up cutting in
                BRAKE_TILT: 5,     // degrees the getaway car noses down braking
                BRAKE_MS:  140,
                SKID_LEN:  46,     // px @ design of skid mark behind each tyre
                PUFFS:     5,      // dust puffs at the getaway car's tyres
                DUST:      '#d9c3a0',
                SETTLE_MS: 260,    // after the brakes, before the CAUGHT card
                SHAKE:     0.005,
                SHAKE_MS:  140,
            },
        },
    },

    // ── THE WANTED CARDS ─────────────────────────────────────────────────────
    // The bounty board. When a level begins, each villain's WANTED card — its
    // face and its bounty — pops up over it, holds a moment, then shrinks into
    // the villain and the chase starts (a tap anywhere starts it at once).
    // Merging carries on throughout; only the cars wait. A level resumed part
    // way through gets no cards.
    //
    // When a villain is caught its card comes back with handcuffs and a
    // CAUGHT stamp slammed over it, the bounty flies from the card to the coin
    // counter, and the card shrinks to a small badge where the villain stood —
    // marking the lane done until the level ends.
    //
    // The card and the cuffs are drawn in code for now; art can replace them.
    WANTED: {
        ENABLED:    true,
        DEPTH:      5,           // over the villains (4)
        // Size: H_FRAC of a lane's band high, ASPECT wide per unit of height —
        // and narrowed (keeping ASPECT) if the villain area is narrower.
        H_FRAC:     0.95,
        ASPECT:     0.78,
        EDGE_PAD:   8,           // px @ design kept clear of the area's edges

        PAPER:      '#f4e2b4',
        BORDER:     '#6b4423',
        TITLE:      'WANTED',
        TITLE_COLOR:'#8a1c10',
        REWARD_COLOR:'#3b2412',

        // THE INTRO, at a level's start.
        INTRO: {
            START_DELAY_MS: 150, // after the level's villains start to appear
            STAGGER_MS:     150, // between one lane's card and the next
            POP_MS:         320,
            HOLD_MS:        1200,// all three up, before they go
            OUT_MS:         280, // shrinking into the villain
        },

        // THE CATCH.
        CATCH: {
            DELAY_MS:   200,     // after the villain starts to go (with a
                                 // getaway car: after it is blocked)
            POP_MS:     260,
            STAMP_MS:   220,     // the cuffs and stamp slamming down
            HOLD_MS:    700,     // after the stamp, before it shrinks
            SHRINK_MS:  300,
            BADGE_SCALE: 0.5,    // the done marker, as a share of the card
            SHAKE_MS:   120,
            SHAKE:      0.004,   // camera shake intensity (0 = none)
            STAMP_TEXT: 'CAUGHT',
            STAMP_COLOR:'#c62828',
            CUFF_COLOR: '#b8c0c8',
            CUFF_DARK:  '#3a4048',
        },
    },

    // ── THE PIGGY STEERS ─────────────────────────────────────────────────────
    // A piggy in a slot is drawn as its piggy with its steering wheel as a
    // separate sprite on top, and the wheel turns the way a driver's does:
    // small corrections, now and then a proper turn that is held a moment,
    // and back to centre. Each slot has its OWN driver (DRIVERS, in slot order)
    // so the three never move in step.
    //
    // How one driver steers: every HOLD_MIN..HOLD_MAX seconds it picks a new
    // wheel angle — back to centre (CENTER_CHANCE), a big turn of up to BIG_DEG
    // (BIG_CHANCE), or else a small correction of up to SMALL_DEG — and the
    // wheel swings there on a spring: STIFFNESS is how quickly (higher =
    // snappier hands), DAMPING how much it settles rather than overshoots
    // (1 = no overshoot, below 1 = a little wobble past the mark).
    STEERING: {
        DRIVERS: [
            // Calm on the motorway: small corrections, rarely a real turn.
            { SMALL_DEG: 18, BIG_DEG: 75,  BIG_CHANCE: 0.10, CENTER_CHANCE: 0.35,
              HOLD_MIN: 0.6, HOLD_MAX: 1.6, STIFFNESS: 5,   DAMPING: 0.95 },
            // Lively on a twisty road: quick hands, frequent turns.
            { SMALL_DEG: 40, BIG_DEG: 120, BIG_CHANCE: 0.25, CENTER_CHANCE: 0.20,
              HOLD_MIN: 0.3, HOLD_MAX: 0.9, STIFFNESS: 9,   DAMPING: 0.75 },
            // Lazy and sweeping: long holds, big slow hand-over-hand turns.
            { SMALL_DEG: 12, BIG_DEG: 170, BIG_CHANCE: 0.30, CENTER_CHANCE: 0.30,
              HOLD_MIN: 1.0, HOLD_MAX: 2.4, STIFFNESS: 3,   DAMPING: 1.0 },
        ],
    },

    // ===================================================================
    // THE CAR AREA
    // ===================================================================
    // The half beside the merge grid: the three slots stacked down its LEFT
    // edge, a car beside each, and the villains to the right. Every charge
    // tick each piggy in a slot drives its car its own distance
    // (CHARGE_PER_SECOND_BY_LEVEL, metres per second) closer to its villain.
    CAR_AREA: {
        // The slot column, down the area's left edge (px @ design).
        SLOT_COLUMN_PAD: 28,     // area's left edge → slot's left edge
        SLOT_COLUMN_GAP: 28,     // slot's right edge → where the empty car
                                 // area starts (see GameScene.carArea)
        // One slot (with its rate label) gets a third of BAND_FRAC of the
        // area's height; the slot square is SLOT_FRAC of that, capped at a
        // grid cell.
        BAND_FRAC: 0.9,
        SLOT_FRAC: 0.62,
        RATE_SUFFIX: ' m/s',     // after each slot's figure
    },

    // ── THE CAR ──────────────────────────────────────────────────────────────
    // One car per slot, built from graphics/car: the right-facing body and two
    // copies of the tyre. Positions are in the BODY's own pixels — its top-left
    // at 0,0 — and give each tyre's TOP-LEFT corner. The whole car is then
    // scaled as one, and placed by the point under its middle where the tyres
    // meet the ground (see _makeCar), so it always stands ON the line it is
    // given.
    CAR: {
        BODY_W: 254,             // the body art's size, px
        BODY_H: 107,
        TYRE_SIZE: 53,           // the tyre art's size, px (square)
        TYRES: [
            { x: 32,  y: 76 },   // rear
            { x: 175, y: 74 },   // front
        ],
        TYRES_IN_FRONT: true,    // tyres drawn over the body's dark arches

        // ONE CAR PER SLOT, its road the line through the slot's bottom edge.
        // Sized to WIDTH_FRAC of the car area's width, but never taller (ground
        // to roof) than MAX_H_FRAC of a slot. Its LEFT edge sits LEFT_GAP px
        // (@ design) into the car area — close beside its slot, which is
        // CAR_AREA.SLOT_COLUMN_GAP away — so the space to its right is free for
        // the villains (GameScene.villainArea).
        WIDTH_FRAC: 0.45,
        // …and then scaled by this, whatever capped it above — 0.8 is 20%
        // smaller. The car shrinks toward its slot; the villains keep the size
        // and place the full-size car gives them.
        SCALE:      0.8,
        MAX_H_FRAC: 1,
        LEFT_GAP:   0,
        DEPTH:      4,

        // THE TYRES TURN while the car's slot has a piggy driver in it. Both
        // tyres of a car share one angle. They speed up to SPIN_DEG_PER_SEC
        // when a piggy is put in and coast to a stop when it is taken out —
        // SPIN_EASE is how quickly they get there (per second).
        SPIN_DEG_PER_SEC: 540,
        SPIN_EASE:        4,
    },
};

// -------------------------------------------------------------------
// Battery image helpers
// -------------------------------------------------------------------

// WHICH OF THE 90 PICTURES a level shows (one per steering wheel — see
// ITEM_ART). Past the last one it WRAPS, not clamps — level 91 shows level 1's
// picture again, and so on forever. The piggy inside the picture loops on its
// own every 28 (itemPiggyIndex). This is the one place that
// decision is made: everywhere else that draws a pig's icon calls this first
// (see AssetManager and every dressWhenReady call site in game.js), so a
// change here is a change everywhere at once.
//
// The LEVEL NUMBER itself is never touched by this — "PIGGY 61" still reads
// 61, and its charge is still level 61's own real figure (see
// getBatteryChargeValue). Only the PICTURE loops; the progression underneath
// it does not.
function getBatteryIconLevel(level) {
    const highest = getHighestBatteryLevel();
    if (highest < 1) return level;
    if (level <= highest) return level;
    return ((level - 1) % highest) + 1;
}

// ===================================================================
// SPRITE SIZE QUICK REFERENCE
// ===================================================================
// Grid & Batteries:
//   • Grid cell (empty/filled):        130 × 130 px  (CELL.SIZE)
//   • Battery sprite in grid cell:      64 × 64 px   (CELL.BATTERY_DISPLAY_SIZE)
//   • Battery level text offset:        +40 px Y     (CELL.LEVEL_TEXT_Y_OFFSET, below icon)
//
// Platform/Charger System:
//   • Charger slot (battery holder):   130 × 130 px  (PLATFORM.SLOT_SIZE) — same as grid cell
//   • Debug rect (max gadget area):    170 × 113 px  (PLATFORM.DEBUG_RECT_WIDTH × WIDTH/ASPECT_RATIO, 3:2)
//   • Tooth area (toothbrush level):   200 × 80 px   (PLATFORM.TOOTH_AREA_WIDTH × WIDTH/ASPECT_RATIO, 2.5:1)
//   • Gadget sprite (within debug):    auto-sized    (aspect ratio preserved, centered horizontally, touching bottom)
//   • Socket (on slot):                 40 × 40 px   (PLATFORM.SOCKET_SIZE)
//   • Plug (on wire):                   28 × 28 px   (PLATFORM.PLUG_SIZE)
//   • Platform stripe height:           18 px        (PLATFORM.STRIPE_HEIGHT)
//
// Meter (analog gauge):
//   • Meter radius:                     62 px        (PLATFORM.METER_RADIUS)
//   • Meter diameter (approx):         124 px        (2 × radius)
//
// UI Elements:
//   • Button battery icon:              64 × 64 px   (BUTTON.BATTERY_ICON_WIDTH/HEIGHT)
//   • Button coin icon:                 50 × 50 px   (BUTTON.COIN_ICON_WIDTH/HEIGHT)
//   • Coin counter icon:                40 × 40 px   (COIN_COUNTER.COIN_ICON_WIDTH/HEIGHT)
//   • Reward coin (animation):          32 × 32 px   (COIN_REWARD_ANIMATION.REWARD_COIN_SIZE)
//   • Spawn button:                    250 × 90 px   (BUTTON.SPAWN_WIDTH/HEIGHT)
//   • Level-up button:                 180 × 70 px   (BUTTON.LEVELUP_WIDTH/HEIGHT)
// ===================================================================
