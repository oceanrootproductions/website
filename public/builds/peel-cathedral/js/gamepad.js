// src/gamepad.ts — A REAL CONTROLLER IN A BROWSER (docs/controllers-plan.md C3, 2026-11-15): the web player's and the editor's Play.
// One implementation, two callers (play.ts, viewport.ts). It READS the controller (the browser's Gamepad API) and the caller hands the
// reading to the engine (engine.pad → engine_pad → input_set_pad), which applies the dead zone and the look's speed and judges which
// device is in use — the same rule as the desktop's (engine/scene/input_pad.h, input.h).
//
// WHY: until today the web read no controller at all (no getGamepads anywhere in platforms/web/src), while the Cathedral's web menu
// already said "P, or B / Circle, to go back" — a button the page could not hear. The owner: "support the controls in all platforms
// that can potentially support it".
//
// THE STANDARD LAYOUT (the W3C Gamepad spec's "standard" mapping, which Chrome, Edge, Firefox and Safari give the pads they know):
// buttons 0–3 the face buttons by POSITION (bottom, right, left, top — the same south/east/west/north SDL names on the desktop, so a
// PS5's Cross is PAD_A here too), 4/5 the shoulders, 8 select, 9 start, 12–15 the d-pad; axes 0/1 the left stick, 2/3 the right, y
// running DOWN as SDL's does. A pad the browser could not map (`mapping` is "") is not read: its buttons could mean anything, and a
// Back that jumps is worse than none (said, in the log, once).
//
// THE FAMILY comes from the browser's `id` string, which each browser spells its own way (FAMILY_BY_ID below; one canary per spelling
// in tools/webpad_test.ts): Chrome "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)", Firefox
// "054c-0ce6-DualSense Wireless Controller", Safari "DualSense Wireless Controller". The USB vendor id is the surest part; the name is
// the fallback for the one that drops it.
//
// LIMITS (said): the Gamepad API is POLLED, not evented — a press and release between two frames is lost (the desktop keeps such taps;
// at 60 fps the window is 16 ms, shorter than a real press). A page that frames the game must allow "gamepad" (the website's player
// and the portals do: allow="gamepad"); where it does not, getGamepads throws and the reader quietly reads nothing.
import { PAD_BITS, PAD_FAMILY_IDS } from "./inputkeys.gen.js";
// The standard mapping's button index → the virtual pad's button (by NAME: PAD_BITS is generated from schema.ts's rows).
const STANDARD = [
    [0, "A"], [1, "B"], [2, "X"], [3, "Y"], [4, "L"], [5, "R"], [8, "Select"], [9, "Start"], [12, "Up"], [13, "Down"], [14, "Left"], [15, "Right"],
];
// The browser's id → the family. Vendor ids first (054c Sony, 045e Microsoft, 057e Nintendo), in either spelling: Chrome's "Vendor: 054c",
// Firefox's "054c-0ce6-…"; then the product names Safari gives with no id.
export const FAMILY_BY_ID = [
    [/vendor: 054c|^054c-|dualsense|dualshock|playstation/i, "playstation"],
    [/vendor: 045e|^045e-|xbox|xinput/i, "xbox"],
    [/vendor: 057e|^057e-|nintendo|pro controller|joy-con/i, "nintendo"],
];
export function padFamily(id) {
    for (const [re, fam] of FAMILY_BY_ID)
        if (re.test(id))
            return PAD_FAMILY_IDS[fam];
    return PAD_FAMILY_IDS.generic;
}
export const NO_PAD = { lx: 0, ly: 0, rx: 0, ry: 0, buttons: 0, connected: false, family: 0 };
/** The editor tick's form (engine_core_editor_frame's `pad`): [lx, ly, rx, ry, buttons, connected, family]; none = no field at all. */
export function padPacket(r) {
    return r.connected ? [r.lx, r.ly, r.rx, r.ry, r.buttons, 1, r.family] : undefined;
}
export class PadReader {
    // plain fields, not constructor parameter properties: node's type stripping (the gates run this very file) does not take those
    constructor(nav, log) {
        this.said = new Set();
        this.nav = nav ?? globalThis.navigator ?? {};
        this.log = log ?? ((m) => console.info(m));
    }
    once(key, m) { if (!this.said.has(key)) {
        this.said.add(key);
        this.log(m);
    } }
    /** This frame's controller: the first connected pad with the standard layout. */
    read() {
        let pads = [];
        try {
            pads = this.nav.getGamepads?.() ?? [];
        }
        catch {
            this.once("blocked", "[pad] this page may not read controllers (the page framing the game does not allow \"gamepad\")");
            return NO_PAD;
        }
        for (const g of pads) {
            if (!g || !g.connected)
                continue;
            if (g.mapping !== "standard") {
                this.once("map:" + g.id, `[pad] "${g.id}": the browser has no standard layout for it — not read`);
                continue;
            }
            let buttons = 0;
            for (const [i, name] of STANDARD)
                if (g.buttons[i]?.pressed)
                    buttons |= 1 << PAD_BITS[name];
            const fam = padFamily(g.id);
            this.once("pad:" + g.id, `[pad] controller: ${g.id}`);
            return { lx: g.axes[0] ?? 0, ly: g.axes[1] ?? 0, rx: g.axes[2] ?? 0, ry: g.axes[3] ?? 0, buttons, connected: true, family: fam };
        }
        return NO_PAD;
    }
}
