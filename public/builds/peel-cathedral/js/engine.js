// Typed wrapper around the editor's engine: the SAME engine_api the device runs, so the viewport can never drift from the game.
// In a browser it is the C++ engine compiled to WebAssembly (browserhost.ts); in the desktop app, the native engine on its own thread
// (apphost.ts). Everything here goes through the engine's DOOR (both editors' rows) or the HOST's half (enginehost.ts) — never a
// host's own rows directly (P2 step 2).
import { KEY_CODE_BITS } from "./inputkeys.gen.js";
import { rawSticks } from "./inputsticks.js"; // the raw snapshot (keys + the captured mouse) — one formula, tested
import { refId, refName } from "./refs.js"; // the engine's one id rule (ga_ref_id), for the model-material copy
import { BrowserHost } from "./browserhost.js";
import { AppHost, appBridges } from "./apphost.js";
import { shaderTakes } from "./takes.js"; // THE TAKE (plan §5): which files, said once for both editors   // 2026-10-01: the pack in pieces (a browser refuses one buffer of 2 GiB+)
export class Engine {
    constructor() {
        // (An imported file's bytes are the ENGINE's once taken — takeFiles below. Until 2026-10-31 this class kept three tables of the
        // heap blocks the registry pointed into, freeing the one a re-import superseded; the engine keeps them now, for both editors.)
        this.liveReload = []; // liveReloadComponents' answer — the engine's table is FIXED at build, so it is asked once, at boot
        /** `editor`: the EDITOR's engine build (main.ts) — the web player (play.ts) runs the GAME's build, which has none of the table's
         *  editor rows, so nothing here may ask one unless this is set: 2026-10-30, reading the editor's live-reload list at boot failed the
         *  shipped player's boot by name ("engine.wasm is older than the page's scripts") — the playtest caught it. */
        this.editor = false;
        this.memRulesCopy = null;
        /** MODEL MATERIALS (docs/model-materials-plan.md): the engine's table — which model material each mesh slot FOLLOWS, and how many
         *  slots a mesh has — COPIED here in one question (engine_mesh_material_table) and read at once: the inspector draws with it, and
         *  in the desktop app a question per slot would be a round trip to the engine thread each (P1 step 4). The copy is refreshed
         *  wherever the table can change: every pack this class loads (loadAssets) and the live import (refreshModelMaterials, awaited by
         *  the importer once its meshes and their materials are in). */
        this.modelTable = { follows: {}, slots: {} };
    }
    /** The picture's size in pixels (#view's backing store, as last resized) and how it is shown — the host's. */
    get width() { return this.host.width; }
    get height() { return this.host.height; }
    /** true: the host shows the picture (WebGPU into #view, or the desktop app's frames); false: the software build's framebuffer. */
    get gpu() { return this.host.gpu; }
    /** The browser HOST's own rows (engineapi.ts where: "web"): its WebGPU device and frame, the pack and the bytes it pushes, the
     *  previews, the decode helpers — for the browser-only gates (engine.web.*). In the desktop app there are none: asking is an error. */
    get web() { return this.browser("engine.web").web; }
    /** The browser's streaming decode helpers (decodeclient.ts) — null in the desktop app, whose engine decodes on its own threads. */
    get decode() { return this.host instanceof BrowserHost ? this.host.decode : null; }
    /** The host is the desktop app's when the page runs inside it (its preload says so: apphost.ts appBridges), else this page's
     *  WebAssembly engine. Either way the engine is up when this answers; the project is the boot's to load. */
    /** `packFirst` (the web player, the plan's (c4)): its pack, loaded after the engine starts and before its renderer is made, so the engine's
     *  shaders come from the pack (browserhost.ts start). The desktop app's engine is native and loads its own. */
    static async create(opts = {}) {
        const e = new Engine();
        e.editor = !!opts.editor;
        LIVE = e; // the editor's one engine — flows without a threaded ref reach it via liveEngine()
        const app = appBridges();
        const packFirst = opts.packFirst;
        e.host = app ? await AppHost.start(app.app, app.bridge, document.getElementById("view"))
            : await BrowserHost.start(packFirst ? { beforeRenderer: async (h) => { h.loadAssets(await packFirst); } } : {});
        e.api = e.host.api;
        if (e.editor)
            e.liveReload = (await e.api.engine_live_reload_components()).split(",").filter(Boolean); // a fact of the build: read once
        try {
            e.memRulesCopy = JSON.parse(await e.api.engine_mem_rules());
        }
        catch {
            e.memRulesCopy = null;
        } // …and so are these
        return e;
    }
    /** The browser host, for what only it has — or an error that names the call: the desktop app has no such thing. */
    browser(what) {
        if (this.host instanceof BrowserHost)
            return this.host;
        throw new Error(`${what} is the browser engine's own — the desktop app's engine has none (docs/editor-app-plan.md P2 step 2)`);
    }
    /** Keep the GPU render (depth + viewport) matched to #view's ACTUAL backing-store size — cv.width/height, which the VIEWPORT
     *  sets (viewport.ts: in Auto it follows the canvas's box through a ResizeObserver; a fixed resolution forces it). Nothing
     *  else sizes it: this comment used to say WebGPU/Dawn resizes the drawing buffer to the CSS box × DPR — it does not, and that
     *  belief hid the flat view of a page booted hidden (2026-10-20). Cheap (no layout query), safe to call every frame: a no-op
     *  unless the backing store actually changed. */
    resize() {
        if (!this.host.gpu)
            return;
        const cv = document.getElementById("view");
        this.host.resize(cv.width, cv.height);
    }
    /** Save service: arm it AFTER setting Module.oceanSaveKey/Sink/Load (the editor points these at
     *  the dev server; the shipped player keys localStorage per game). Then load/flush as needed. */
    saveInit() { this.api.engine_save_init(); }
    async saveLoad(json) { await this.api.engine_save_load(json); }
    saveFlush() { this.api.engine_save_flush(); }
    /** M1: the memory ledger's classes, in the engine's order (the RHI's one name table) — the stats are fe.gpu.<name>.mb. */
    async memClasses() {
        const out = [];
        for (let i = 0; i < 64; i++) {
            const n = await this.api.engine_mem_class_name(i);
            if (!n)
                break;
            out.push(n);
        }
        return out;
    }
    /** Memory plan M2: the rule's constants (the engine's one spelling — the editor describes each platform's automatic number from them).
     *  Constants of the build, so asked ONCE, at boot (create), and read at once by the settings that describe them. null = an engine
     *  without the door. */
    memRules() { return this.memRulesCopy; }
    /** Memory plan M2 + M3e: this tab's number, where it came from, and every part's [used, share] in MB under the held plan. */
    async memPlan() {
        try {
            return JSON.parse(await this.api.engine_mem_plan());
        }
        catch {
            return null;
        }
    }
    /** M1: what fills memory class `index` (memClasses order): its largest live resources by name, largest first. */
    async memClassTop(index, n = 6) {
        try {
            return JSON.parse(await this.api.engine_mem_class_top(index, n));
        }
        catch {
            return [];
        }
    }
    /** The browser engine's Emscripten Module — main.ts points its save hooks at the helper (editor-only). An empty object in the desktop
     *  app, whose engine has none: the Play saves' native path is P2 step 5 (until then the app's Play saves go nowhere — said there). */
    get module() { return this.host.module; }
    /** Load the open project's assets.pack — the browser fetches it in pieces and hands it over, the desktop app's engine reads it by
     *  path (enginehost.ts). Answers the asset count, or null when the project has none yet (a fresh project: normal). `reload`: the
     *  helper changed it (an import, a delete). Throws when the pack is there but could not be loaded. Answers once the editor's copy
     *  of the pack's model-material table is refreshed (refreshModelMaterials). */
    async loadProjectPack(reload) {
        const n = await this.host.loadProjectPack(reload);
        if (this.editor)
            await this.refreshModelMaterials(); // an accepted pack brings its own model-material table (a refused one leaves the old)
        return n;
    }
    /** The web PLAYER's pack (play.ts), already fetched — the browser's door alone (residency S1, the page-held pack: browserhost.ts). */
    async loadAssets(pack) {
        const n = this.browser("loadAssets(pack)").loadAssets(pack);
        if (this.editor)
            await this.refreshModelMaterials(); // the player has no screens that read it
        return n;
    }
    /** Load a scene from JSON text (the device's loader, verbatim). Returns entity count.
     *  NOTE this REBUILDS EVERYTHING — in Play that restarts the running game (every script is a fresh
     *  object, so start() runs again). For a value edit use syncEntity below. */
    async loadScene(json) {
        return await this.api.engine_load_scene_json(json);
    }
    /** T2d: the load-time residency door (web parity with the native mains). Warms every scene mesh,
     *  material tuple, prefab and UI screen NOW — behind the boot moment — instead of paying lazy
     *  uploads mid-game (the measured 423 ms editor stalls). Call once after assets + scene + UI.
     *  try/catch: a pre-T2d engine.wasm has no such export — the editor then keeps today's lazy
     *  behavior until its next wasm rebuild (the T0 aniso precedent), instead of throwing at boot. */
    /** The UI's warm + its memory plan (engine_ui_warm) — the editor calls it once its UI channel has delivered everything, BEFORE
     *  the asset previews admit any geometry (main.ts has why); makeResident calls it again for the web player. */
    warmUi() {
        if (!this.host.hasHud)
            return; // an engine built without the HUD module (enginehost.ts hasHud) — nothing to warm
        try {
            this.api.engine_ui_warm();
        }
        catch { /* pre-2026-10-03 wasm: makeResident still warms it */ }
    }
    makeResident() {
        try {
            this.api.engine_make_resident();
        }
        catch { /* pre-T2d wasm — lazy path */ }
    }
    // ---- asset-tile previews (docs/editor-preview-cache-plan.md phase 3) -----------------------------
    // An ISOLATED scene rendered onto its own off-screen canvas (#pview in index.html). Nothing here can
    // touch the live scene, the viewport or the live draw list — which is why, unlike the path it
    // replaces, there is no "restore the real scene afterwards" step and no rule about when it is safe.
    /** AN ASSET TILE: `scene` drawn by the isolated preview from `view`, `size` px square — the host's picture of it (enginehost.ts:
     *  the browser's preview canvas, the desktop app's read-back pixels). null = nothing drew: keep the glyph. Callers size `view.pos`
     *  from the mesh's real bounding radius. */
    previewPicture(scene, view, size) {
        return this.host.previewPicture(scene, view, size);
    }
    /** The engine's named counters (core/stats.h) as an object — fe.lazy.pipeline, fe.warm.texture and
     *  the rest. Poll about once a second; it walks the whole table and formats JSON.
     *  This exists because "the editor is slow and the engine's own timers say it is idle" could only be
     *  answered by guessing before: the CPU/GPU numbers in the perf HUD measure the frame, not the
     *  first-use work (pipeline compiles, uploads) that makes a frame long. */
    async stats() {
        try {
            return JSON.parse(await this.api.engine_stats_json());
        }
        catch {
            return {};
        }
    }
    /** The texture cache's entry for ONE registry texture (engine_texcache_probe): lv_res (the resident mip floor, 0 =
     *  the whole chain), lv_levels, lv_native (0 = transcoded on the device), tex_id, kb, w/h, bound, stream_on — the
     *  per-texture reading behind "why does this texture draw as a flat tint". Born for the decal atlas (2026-09-23),
     *  usable for any name in the registry. {found:0} when it is not registered or not uploaded yet; {found:-1} on a
     *  wasm that predates the door. Read-only: it never uploads. */
    async texcacheProbe(name) {
        try {
            return JSON.parse(await this.api.engine_texcache_probe(name));
        }
        catch {
            return { found: -1 };
        }
    }
    /** Apply one entity's value components to the LIVE scene — no rebuild, no script restart, no physics
     *  reset (contract + scope: runtime/scene_json.h). `json` is a single entity object. Returns false if
     *  the engine could not do it in place, and the caller falls back to a full loadScene. */
    async syncEntity(idx, json) {
        return await this.api.engine_sync_entity(idx, json) === 1;
    }
    /** The components syncEntity does NOT apply in place — an edit of one needs the scene reloaded (its runtime state, e.g. a
     *  clip's time or a pooled row, would be reset). Read from the engine's one table (runtime/scene_json.cpp HAND_PARSED), never
     *  listed here: the door used to skip hand-parsed components with no word to the editor, so a Light edit vanished. */
    liveReloadComponents() {
        return this.liveReload;
    }
    /** Build one entity into the LIVE scene. `json` is scene-shaped ({entities:[…], materials:{…}}).
     *  Returns the new engine entity id, or -1 — the id is a SLOT and slots are reused after a destroy,
     *  so callers addressing entities by array index must keep a mapping (store.ts engineIdOf). */
    async addEntity(json) {
        return await this.api.engine_add_entity(json);
    }
    /** Destroy one entity in the LIVE scene, children included. False if it isn't a live entity. */
    async destroyEntity(id) {
        return await this.api.engine_destroy_entity(id) === 1;
    }
    /** Load the in-game HUD document (RmlUi) — the editor calls this on Play with data/ui/hud.rml; scripts then
     *  drive it via ui_set_text/show/hide. uiClear hides it on Stop. Tolerated as a no-op on an engine.wasm
     *  built WITHOUT the UI module (ccall throws on a missing export). */
    uiLoad(rml) { try {
        this.api.engine_ui_load(rml);
    }
    catch { /* no UI build */ } }
    uiClear() { try {
        this.api.engine_ui_clear();
    }
    catch { /* no UI build */ } }
    /** Toggle the in-game debug console overlay (logging milestone): the log tail + a stats line, on top of the
     *  scene. Bound to backtick in the editor; a no-op on a build without the UI module. */
    consoleToggle() { try {
        this.api.engine_console_toggle();
    }
    catch { /* no UI build */ } }
    /** Drain log records with seq > sinceSeq for the editor Console dock/toasts. Fields \x1f-separated, records
     *  newline-separated: "seq\x1flevel\x1fframe\x1fscript\x1fobject\x1fcat\x1fmsg". "" when nothing new. */
    async logDrain(sinceSeq) { try {
        return (await this.api.engine_log_drain(sinceSeq)) || "";
    }
    catch {
        return "";
    } }
    /** Total log entries overwritten in the ring since boot — the Console shows a "…N earlier dropped" marker
     *  when this grows (a burst outran the poll), so gaps aren't silent. */
    async logDropped() { try {
        return (await this.api.engine_log_dropped()) || 0;
    }
    catch {
        return 0;
    } }
    /** Stop looping music — called on the Play→Stop transition (Stop doesn't reload the module, so a track started
     *  via audio.music() would otherwise keep playing in Edit). No-op on an engine.wasm without an audio backend. */
    stopAudio() { try {
        this.api.engine_stop_audio();
    }
    catch { /* no audio build */ } }
    /** Register a UI screen by name (its data/ui/screens/<name>.rml content). The editor registers every screen
     *  once at boot; the running game then shows/hides them by name via ui_open/ui_close. */
    uiRegisterScreen(name, rml) {
        try {
            this.api.engine_ui_register(name, rml);
        }
        catch { /* no UI build */ }
    }
    /** Register a shared file (the project's theme.rcss) that screens reference via <link href="theme.rcss">. */
    uiRegisterFile(name, content) {
        try {
            this.api.engine_ui_register_file(name, content);
        }
        catch { /* no UI build */ }
    }
    /** Register a sprite-animation sidecar (ui/sprites/<name>.sprite.json) so screens can use
     *  `decorator: sprite-anim(name/clip)`. The sheet PNG must be TAKEN first (a "uifile" take — takes.ts spriteTake). */
    uiRegisterSprite(name, json) {
        try {
            this.api.engine_ui_register_sprite(name, json);
        }
        catch { /* no UI build */ }
    }
    /** U2: register the whole ui/ from the loaded pack's project files (theme, images, sprites, screens) —
     *  the same feed native boots through. Returns the screen count; 0 = a pre-unification pack. */
    async uiRegisterPack() {
        try {
            return await this.api.engine_ui_register_pack();
        }
        catch {
            return 0;
        }
    }
    /** M2b-2: register the pack's user shader assets into the frontend (returns the model count). */
    async shadersRegisterPack() {
        try {
            return await this.api.engine_shaders_register_pack();
        }
        catch {
            return 0;
        }
    }
    /** Open / close a registered screen by name — the editor uses these to PREVIEW a screen over the Edit scene
     *  (the game opens screens itself in Play via its scripts). */
    uiOpen(name) { try {
        this.api.engine_ui_open(name);
    }
    catch { /* no UI build */ } }
    uiCloseScreen(name) { try {
        this.api.engine_ui_close(name);
    }
    catch { /* no UI build */ } }
    /** Set a data-bound value ({{key}}) — used to preview a screen with sample data. */
    uiSet(key, value) { try {
        this.api.engine_ui_set(key, value);
    }
    catch { /* no UI build */ } }
    /** Forward the pointer to the in-game HUD (Phase 5 interactive menus). Coords are #view backing-store pixels. */
    uiPointerMove(x, y) {
        try {
            this.api.engine_ui_pointer(x | 0, y | 0, 0, 0);
        }
        catch { /* no UI build */ }
    }
    uiPointerButton(down) {
        try {
            this.api.engine_ui_pointer(0, 0, down ? 1 : 0, 1);
        }
        catch { /* no UI build */ }
    }
    static ptrLoud(fn) {
        if (!Engine.ptrMissing.has(fn)) {
            Engine.ptrMissing.add(fn);
            console.error(`[engine] ${fn} unavailable — the gameplay pointer is dead (stale engine.wasm?)`);
        }
    }
    pointerMove(x, y) {
        try {
            this.api.engine_pointer(x | 0, y | 0, 0, 0);
        }
        catch {
            Engine.ptrLoud("engine_pointer");
        }
    }
    /** `button`: the ENGINE's pointer button (input.h) — 0 primary, 1 secondary (the mouse's right), 2 middle. */
    pointerButton(down, button = 0) {
        try {
            this.api.engine_pointer(0, 0, down ? 1 : 0, (button | 0) + 1);
        }
        catch {
            Engine.ptrLoud("engine_pointer");
        }
    }
    /** The wheel → GAMEPLAY (input.wheel(), the inspect view's zoom). `notches` as uiWheel takes them — positive DOWN; the
     *  engine's are positive AWAY (up), so they are flipped here, once. */
    wheel(notches) {
        try {
            this.api.engine_wheel(-notches);
        }
        catch {
            Engine.ptrLoud("engine_wheel");
        }
    }
    /** A touch finger → the SAME gameplay pointer (a tap reads as a click). phase 0 down / 1 move / 2 up.
     *  The engine decides which finger owns the pointer, so forward them all. */
    pointerTouch(id, x, y, phase) {
        try {
            this.api.engine_pointer_touch(id | 0, x | 0, y | 0, phase | 0);
        }
        catch {
            Engine.ptrLoud("engine_pointer_touch");
        }
    }
    /** A touch-control finger (the web player): framebuffer px; phase 0 = down, 1 = move, 2 = up/cancel.
     *  Elements tagged data-stick / data-button in open screens become held controls; other taps click menus. */
    /** Mouse wheel over the canvas. `notches` is wheel clicks, positive DOWN — callers normalise the
     *  browser's deltaMode-dependent units first (see play.ts), so the engine never sees a raw deltaY. */
    uiWheel(x, y, notches) {
        try {
            this.api.engine_ui_wheel(x | 0, y | 0, notches);
        }
        catch { /* no UI build */ }
    }
    uiTouch(id, x, y, phase) {
        try {
            this.api.engine_ui_touch(id | 0, x | 0, y | 0, phase | 0);
        }
        catch { /* no UI build */ }
    }
    /** Take a list of the project's files (takes.ts — an import's answer, a sprite's sheet, a shader's variants): the browser fetches
     *  each from the helper and pushes it; the desktop app's engine reads them itself. The same list and the same answers in both
     *  (tools/takefiles_test.ts). */
    takeFiles(takes) { return this.host.takeFiles(takes); }
    /** IM4: register a transform CLIP (JSON props) live — a just-imported rigid animation plays without
     *  a reload. The engine copies the keys; nothing to keep alive JS-side. */
    async registerXclip(name, json) {
        try {
            await this.api.engine_register_xclip(name, json, json.length);
        }
        catch { /* an older engine.wasm without the export — the clip arrives via the pack after a reload */ }
    }
    async hasMesh(name) {
        return !!await this.api.engine_has_mesh(name);
    }
    // Canned motion (spin/bob/orbit) — runs every frame, even while editing (non-destructive preview).
    animate(dt) {
        this.api.engine_animate(dt);
    }
    // Feed this frame's raw input from a set of pressed engine key bits (KEY_CODE_BITS values).
    // The editor is a keyboard device: we synthesize the virtual sticks here (WASD→LX/LY,
    // arrows→RX/RY look delta, E/Q→L/R fly) — the same mapping the desktop shim uses — so
    // movement_system responds, while keys[] still drives the action layer (Jump/Fire/…). Call
    // once per Play frame BEFORE play(). dt scales the arrow-look delta (matches desktop's rate).
    // mouseDx/Dy: the CAPTURED mouse's movement this frame (src/mouselook.ts — 0 when not captured), added to the arrows' look.
    input(keybits, dt, mouseDx = 0, mouseDy = 0) {
        const [k, lx, ly, rx, ry, pad] = this.inputSnapshot(keybits, dt, mouseDx, mouseDy);
        this.api.engine_input(k, lx, ly, rx, ry, pad);
    }
    /** The same snapshot as engine_input's arguments — [keybits, lx, ly, rx, ry, pad] — for the editor's tick (frame), which carries it. */
    inputSnapshot(keybits, dt, mouseDx = 0, mouseDy = 0) {
        const B = KEY_CODE_BITS;
        const s = rawSticks((code) => (keybits >> B[code]) & 1, dt, mouseDx, mouseDy);
        return [keybits, s.lx, s.ly, s.rx, s.ry, s.pad];
    }
    // 2026-10-01: the running game asks for the mouse to be captured for look (a Movement "first person" walker is active —
    // movement_wants_mouse_look). The editor's Play and the web player capture it on the next click (src/mouselook.ts).
    async wantsMouseLook() {
        return (await this.api.engine_wants_mouse_look()) !== 0;
    }
    // Gameplay (action input + movement + Condition/Action + scripts) — mutates scene state, so the
    // editor calls this only in Play mode. Stop reverts by reloading the authored scene (applyScene).
    play(dt) {
        this.api.engine_play(dt);
    }
    /** The LIVE input binding table as a `{actions:[...]}` config block (the rebinding UI reads this
     *  to show current/default bindings — no JS-side duplication of the engine's defaults). */
    async inputConfigJson() {
        return await this.api.engine_input_config_json();
    }
    /** Apply an edited binding block live (accepts the bare `{actions:[...]}` or a full `{input:{...}}`).
     *  Returns the number of actions overridden. */
    async loadInputConfig(json) {
        return await this.api.engine_load_input_config(json);
    }
    /** Select the physics backend for Play mode from the project's `{physics:{backend:"jolt"|"off"}}` block
     *  (default Jolt; absent/empty → default). The preview then simulates exactly what the built game will. */
    loadPhysics(json) {
        this.api.engine_load_physics(json);
    }
    setGrid(on) {
        this.api.engine_set_grid(on ? 1 : 0);
    }
    /** Editor collider wireframes (green) on/off. The viewport ties this to Edit mode (off in Play). */
    setColliders(on) {
        this.api.engine_set_colliders(on ? 1 : 0);
    }
    // The light gizmos and the decal / fog VOLUME boxes have no door here: the viewport's tick sends every overlay switch in its frame
    // packet (`over` — src/viewport.ts; the engine's editor frame hands them to engine_set_light_gizmos / engine_set_volume_gizmos). The
    // two doors that stood here had no caller — and no switch fed the packet either: both were "on" whenever the editor was not playing
    // (the Gizmos switch and the Show menu's own, 2026-11-03). Why the boxes exist: a decal / fog-volume Size is in the entity's LOCAL
    // units (its Scale multiplies it); a [40,20,40] decal on a ×10/×21 platform was a 425×857-unit box nobody could see, hunted for hours.
    /** The project's rendering.shadows setting (Project Settings). Off = the zero-cost no-shadows path. */
    /** Apply EVERY project/game setting (input rebinds / physics backend / rendering) in one call — the
     *  shared runtime path all platforms boot through. Pass the baked game.json (or project.json) verbatim. */
    applyProject(json) {
        this.api.engine_apply_project(json);
    }
    /** Project rendering.shadowDistance (m): how far ahead of the camera shadows reach. 0 = the 100 m default. */
    /** Project rendering.uiDataRate: 0 = data-bound values re-layout every frame; 30/15 = batched. */
    setUiDataRate(hz) {
        this.api.engine_set_ui_data_rate(hz);
    }
    /** Project build.mode: production disarms the debug surfaces (console, overlay); development arms them. */
    setProduction(on) {
        this.api.engine_set_production(on ? 1 : 0);
    }
    setShadowDistance(d) {
        this.api.engine_set_shadow_distance(d);
    }
    /** Project rendering.shadowResolution: the directional shadow map's size in texels (1024 / 2048 / 4096; else 2048). */
    setShadowResolution(px) {
        this.api.engine_set_shadow_resolution(px);
    }
    /** Project rendering.shadowCascades: 1..4 slices of the shadow distance, each its own tile of the sun's map (else 1). */
    setShadowCascades(n) {
        this.api.engine_set_shadow_cascades(n);
    }
    setShadows(on) {
        this.api.engine_set_shadows(on ? 1 : 0);
    }
    /** Project rendering.shadows "soft" (S2): the 4-tap PCF filter. Orthogonal to setShadows — Off/Hard/Soft
     *  maps to (on, soft) = (false,·) / (true,false) / (true,true). Live: the value rides the per-frame UBO. */
    setShadowFilter(soft) {
        this.api.engine_set_shadow_filter(soft ? 1 : 0);
    }
    /** Project rendering.shadowUpdate (S5a): "high" / "medium" (default) / "low" — how many of the sun's cascade tiles
     *  re-render per frame. The NAME goes through: the engine's decoder is the one spelling of the values. Live. */
    setShadowUpdateRate(name) {
        this.api.engine_set_shadow_update_rate(name);
    }
    /** Project rendering.lightingMode (G0): forward (false) / clustered (true — the default since 2026-10-17). Live: a per-frame value in the lights block. */
    setLightingMode(clustered) {
        this.api.engine_set_lighting_mode(clustered ? 1 : 0);
    }
    /** Project rendering.cull: GPU (true) vs CPU (false) frustum culling. GPU is the default; see fe_frame. */
    setGpuCull(on) {
        this.api.engine_set_gpu_cull(on ? 1 : 0);
    }
    /** Project rendering.renderQuality — the "Render quality" tier: "high" (RGBA16F HDR, default), "balanced"
     *  (RG11B10F HDR, half the memory) or "performance" (LDR — no HDR buffer, fastest). The tier bakes into the
     *  pipelines, so set this ONCE at boot before the first frame; a later change fully applies on the next
     *  editor reload. See docs/hdr-tonemap-plan.md T4. */
    setHdrFormat(tier) {
        this.api.engine_set_hdr_format(tier);
    }
    /** Post P4 (docs/post-plan.md): push ONE post profile's document to the engine, LIVE — no scene reload (in Play a reload restarts
     *  the game). The editor's copy wins over the pack's until the next save rebuilds it. */
    /** The editor's scene VIEW → the engine: its whole post-profile set FIRST (the editor's live copies replace the engine's —
     *  engine_post_profiles_set; runtime/post_profiles.h), then the scene without it. The set is the editor's, never the scene
     *  format's: the shared scene parser ignores it, a saved scene never carries it, and the player loads with loadScene. */
    loadSceneView(scene) {
        const { postProfiles, ...rest } = scene;
        this.api.engine_post_profiles_set(JSON.stringify(postProfiles ?? {}));
        return this.loadScene(JSON.stringify(rest));
    }
    postProfileUpdate(id, doc) {
        this.api.engine_post_profile_update(id, JSON.stringify(doc));
    }
    /** Post P4: the project's DEFAULT profile ("" = none) — the PROJECT layer, live. */
    postSetProjectProfile(id) {
        this.api.engine_post_set_project_profile(id);
    }
    /** Post P4: the SCENE's profile ("" = the project's look) — the SCENE layer, live (the scene file's "post" says it on reload). */
    postSetSceneProfile(id) {
        this.api.engine_post_set_scene_profile(id);
    }
    /** Post P4: what the frame draws with — `param` "enabled" = on/off (1/0); a texture parameter = 1 when set; NaN = no such name. */
    async postValue(effect, param) {
        return await this.api.engine_post_value(effect, param);
    }
    /** Post P4: the layer a value comes from — 0 project, 1 scene, 2 script, 3 debug; -1 = the declaration's default; 4 = the
     *  EFFECTS QUALITY limited it (post P5: the layers asked for more than the level allows). */
    async postFrom(effect, param) {
        return await this.api.engine_post_from(effect, param);
    }
    /** Post P5: the project's EFFECTS QUALITY, live — "low" / "medium" / "high" (the engine's one name decoder; anything else =
     *  Medium). Project Settings saves it to project.json rendering.effectsQuality. */
    postSetQuality(level) {
        this.api.engine_post_set_quality(level);
    }
    /** Post P5: the level the engine draws at — 0 Low, 1 Medium, 2 High. */
    async postQuality() {
        return await this.api.engine_post_quality();
    }
    /** Project rendering.lodQuality — the cluster LOD cut's pixel threshold by name: "quality" (1 px), "balanced"
     *  (2 px, default) or "performance" (4 px). Read by the GPU cull every frame, so it applies live. T5.3. */
    setLodQuality(q) {
        this.api.engine_set_lod_quality(q);
    }
    /** Project rendering.renderScale (docs/foveation-plan.md R1): the frame drawn at this share of the viewport's width and height and
     *  stretched — 1 = the viewport's own size. Applies at the next frame; returns the scale in force (clamped to 0.25 … 1). */
    async setRenderScale(scale) {
        return await this.api.engine_set_render_scale(scale);
    }
    /** Project rendering.foveation (docs/foveation-plan.md R4): "off" | "quality" | "balanced" | "performance" — the owner's two pictures (a
     *  sharp middle, softer edges); a preset overrides the render scale while on. Applies at the next frame; false = no such preset. */
    async setFoveation(preset) {
        return (await this.api.engine_set_foveation(preset)) === 1;
    }
    /** A quality GROUP's level ("splats" | "effects" | "lod" | "render") by the shared words — engine/render/quality.h, the same table
     *  game scripts reach with quality.set (docs/quality-plan.md Q0). true = applied. */
    async setQuality(group, level) {
        return (await this.api.engine_quality_set(group, level)) === 1;
    }
    /** T0.4: the viewport's Debug view — "off" (the real picture) or "clusters" (every cluster the GPU cluster path
     *  draws in its own colour; batches it refused keep their real shader). An editor-session toggle, not a project
     *  setting; applies on the next frame and leaves no trace when switched off (gate-held pixel identity). */
    setDebugView(mode) {
        this.api.engine_set_debug_view(mode);
    }
    /** 2026-09-14 the frame pacer: true when a frame is due at `nowMs` under `targetFps` (0 = every call runs) — the loop
     *  skips the animation frame otherwise. ONE pacer for every loop (engine/core/stats.h app_frame_due): the editor
     *  viewport, the web player, desktop and the phone pace to the same arithmetic. */
    async frameDue(nowMs, targetFps) {
        return (await this.api.engine_frame_due(nowMs, targetFps)) !== 0;
    }
    /** The GAME's frame-rate cap — what a script's app.setTargetFps set (0 = uncapped). The viewport takes the slower of
     *  this and its own FPS dropdown while playing; the web player honours it alone. */
    setTargetFps(fps) { this.api.engine_set_target_fps(fps); }
    async targetFps() { return await this.api.engine_target_fps(); }
    /** 2026-10-23: Project Settings ▸ Frame rate, live — "auto" / "max" / "120" / "90" / "72" / "60" / "30", decoded by the engine's
     *  one reader of project.json's rendering.frameRate (core/stats.h app_frame_rate_from_setting). */
    setFrameRate(setting) { this.api.engine_set_frame_rate(setting); }
    /** T0.4: Freeze culling — every camera-driven cull (frustum, cluster cones + LOD, occlusion) keeps the camera of
     *  the frame the freeze was engaged on while the view keeps following the orbit camera, so you can fly to the
     *  side and see what was culled. Session toggle, applies on the next frame. */
    setCullFreeze(on) {
        this.api.engine_set_cull_freeze(on ? 1 : 0);
    }
    // ---- plugins P1 (docs/plugins-plan.md): JavaScript providers behind the engine's ads / iap / publisher services ----
    /** Register a JavaScript provider for one service under a plugin's name — the host's (browserhost.ts: Module.oceanPlugins + the C
     *  registry's bridge entry, which the project file's "plugins" block selects; the desktop app's native path is P2 step 5). */
    registerProvider(service, name, provider) { this.host.registerProvider(service, name, provider); }
    /** Select an already-registered provider by name ("test" / "null" / a plugin's). False = no such provider. */
    async selectProvider(service, name) {
        return !!await this.api.engine_plugins_select(service, name);
    }
    /** Does THIS build carry a provider under that name? The builtins ("test", "null") always; a JavaScript plugin only
     *  once registerProvider ran. The editor's boot step asks before selecting (src/hostplugins.ts), since it cannot host
     *  a portal's SDK — that lives in the export. */
    async pluginsRegistered(service, name) {
        return !!await this.api.engine_plugins_registered(service, name);
    }
    /** The project-file key this build reads from the "plugins" block ("web" for every browser build). */
    async pluginsPlatform() {
        return await this.api.engine_plugins_platform();
    }
    /** registerProvider + selectProvider — a page or a test installing a provider outside the project file. */
    setProvider(service, name, provider) {
        this.registerProvider(service, name, provider);
        return this.selectProvider(service, name);
    }
    /** A JavaScript ads provider reports the outcome of the ad it started: rewarded | finished | dismissed | failed. */
    adResult(outcome, reason = "") {
        this.api.engine_plugins_ad_result(outcome, reason);
    }
    /** A JavaScript iap provider reports the outcome of a purchase/restore: purchased | cancelled | failed | restored. */
    iapResult(outcome, product, reason = "") {
        this.api.engine_plugins_iap_result(outcome, product, reason);
    }
    publisherLoading(start) { this.api.engine_publisher_loading(start ? 1 : 0); }
    publisherGameplay(start) { this.api.engine_publisher_gameplay(start ? 1 : 0); }
    /** The HOST's mute switch (a portal's own audio toggle, e.g. CrazyGames game.settings.muteAudio): a mute reason UNDER the
     *  game's volume — the game's own setting survives, and an ad ending never unmutes a host-muted game. */
    hostMute(muted) { this.api.engine_host_mute(muted ? 1 : 0); }
    /** The host paused the game (Playgama's PAUSE_STATE_CHANGED, a hidden tab): the simulation waits and the audio is muted
     *  under its own reason until the host resumes — composing with an ad in flight (plugins_host_pause). */
    hostPause(paused) { this.api.engine_host_pause(paused ? 1 : 0); }
    async adsAvailable(kind = "rewarded") {
        return !!await this.api.engine_ads_available(kind);
    }
    /** Ask for an ad through the engine's ads service — the game's ads.showRewarded, from the page. */
    async adsShow(kind, tag = "") {
        return !!await this.api.engine_ads_show(kind, tag);
    }
    async pluginsBlocking() { return !!await this.api.engine_plugins_blocking(); }
    async pluginsSelected(service) {
        return await this.api.engine_plugins_selected(service);
    }
    /** Hi-Z two-phase occlusion culling (rides the GPU cull path; byte-identical output). H4 profile default. */
    setOcclusion(on) {
        this.api.engine_set_occlusion(on ? 1 : 0);
    }
    /** Project rendering.anisotropy — the "Anisotropic filtering" max (0/1 off, 2/4/8/16; default 8). Set at
     *  boot before the first texture upload (the material sampler is created lazily with it); a later change
     *  takes full effect on the next reload. T0, docs/resource-architecture-plan.md. */
    setAnisotropy(n) {
        this.api.engine_set_anisotropy(n | 0);
    }
    /** The engine's own built-in meshes and textures (E4, 2026-11-10): asked once, at the editor's first step (main.ts), so the editor
     *  keeps no list of them — its hand copies held the sample's assets as built-ins (store.ts says which). */
    async builtinAssets() {
        return JSON.parse(await this.api.engine_builtin_assets());
    }
    async refreshModelMaterials() {
        this.modelTable = JSON.parse(await this.api.engine_mesh_material_table());
    }
    /** The model material `mesh`'s slot follows ("" = none: a plain mesh, or a model imported before model materials) — the engine's
     *  lookup rule, on the copy: the ref's id (refs.ts), then the whole ref. */
    modelMaterial(mesh, slot) {
        const row = this.modelTable.follows[refId(mesh)] ?? this.modelTable.follows[mesh];
        return row?.[slot | 0] || "";
    }
    /** How many material slots `mesh` has (a skinned character's submeshes); 1 for a single-slot or unknown mesh — the engine's mesh
     *  lookup rule, on the copy: the ref's id, then its name hint. */
    meshSlotCount(mesh) {
        return this.modelTable.slots[refId(mesh)] ?? this.modelTable.slots[refName(mesh)] ?? 1;
    }
    /** The LIVE import's half of the table: `mesh` follows these model materials (slot order) — a model imported mid-session is
     *  registered without a pack reload, so its meshes learn their materials here (the next pack brings the whole table). The copy
     *  learns it at the importer's refreshModelMaterials. */
    setMeshMaterials(mesh, ids) {
        this.api.engine_set_mesh_materials(mesh, JSON.stringify(ids));
    }
    /** Memory plan M3d: simulate a device with `mb` of memory — the editor runs at that number, every bucket following it live (the
     *  Memory window's "Simulate a device"; not saved). 0 = stop: the editor's own number again. */
    simulateMemoryMB(mb) {
        this.api.engine_simulate_memory_mb(Math.max(0, mb | 0));
    }
    /** The simulated device's memory in MB, 0 = none. */
    async simulatedMemoryMB() {
        return await this.api.engine_simulated_memory_mb();
    }
    /** Memory plan M2: the project's textures share of the streamed memory (Project Settings ▸ Memory; 0 = the engine's default).
     *  Live — the next plan splits by it. */
    setTextureShare(pct) {
        this.api.engine_set_texture_share(pct | 0);
    }
    /** Ragdoll R1b: skeleton-agnostic rig auto-fit on a registered mesh + skeleton — returns the
     *  record-props JSON ({"bones":[...]}) or "" when nothing fits (no skin / unknown ids). */
    async rigAutofit(meshId, skelId) {
        return await this.api.engine_rig_autofit(meshId, skelId);
    }
    /** A mesh's local-space AABB { min, max }. Used to auto-fit a new Collider to its mesh (full size). */
    async meshBounds(name) {
        const f = await this.api.engine_mesh_bounds(name);
        return { min: [f[0], f[1], f[2]], max: [f[3], f[4], f[5]] };
    }
    /** Editor free camera override (0 = use the scene's own camera). near/far 0 = engine defaults;
     *  the orbit camera passes distance-scaled planes so huge imports render without clipping. */
    setView(enabled, pos, rot, fov, near = 0, far = 0) {
        this.api.engine_set_view(enabled ? 1 : 0, pos[0], pos[1], pos[2], rot[0], rot[1], rot[2], fov, near, far);
    }
    /** The entity under framebuffer pixel (x, y); -1 = empty space. E6 step 3 (2026-11-10): ASKED, then answered by a frame — the
     *  GPU pick draws the objects the ray may meet into one pixel after the next frame, and the number comes back a frame or two later
     *  (WebGPU reads the GPU back only asynchronously, so one call cannot return it in the browser; both editors share the shape). Each
     *  animation frame asks whether it has arrived; past 120 frames (two seconds at 60) it answers -1 and says so. */
    async pick(x, y) {
        const seq = await this.api.engine_pick_request(x, y);
        for (let k = 0; k < 120; k++) {
            await new Promise((r) => requestAnimationFrame(() => r()));
            const e = await this.api.engine_pick_result(seq);
            if (e !== -2)
                return e;
        }
        console.warn(`[pick] the pick at (${x}, ${y}) had no answer after 120 frames — nothing selected`);
        return -1;
    }
    /** Project a world point to a framebuffer pixel (same camera as the render). */
    async project(x, y, z) {
        const [vis, s] = await this.api.engine_project(x, y, z);
        return { sx: s[0], sy: s[1], visible: !!vis };
    }
    /** Frame timings for the perf HUD (engine_api.cpp ENGINE_PERF_*): [cpuExtractMs, cpuRecordMs, then THE GPU PROFILE's
     *  last closed ~1 s window (docs/gpu-profiler-plan.md): gpuFrameMs, sceneMs, shadowsMs, cullMs, postMs (tonemap + HUD),
     *  otherMs, gapsMs, stampStepUs]. The GPU groups + other + gaps cover the whole GPU frame. GPU entries are 0 until the
     *  device supports timestamp-query and a window lands; stampStepUs 100 = Chrome's quantized timer (averages stay
     *  unbiased). The block is sized by the ENGINE (engine_perf_count) — a literal here once overflowed. */
    /** F3: which path drew the last frame, in the engine's words (engine_path_text) — the FPS card's path line. */
    async pathText() {
        try {
            return await this.api.engine_path_text();
        }
        catch {
            return "–";
        }
    }
    async perf() {
        const [n, out] = await this.api.engine_perf(); // the block is sized by the engine's own engine_perf_count (the table says so)
        return out.slice(0, n);
    }
    /** THE GPU PROFILE's last closed window as text: a header line (the GPU frame = busy + gaps), then every group and pass,
     *  indented, with its average ms per frame (docs/gpu-profiler-plan.md). "" before the first window. */
    async gpuProfile() {
        return await this.api.engine_gpu_profile();
    }
    /** A registered mesh's [vertices, triangles], or null if unknown (asset inspector). */
    async meshInfo(name) {
        const [ok, v] = await this.api.engine_mesh_info(name);
        return ok ? [v[0], v[1]] : null;
    }
    /** Drop all cached GPU textures — re-uploaded from the current registry next frame (quality rebake). */
    flushTextures() { try {
        this.api.engine_flush_textures();
    }
    catch { /* older wasm */ } }
    /** Drop all cached GPU meshes — re-uploaded from the current registry next frame (rescale rebake). */
    flushMeshes() { try {
        this.api.engine_flush_meshes();
    }
    catch { /* older wasm */ } }
    /** A registered mesh's local bounding-sphere radius (0 = unknown) — frames real-scale placements. */
    async meshRadius(name) {
        try {
            return await this.api.engine_mesh_radius(name);
        }
        catch {
            return 0;
        }
    }
    /** TAGS (docs/tags-plan.md): entity `idx`'s tags as the RUNNING engine holds them (the live door's result; a script's addTag in Play). */
    async entityTags(idx) {
        try {
            return JSON.parse(await this.api.engine_entity_tags(idx));
        }
        catch {
            return [];
        }
    }
    // THE RUNNING GAME, for the AI's rows (P5 step 5; runtime/engine_api.cpp has why store.scene will not do during Play).
    async liveObjects(offset, limit, nameContains) {
        return JSON.parse(await this.api.engine_live_objects(offset, limit, nameContains));
    }
    async liveObject(who) { return JSON.parse(await this.api.engine_live_object(who)); }
    /** P5 step 9: read one frame's real numbers: one drawn after this, so it holds what was just changed (frontend_census.inc); false if none landed in `timeoutMs`. */
    async census(timeoutMs) {
        await this.api.engine_census_ask();
        const end = performance.now() + timeoutMs;
        while (performance.now() < end) {
            if (await this.api.engine_census_ready())
                return true;
            await new Promise((r) => setTimeout(r, 16));
        }
        return false;
    }
    async memAssets(top) { return JSON.parse(await this.api.engine_mem_assets(top)); }
    /** Why one object is or is not on the screen (engine_explain_object). When the answer needs its lines of sight, E6 step 5
     *  (2026-11-10): the engine ASKS the pick for them and answers `pending` — the lines are drawn by the next frame, like a click
     *  (this.pick) — and the finished answer is collected here, an animation frame at a time; past 120 frames it is an error, said. */
    async explainObject(who) {
        const r = JSON.parse(await this.api.engine_explain_object(who));
        if (typeof r.pending !== "number")
            return r;
        for (let k = 0; k < 120; k++) {
            await new Promise((res) => requestAnimationFrame(() => res()));
            const s = await this.api.engine_explain_result(r.pending);
            if (s)
                return JSON.parse(s);
        }
        console.warn(`[pick] the lines of sight through ${who} had no answer after 120 frames`);
        return { error: "its lines of sight had no answer after 120 frames" };
    }
    async sceneCost(top) { return JSON.parse(await this.api.engine_scene_cost(top)); }
    /** What is at a spot (0–1 across the scene view): E6 step 3 — the GPU pick finds it (this.pick, a frame or two), then the engine
     *  describes it and the ray (engine_object_at). */
    async objectAt(fx, fy) {
        const e = await this.pick(fx * this.width, fy * this.height);
        return JSON.parse(await this.api.engine_object_at(fx, fy, e));
    }
    async physicsRay(from, dir, max, ignore) {
        return JSON.parse(await this.api.engine_physics_ray(from[0], from[1], from[2], dir[0], dir[1], dir[2], max, ignore));
    }
    async physicsOverlap(at, radius, ignore) {
        return JSON.parse(await this.api.engine_physics_overlap(at[0], at[1], at[2], radius, ignore));
    }
    /** Fixed steps the game has run, ever (a clock for deltas: a new Play goes on counting), and how many a second. */
    async playSteps() { return await this.api.engine_play_steps(); }
    async playHz() { return await this.api.engine_play_hz(); }
    /** Hold an action by its name for `steps` fixed steps (engine/scene/input.h): 1 held, 0 nothing can press it, -1 too many held, -2 no such action. */
    async inputHold(action, x, y, steps) { return await this.api.engine_input_hold(action, x, y, steps); }
    async inputHoldsClear() { await this.api.engine_input_holds_clear(); }
    async inputHoldsCount() { return await this.api.engine_input_holds_count(); }
    /** World-space position of entity `idx` (composes its parent chain). */
    async entityWorldPos(idx) {
        const v = await this.api.engine_entity_world_pos(idx);
        return [v[0], v[1], v[2]];
    }
    /** What F frames for entity `idx`: the world point (its mesh's middle — parents and scale included) and the world radius
     *  to fit (0 = no mesh: its world position, keep the distance). The engine's sv_entity_focus_sphere. */
    async entityFocus(idx) {
        const f = await this.api.engine_entity_focus(idx);
        return { center: [f[0], f[1], f[2]], radius: f[3] };
    }
    /** Keep-world reparent (hierarchy drag-drop): re-parent `child` under `parent` (parent < 0 = detach to
     *  root) preserving its WORLD transform, and return the resulting LOCAL transform for the caller to write
     *  into the scene JSON. Runs the engine's gated keep-world math on the live preview scene (indices match
     *  the editor's, as with entityWorldPos), so the child doesn't visually jump. */
    async reparentKeepWorld(child, parent) {
        const f = await this.api.engine_reparent_keep_world(child, parent); // pos, rot, scale
        return { position: [f[0], f[1], f[2]], quaternion: [f[3], f[4], f[5], f[6]], scale: [f[7], f[8], f[9]] }; // pos, quaternion (E5), scale
    }
    async tris() {
        return await this.api.engine_tris();
    }
    /** Drawn object count last frame (perf meter). */
    /** S5b-2: the shadow passes' WORK last frame — [sun paced tiles, sun dynamic tiles, lamp static tiles re-rendered,
     *  lamp dynamic tiles, lamp caster instances unsplit / static / dynamic]. The honest companion of perf(): a cached
     *  tile is 0 work whatever the GPU clock makes its timestamp read. */
    async shadowTiles() {
        const [n, out] = await this.api.engine_shadow_tiles();
        return out.slice(0, n);
    }
    async draws() {
        return await this.api.engine_draws();
    }
    /** THE EDITOR'S TICK (P2 step 3, runtime/engine_api.cpp engine_core_editor_frame): the viewport's whole frame as ONE packet — the
     *  pacer decides whether it draws — answered with the newest facts the host has (enginehost.ts: never waited for). */
    frame(packet) { return this.host.frame(JSON.stringify(packet)); }
    /** Frames drawn since the start (the browser's due ticks; the desktop app's frames into #view). */
    get framesDrawn() { return this.host.framesDrawn; }
    /** The software build's last framebuffer, to blit (EMPTY in the GPU build and in the desktop app, which show the picture themselves). */
    framebuffer() { return (this.host instanceof BrowserHost ? this.host.framebuffer : null) ?? Engine.EMPTY_FB; }
    /** Render a frame. SW build: a view of the RGB565 framebuffer to blit. Every other host shows the picture itself and this returns
     *  an EMPTY view — in the desktop app it ASKS for the frame (drawn after every command sent before). */
    render() {
        return this.host.render() ?? Engine.EMPTY_FB;
    }
}
/** Pointer → GAMEPLAY: what scripts read as input.pointer* / camera.pointerRay(). Separate from the HUD
 *  forwarding above because click-to-place must work with no UI build. Coords are #view backing-store px.
 *  A failing gameplay-pointer ccall is a DEAD FEATURE (arena clicks vanish) — say so ONCE, never silence. */
Engine.ptrMissing = new Set();
Engine.EMPTY_FB = new Uint16Array(0);
// The editor constructs exactly ONE Engine (Engine.create in main.ts). Asset flows that are not
// threaded an instance (the browser grid's create tiles) reach it here; null before boot completes.
let LIVE = null;
export function liveEngine() { return LIVE; }
/** M2b-2/UX: (re)take user shader-asset variants into the engine from the dev server's
 *  /shaders channel — at viewport boot AND right after a shader import, so a freshly dropped or
 *  created .slang is assignable immediately (no page reload; registration replaces in place).
 *  `only` limits it to the named shaders (an import's receipt); omitted = all listed.
 *  A refused variant is LOUD and stops that model — never half-registered (the engine registers a
 *  model only when all 14 have arrived). */
// ONE AT A TIME (found 2026-11-07, compile on save): the engine gathers a shader's variants one take at a time into ONE buffer per name
// (runtime/engine_api.cpp), and registers when the set is whole. Two refreshes of one shader at once fed it alternately: the first whole
// set registered, the other was left half-gathered, and the next refresh of that name would have finished it with variants of ANOTHER
// compile — a model mixed from two texts. The AI's write and a person's save can end together, so every refresh waits its turn.
let shaderRefreshTurn = Promise.resolve();
export function refreshUserShaders(engine, only) {
    const turn = shaderRefreshTurn.then(() => refreshUserShadersNow(engine, only));
    shaderRefreshTurn = turn.catch(() => undefined);
    return turn;
}
async function refreshUserShadersNow(engine, only) {
    try {
        const shl = (await (await fetch("shaders/list")).json());
        for (const [sname, man] of Object.entries(shl.shaders || {})) {
            if (only && !only.includes(sname))
                continue;
            for (const t of shaderTakes(sname, man.variants ?? [])) {
                const [a] = await engine.takeFiles([t]);
                if (!a.ok) {
                    console.error(`[shaders] variant ${t.file} refused (${a.why}) — '${sname}' not registered`);
                    break;
                }
            }
        }
    }
    catch { /* no user shaders / no backend */ }
}
