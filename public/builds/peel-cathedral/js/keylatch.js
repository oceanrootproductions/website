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
    // THE KEYBOARD FOLLOWS A PRESS (2026-11-15, the owner's report: "i cannot press P to pause or do any actions with the keyboard when
    // i'm fullscreen" — the Cathedral on the OceanRoot website, Chrome, the site's own Fullscreen button). A game on a website or a portal
    // runs inside a FRAME, and keys go to whichever page holds the keyboard. A click normally hands it over, but only when nothing
    // cancels the click: mouselook.ts cancels the capturing click (preventDefault, so it presses nothing else), and a cancelled click
    // moves no keyboard. So once anything on the framing page took the keyboard (its Fullscreen button, a link, the page itself), every
    // click on the game hid the mouse and the keys went on reaching the framing page. Measured in headless Chrome on a copy of the site's
    // player: P heard by the game 0 times after the button, 0 after a click; with this, 1 after one click, the mouse still captured.
    // HERE, not in mouselook: the claim belongs to the window that reads the keys, so no click handler, today's or a later one, can
    // cancel it away. Capture phase on the window, `pointerdown` (mouse, pen and touch; it fires before the mousedown that gets cancelled).
    // Not covered: a framing page that keeps the keyboard WITHOUT a click on the game (its own button pressed last) — only that page can
    // hand it back, so the OceanRoot website's player now does (OceanRootWebsite src/components/GamePlayer.tsx). tools/framefocus_test.ts
    // holds this in a real browser, a cross-origin frame like a portal's.
    const win = target.focus && target.document ? target : null;
    if (win)
        win.addEventListener("pointerdown", () => { if (!win.document.hasFocus())
            win.focus(); }, true);
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
