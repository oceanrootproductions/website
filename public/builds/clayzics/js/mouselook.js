/** `press(x, y)`: the gameplay pointer pressed at (x, y) in the view's BACKING-STORE pixels (engine.pointerMove + pointerButton).
 *  `refused(e, stillDown)`: a click that asked for the capture and was REFUSED — deliver it as the caller's ordinary click at the
 *  event's position; `stillDown` false = release it at once too (above). */
export function attachMouseLook(view, wants, playing, press, refused) {
    let dx = 0, dy = 0;
    const captured = () => document.pointerLockElement === view;
    let pending = null; // a click that asked for the capture, not yet answered
    const refuse = () => { if (!pending)
        return; const p = pending; pending = null; refused(p.e, p.down); };
    document.addEventListener("pointerlockerror", refuse);
    document.addEventListener("pointerlockchange", () => { if (captured())
        pending = null; }); // granted: the click captured
    document.addEventListener("mouseup", (e) => { if (e.button === 0 && pending)
        pending.down = false; });
    view.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || !playing() || !wants())
            return;
        if (captured()) { // the crosshair click (above): a press at the centre, nothing else
            e.preventDefault();
            e.stopImmediatePropagation();
            const c = view; // a canvas's width/height ARE its backing store (the engine's pixels)
            press(Math.round((c.width || view.clientWidth) / 2), Math.round((c.height || view.clientHeight) / 2));
            return;
        }
        e.preventDefault();
        e.stopImmediatePropagation(); // this click captures — it presses nothing else (unless refused)
        document.activeElement?.blur?.();
        pending = { e, down: true };
        const lock = view.requestPointerLock;
        if (!lock) {
            refuse();
            return;
        } // a browser without pointer lock at all: the click is an ordinary one
        const req = lock.call(view);
        if (req && typeof req.catch === "function")
            req.catch(refuse); // Chrome's promise form
    }, { capture: true });
    document.addEventListener("mousemove", (e) => { if (captured()) {
        dx += e.movementX;
        dy += e.movementY;
    } });
    return {
        captured,
        take() { const r = captured() ? [dx, dy] : [0, 0]; dx = 0; dy = 0; return r; },
        release() { if (captured())
            document.exitPointerLock(); dx = 0; dy = 0; },
    };
}
// THE OTHER BUTTONS (2026-10-13, the inspect view's "back"): the right and middle buttons reach the GAME too — the engine's
// pointer buttons 1 (secondary: the DOM's 2) and 2 (middle: the DOM's 1), input.h POINTER_BUTTONS. Until now only the
// primary button was wired on the web (play.ts and viewport.ts both tested `e.button === 0`), so input.pointerPressed(1) read
// false forever in the browser. Captured, the press lands at the view's centre (the cursor is hidden, like the crosshair
// click); free, at the cursor. While playing, the browser's context menu is suppressed — a right-click opened it over the game.
// The primary button stays where it was (mouselook's crosshair click above, the callers' own mousedown).
export const ENGINE_BUTTON_OF_DOM = { 0: 0, 2: 1, 1: 2 };
export function attachOtherButtons(view, playing, captured, at, down, up) {
    const held = new Set();
    view.addEventListener("mousedown", (e) => {
        const b = ENGINE_BUTTON_OF_DOM[e.button];
        if (!playing() || b === undefined || b === 0)
            return;
        e.preventDefault(); // no middle-click autoscroll
        const [x, y] = captured() ? [Math.round((view.width || view.clientWidth) / 2), Math.round((view.height || view.clientHeight) / 2)] : at(e);
        held.add(b);
        down(b, x, y);
    });
    document.addEventListener("mouseup", (e) => {
        const b = ENGINE_BUTTON_OF_DOM[e.button];
        if (b === undefined || b === 0 || !held.has(b))
            return;
        held.delete(b);
        up(b);
    });
    view.addEventListener("contextmenu", (e) => { if (playing())
        e.preventDefault(); });
}
/** The browser's wheel delta in NOTCHES, positive DOWN (the UI's convention): deltaMode 0 = pixels (~100 a notch; a trackpad
 *  gives small smooth values), 1 = lines, 2 = pages. One rule for the player and the editor's Play. */
export function wheelNotches(e) {
    return e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * 16 : e.deltaY / 100;
}
