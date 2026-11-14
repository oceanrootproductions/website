// src/keylatch.ts — the KEYS a web front end hands the engine each frame (the editor's Play and the web player — one implementation,
// two callers; each kept its own Set-based copy until 2026-10-08). It imports nothing (the callers hand it KEY_CODE_BITS), so the
// node gate (tools/mouselook_test.ts) runs this very file.
//
// WHY a latch, not "the keys held right now": the front ends feed the engine once per animation frame (engine.input(bits)), and a
// key pressed AND released between two frames was never held at any snapshot — the tap vanished. Measured in the editor's Play on
// 2026-10-08: an instant tap of E (Sunny Seaside's Use) pressed nothing, a 150 ms hold worked; at the editor's 25 fps on the heavy
// lobby (40 ms frames) a quick real tap is that short. So a snapshot is "held now OR pressed since the last snapshot": a tap is
// seen down for exactly ONE snapshot, then up. (The engine keeps a one-snapshot press alive across frames that run no fixed step —
// engine/scene/input.cpp `sticky` — so the press reaches the game whatever the frame rate.) Mouse buttons need none of this: they
// reach the engine as events (engine.pointerButton), not as a per-frame sample.
// Not caught: a key RELEASED and pressed again inside one frame while it was already down at the last snapshot reads as one long
// hold (no up in between) — two presses of one key within ~16–40 ms.
export class KeyLatch {
    constructor() {
        this.held = new Set();
        this.tapped = 0; // bits pressed since the last snapshot
    }
    down(bit) { this.held.add(bit); this.tapped |= 1 << bit; }
    up(bit) { this.held.delete(bit); }
    /** Everything forgotten (the window lost focus: a key released while it was away must not stay held). */
    clear() { this.held.clear(); this.tapped = 0; }
    /** This frame's engine key bits: held now, or pressed since the last snapshot. Resets the "since". */
    snapshot() {
        let bits = this.tapped;
        this.held.forEach((b) => (bits |= 1 << b));
        this.tapped = 0;
        return bits;
    }
}
/** Wire a window's keyboard into a KeyLatch. `bits` = KEY_CODE_BITS (a key code → its engine key bit; codes not in it are not the
 *  game's). `accept(e)` decides whether a keydown is the game's (playing, not typing in a field);
 *  `onDown(e)` runs after a recorded keydown (a caller's preventDefault rules). A keyup always releases — a key the game took must
 *  never stay held because the caller stopped listening in between. */
export function attachKeyLatch(target, bits, accept, onDown) {
    const latch = new KeyLatch();
    target.addEventListener("keydown", (e) => {
        if (!accept(e))
            return;
        const b = bits[e.code];
        if (b === undefined)
            return;
        latch.down(b);
        onDown?.(e);
    });
    target.addEventListener("keyup", (e) => { const b = bits[e.code]; if (b !== undefined)
        latch.up(b); });
    target.addEventListener("blur", () => latch.clear());
    return latch;
}
