// src/inputsticks.ts — the raw virtual-gamepad snapshot the web front ends hand engine_input every frame, built from the
// held keys and the CAPTURED mouse (pointer lock, src/mouselook.ts). DOM-free and import-free, so a node gate
// (tools/mouselook_test.ts) runs it as is. The desktop shim builds the same snapshot in C (platforms/desktop/desktop_main.cpp)
// and the two must agree:
//   LY = W − S, LX = D − A                       the move stick (Movement / the Move action)
//   RX = (Left − Right) · rate · dt − mouse dx    the per-frame LOOK delta: a mouse moving right turns right (yaw falls)
//   RY = (Up − Down) · rate · dt − mouse dy       a mouse moving up (the browser's dy < 0) looks up (pitch rises)
//   E / Q → pad R / L                            fly up / down (Movement "simple")
// WHY (2026-10-01): the editor's Play and the web player had NO mouse look (arrows only), so a first-person walker could
// not aim; the snapshot was also built inline in engine.ts, where no test could reach it.
export const ARROW_RATE = 480; // arrow-key look in look-units per second — the desktop's ARROW_RATE
export const PAD_L = 8, PAD_R = 9; // input_raw.h's PAD_* ids (the order is fixed there)
/** `key(code)` = 1 while that KeyboardEvent.code is held, else 0. `mouseDx/Dy` = captured mouse movement this frame (px). */
export function rawSticks(key, dt, mouseDx = 0, mouseDy = 0) {
    let pad = 0;
    if (key("KeyE"))
        pad |= 1 << PAD_R; // fly up
    if (key("KeyQ"))
        pad |= 1 << PAD_L; // fly down
    return {
        lx: key("KeyD") - key("KeyA"),
        ly: key("KeyW") - key("KeyS"),
        rx: (key("ArrowLeft") - key("ArrowRight")) * ARROW_RATE * dt - mouseDx,
        ry: (key("ArrowUp") - key("ArrowDown")) * ARROW_RATE * dt - mouseDy,
        pad,
    };
}
