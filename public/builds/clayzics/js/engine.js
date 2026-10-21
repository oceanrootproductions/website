// Typed wrapper around the C++ engine compiled to WASM (web/engine.js). It drives the
// SAME engine_api the device runs, so the browser viewport can never drift from the game.
import { f32Index, u16Index } from "./heap.js"; // pointers past 2 GB: >>> not >> (see heap.ts)
import { KEY_CODE_BITS } from "./inputkeys.gen.js";
import { rawSticks } from "./inputsticks.js"; // the raw snapshot (keys + the captured mouse) — one formula, tested
import { guardExports } from "./engineexports.js"; // a stale engine.wasm fails by NAME, not "func is not a function"
import { DecodeClient, LANE_BASE_MB, LANE_TICKET_GROWTH_PCT } from "./decodeclient.js"; // 2026-09-26: streaming decodes on a Web Worker, off the frame
export class Engine {
    constructor() {
        // The engine reads imported mesh/texture pixels straight from these WASM heap blobs, so
        // each must stay alloc'd while its asset is registered. Re-importing the same name would
        // otherwise leak the old blob — track the live ptr per name and free the one we supersede.
        this.meshBlobs = new Map();
        this.texBlobs = new Map();
        this.liveReload = null; // liveReloadComponents' answer (the engine's table is fixed at build)
        this.hdrBlobs = new Map(); // SK5: RGBA16F equirect pixels kept alive for the skybox
        this.hdrShBlobs = new Map(); // I4: baked SH-L2 coeffs kept alive (ga_register_hdr stores the ptr)
        this.perfCount = 0; // engine_perf_count(): the floats engine_perf writes — the engine's number, read once (perf())
        this.hdrEnvBlobs = new Map(); // I2d: prefiltered specular cube kept alive (ga_register_hdr stores the ptr)
        this.width = 240;
        this.height = 240;
        // GPU build (engine_gpu.wasm): engine_render presents to #view via WebGPU — the viewport must NOT blit a
        // framebuffer, and the boot path awaits the async device init. false = the software build (returns an fb to blit).
        this.gpu = false;
        /** 2026-09-26: the streaming decode worker (decodeclient.ts). The engine hands every streaming decode (a mesh level
         *  range, a texture's mips) to it as a ticket once it answers; the island in the web editor ran at 24 fps while the
         *  camera moved when those decodes ran inside the frame. The client is registered at boot but the worker starts only at
         *  the engine's first streaming decode (wake). Its files sit beside the engine: js/decodeworker.js and decode.js /
         *  decode.wasm (scripts/build_wasm.sh builds the decoder from the engine's own decode sources). */
        this.decode = null;
    }
    // Editor keyboard→gamepad synthesis constants (see input()).
    static async create() {
        const e = new Engine();
        LIVE = e; // the editor's one engine — flows without a threaded ref reach it via liveEngine()
        // Guard BEFORE the first ccall: a wasm built before a new export lands (2026-09-23: engine_set_volume_gizmos)
        // must fail the fatal boot step with the export's name and the fix — the splash shows this message verbatim.
        e.m = guardExports(await createEngine());
        e.m.ccall("engine_init", null, [], []);
        // Memory plan M2 (docs/memory-budget-plan.md): what only the page knows. The browser's memory report picks the web game's row
        // of the engine's table (rounded down and capped at 8 GB by the browser; absent in Safari/Firefox = "not reported"); the
        // page's own share — the asset pack it holds outside the engine's heap + the decode helpers' heaps — counts against the
        // number, reported about once a second (the editor has its own number; the page still counts toward it).
        e.m.ccall("engine_set_browser_memory", null, ["number"], [navigator.deviceMemory ?? 0]);
        setInterval(() => e.reportPageMemory(), 1000);
        e.registerDecodeWorker(); // the worker itself starts at the engine's first streaming decode; until it answers, decodes run inline
        // M3e e3b: the helpers as the page plans them (decodeclient.ts) — told before any scene's door plans the shares
        if (e.decode)
            e.m.ccall("engine_set_decode_lanes", null, ["number", "number", "number"], [e.decode.laneCount, LANE_BASE_MB, LANE_TICKET_GROWTH_PCT]);
        // Tolerate an OLDER software engine.wasm that predates this export (ccall throws on a missing function) — that
        // build is the SW renderer, so default to false. The GPU build returns 1 and drives the device init.
        try {
            e.gpu = !!e.m.ccall("engine_is_gpu", "number", [], []);
        }
        catch {
            e.gpu = false;
        }
        // The GPU build creates its WebGPU device + swapchain on the #view canvas — async (ASYNCIFY suspends on the
        // device request), so await it once here. AAA-style: render at the canvas's REAL pixel size (CSS × DPR,
        // Retina-sharp), not a fixed 240×240 — size the backing store, then init the device + swapchain at that size.
        if (e.gpu) {
            const cv = document.getElementById("view");
            const [w, h] = Engine.backingSize(cv);
            cv.width = w;
            cv.height = h;
            const webgpu = navigator.gpu;
            if (!webgpu)
                throw new Error("WebGPU is not available in this browser");
            const adapter = await webgpu.requestAdapter();
            if (!adapter)
                throw new Error("no WebGPU adapter available");
            // Ask for the optional features we can exploit when the adapter has them: timestamp-query (the perf
            // HUD's GPU timings), whichever texture-compression family this GPU speaks (KTX2/Basis textures), and
            // rg11b10ufloat-renderable (the HDR "Performance" render target — else it degrades to Quality/RGBA16F).
            // + indirect-first-instance (T7 on WebGPU): the cluster compaction's draws carry their bucket in firstInstance;
            // without the feature the browser draws alpha-tested foliage through the object path, uncut.
            const optional = ["timestamp-query", "texture-compression-bc", "texture-compression-astc", "texture-compression-etc2", "rg11b10ufloat-renderable", "indirect-first-instance"];
            const wanted = optional.filter((f) => adapter.features?.has(f) ?? false);
            // Texture-size ceiling: a WebGPU device gets the SPEC DEFAULT 8192 unless a higher limit is
            // requested, even on GPUs that do 16384 — and a 13k sprite sheet then fails CreateTexture and
            // takes the whole UI pass down. Ask for the adapter's real maximum, capped at 16384 (the
            // basisu/bake-side sheet cap). Requesting ≤ the adapter's own maximum is always granted.
            const maxDim = Math.min(adapter.limits?.maxTextureDimension2D ?? 8192, 16384);
            // Buffer ceilings: the same trap one level down (2026-09-04). A device also gets the SPEC DEFAULTS — 128 MB
            // per storage-buffer binding, 256 MB per buffer — unless asked, while this Mac's browser offers 4 GB of each
            // (measured: maxStorageBufferBindingSize = maxBufferSize = 4,294,967,292). Under the defaults the cluster
            // path's header arena stopped at 1.4 M clusters and a 512 MB cluster budget could not even create its
            // 268 MB index arena — so the island's biggest meshes silently took the object path in the editor and
            // nowhere else. Ask for the adapter's own maximum (always granted); the engine sizes its arenas by what was
            // GRANTED (rhi_caps.limit_storage_buffer_range), so an adapter that offers only the defaults still boots —
            // it clusters less and says so. The C++ device path (rhi_webgpu.cpp) asks the same way: the playtest
            // runner's boot tooth holds this path to the adapter's numbers, the rhi_wgpu_limits gate holds that one.
            const requiredLimits = { maxTextureDimension2D: maxDim };
            if (adapter.limits?.maxStorageBufferBindingSize)
                requiredLimits.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize;
            if (adapter.limits?.maxBufferSize)
                requiredLimits.maxBufferSize = adapter.limits.maxBufferSize;
            // C1 (2026-09-24): SAMPLED TEXTURES per stage — the spec default is 16, and the shadowed masked-material layout's
            // fragment stage was already 17 before the lights set grew its two scene inputs (bindings 10/11 → 19). Ask for
            // min(adapter, 32), exactly as the C++ device path (rhi_webgpu.cpp) does; an adapter offering only 16 keeps 16.
            if (adapter.limits?.maxSampledTexturesPerShaderStage)
                requiredLimits.maxSampledTexturesPerShaderStage = Math.min(adapter.limits.maxSampledTexturesPerShaderStage, 32);
            const device = await adapter.requestDevice({
                ...(wanted.length ? { requiredFeatures: wanted } : {}),
                requiredLimits,
            });
            device.addEventListener?.("uncapturederror", (ev) => console.error("[webgpu] uncaptured error:", ev.error?.message ?? ev));
            void device.lost?.then((info) => console.error("[webgpu] device lost:", info?.message));
            e.m.preinitializedWebGPUDevice = device;
            e.m.ccall("engine_gpu_init", "number", ["string", "number", "number"], ["#view", w, h]); // synchronous now
        }
        e.width = e.m.ccall("engine_width", "number", [], []);
        e.height = e.m.ccall("engine_height", "number", [], []);
        return e;
    }
    /** The #view canvas's backing-store pixel size = CSS size × devicePixelRatio (Retina-sharp). */
    static backingSize(cv) {
        const dpr = window.devicePixelRatio || 1;
        return [Math.max(1, Math.round(cv.clientWidth * dpr)), Math.max(1, Math.round(cv.clientHeight * dpr))];
    }
    /** Keep the GPU render (depth + viewport) matched to #view's ACTUAL backing-store size — cv.width/height, which the VIEWPORT
     *  sets (viewport.ts: in Auto it follows the canvas's box through a ResizeObserver; a fixed resolution forces it). Nothing
     *  else sizes it: this comment used to say WebGPU/Dawn resizes the drawing buffer to the CSS box × DPR — it does not, and that
     *  belief hid the flat view of a page booted hidden (2026-10-20). Cheap (no layout query), safe to call every frame: a no-op
     *  unless the backing store actually changed. */
    resize() {
        if (!this.gpu)
            return;
        const cv = document.getElementById("view");
        if (cv.width === this.width && cv.height === this.height)
            return;
        this.m.ccall("engine_gpu_resize", null, ["number", "number"], [cv.width, cv.height]);
        this.width = cv.width;
        this.height = cv.height;
    }
    /** Save service: arm it AFTER setting Module.oceanSaveKey/Sink/Load (the editor points these at
     *  the dev server; the shipped player keys localStorage per game). Then load/flush as needed. */
    saveInit() { this.m.ccall("engine_save_init", null, [], []); }
    saveLoad(json) { this.m.ccall("engine_save_load", "number", ["string"], [json]); }
    saveFlush() { this.m.ccall("engine_save_flush", null, [], []); }
    registerDecodeWorker() {
        const buildId = this.m.ccall("engine_decode_build_id", "number", [], []);
        const client = new DecodeClient(this.m, new URL("./decodeworker.js", import.meta.url), new URL("../decode.js", import.meta.url).href, buildId);
        this.m.oceanDecode = client;
        this.decode = client;
    }
    /** M1: the memory ledger's classes, in the engine's order (the RHI's one name table) — the stats are fe.gpu.<name>.mb. */
    memClasses() {
        const out = [];
        for (let i = 0; i < 64; i++) {
            const n = this.m.ccall("engine_mem_class_name", "string", ["number"], [i]);
            if (!n)
                break;
            out.push(n);
        }
        return out;
    }
    /** Memory plan M2: the rule's constants (the engine's one spelling — the editor describes each platform's automatic number from them). */
    memRules() {
        try {
            return JSON.parse(this.m.ccall("engine_mem_rules", "string", [], []));
        }
        catch {
            return null;
        }
    }
    /** Memory plan M2 + M3e: this tab's number, where it came from, and every part's [used, share] in MB under the held plan. */
    memPlan() {
        try {
            return JSON.parse(this.m.ccall("engine_mem_plan", "string", [], []));
        }
        catch {
            return null;
        }
    }
    /** M1: what fills memory class `index` (memClasses order): its largest live resources by name, largest first. */
    memClassTop(index, n = 6) {
        try {
            return JSON.parse(this.m.ccall("engine_mem_class_top", "string", ["number", "number"], [index, n]));
        }
        catch {
            return [];
        }
    }
    /** The raw Module — main.ts points Module.oceanSaveSink at the dev server (editor-only). */
    get module() { return this.m; }
    /** Load an assets.pack. Residency S1 (docs/asset-residency-plan.md): the bytes stay HERE, in
     *  JavaScript memory, outside the wasm heap — the engine reads entries out of them one at a time through
     *  an EM_JS read (engine_api.cpp) and frees each entry once it is uploaded. The heap
     *  never holds the whole pack: the wasm32 heap ceiling (4 GB editor / 2 GB game) is the constraint, a
     *  JavaScript buffer of the island's 1.9 GB is not. Before S1 this copied the pack INTO the heap (one
     *  copy the registry kept for the process's life); before 2026-09-02 it wrote it into MEMFS as well.
     *  Returns the asset count.
     *  2026-10-01: the bytes are a PackStore (packstore.ts — pieces, because a browser refuses one buffer of 2 GiB or more), and
     *  every pack handed over gets its OWN NUMBER, which the engine's source carries: it reads and closes by that number.
     *  THE BUG THIS REPLACED (measured on the sample, 2026-10-01): there was one slot, Module.oceanPack, and closing ANY source
     *  emptied it. The engine closes the OLD pack's source after it accepts the new one (game_assets.cpp ga_pack_forget_old) —
     *  by then the slot held the NEW bytes — so every reload in the editor (an import, a re-import, a quality or max-size change)
     *  left the engine with no bytes: the next re-upload logged "pack entry … could not be read back" by the hundred. And a
     *  REFUSED pack (closed at once) took the bytes the previous, still-live pack needed. Now a close drops only its own
     *  number, and a refusal puts the previous pack back as the one the page reads. */
    loadAssets(pack) {
        const m = this.m;
        const packs = (m.oceanPacks ?? (m.oceanPacks = new Map()));
        const prevGen = m.oceanPackGen ?? 0;
        const gen = m.oceanPackSeq = (m.oceanPackSeq ?? 0) + 1;
        packs.set(gen, pack);
        m.oceanPack = pack;
        m.oceanPackGen = gen; // current BEFORE the call: anything the load itself streams reads the new pack
        this.reportPageMemory(); // M3e: the pack counts from now — before its scene's door plans the shares (the 1 s report came after it)
        const n = m.ccall("engine_load_assets_js", "number", ["number", "number"], [pack.length, gen]);
        if (!packs.has(gen)) { // REFUSED (the engine closed it at once): the previous pack is still the engine's — and still readable
            const prev = packs.get(prevGen);
            m.oceanPack = prev ?? null;
            m.oceanPackGen = prev ? prevGen : 0;
            this.reportPageMemory();
        }
        return n;
    }
    /** Memory plan M2/M3e: the page's own memory outside the engine's heap — the pack it holds and the decode helpers' heaps. */
    reportPageMemory() {
        const packMB = (this.m.oceanPack?.length ?? 0) / 1048576;
        this.m.ccall("engine_set_page_memory", null, ["number", "number"], [packMB, this.decode ? this.decode.heapTotal / 1048576 : 0]);
    }
    /** Load a scene from JSON text (the device's loader, verbatim). Returns entity count.
     *  NOTE this REBUILDS EVERYTHING — in Play that restarts the running game (every script is a fresh
     *  object, so start() runs again). For a value edit use syncEntity below. */
    loadScene(json) {
        return this.m.ccall("engine_load_scene_json", "number", ["string"], [json]);
    }
    /** T2d: the load-time residency door (web parity with the native mains). Warms every scene mesh,
     *  material tuple, prefab and UI screen NOW — behind the boot moment — instead of paying lazy
     *  uploads mid-game (the measured 423 ms editor stalls). Call once after assets + scene + UI.
     *  try/catch: a pre-T2d engine.wasm has no such export — the editor then keeps today's lazy
     *  behavior until its next wasm rebuild (the T0 aniso precedent), instead of throwing at boot. */
    /** The UI's warm + its memory plan (engine_ui_warm) — the editor calls it once its UI channel has delivered everything, BEFORE
     *  the asset previews admit any geometry (main.ts has why); makeResident calls it again for the web player. */
    warmUi() {
        try {
            this.m.ccall("engine_ui_warm", null, [], []);
        }
        catch { /* pre-2026-10-03 wasm: makeResident still warms it */ }
    }
    makeResident() {
        try {
            this.m.ccall("engine_make_resident", null, [], []);
        }
        catch { /* pre-T2d wasm — lazy path */ }
    }
    // ---- asset-tile previews (docs/editor-preview-cache-plan.md phase 3) -----------------------------
    // An ISOLATED scene rendered onto its own off-screen canvas (#pview in index.html). Nothing here can
    // touch the live scene, the viewport or the live draw list — which is why, unlike the path it
    // replaces, there is no "restore the real scene afterwards" step and no rule about when it is safe.
    /** Create the preview renderer against the editor's own renderer + caches. Safe to call twice.
     *  false = no preview surface (the tiles keep their placeholder glyphs). */
    previewInit(canvasSel, w, h) {
        return !!this.m.ccall("engine_preview_init", "number", ["string", "number", "number"], [canvasSel, w, h]);
    }
    /** Load the tile's subject — the SAME loader the live scene uses, pointed at the preview's own scene,
     *  so a tile and a placed object can never disagree about what a model looks like. */
    previewLoadScene(json) {
        return this.m.ccall("engine_preview_load_scene", "number", ["string"], [json]);
    }
    /** Frame the subject. Callers size `pos` from the mesh's real bounding radius. */
    previewView(pos, rot, fov) {
        this.m.ccall("engine_preview_view", null, ["number", "number", "number", "number", "number", "number", "number"], [pos[0], pos[1], pos[2], rot[0], rot[1], rot[2], fov]);
    }
    /** Draw it onto the preview canvas. Returns the drawn count — 0 means the subject did not resolve,
     *  which the caller should treat as "keep the glyph", not as a blank tile. */
    previewRender() {
        return this.m.ccall("engine_preview_render", "number", [], []);
    }
    /** The engine's named counters (core/stats.h) as an object — fe.lazy.pipeline, fe.warm.texture and
     *  the rest. Poll about once a second; it walks the whole table and formats JSON.
     *  This exists because "the editor is slow and the engine's own timers say it is idle" could only be
     *  answered by guessing before: the CPU/GPU numbers in the perf HUD measure the frame, not the
     *  first-use work (pipeline compiles, uploads) that makes a frame long. */
    stats() {
        try {
            return JSON.parse(this.m.ccall("engine_stats_json", "string", [], []));
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
    texcacheProbe(name) {
        try {
            return JSON.parse(this.m.ccall("engine_texcache_probe", "string", ["string"], [name]));
        }
        catch {
            return { found: -1 };
        }
    }
    /** Apply one entity's value components to the LIVE scene — no rebuild, no script restart, no physics
     *  reset (contract + scope: runtime/scene_json.h). `json` is a single entity object. Returns false if
     *  the engine could not do it in place, and the caller falls back to a full loadScene. */
    syncEntity(idx, json) {
        return this.m.ccall("engine_sync_entity", "number", ["number", "string"], [idx, json]) === 1;
    }
    /** The components syncEntity does NOT apply in place — an edit of one needs the scene reloaded (its runtime state, e.g. a
     *  clip's time or a pooled row, would be reset). Read from the engine's one table (runtime/scene_json.cpp HAND_PARSED), never
     *  listed here: the door used to skip hand-parsed components with no word to the editor, so a Light edit vanished. */
    liveReloadComponents() {
        if (!this.liveReload)
            this.liveReload = this.m.ccall("engine_live_reload_components", "string", [], []).split(",").filter(Boolean);
        return this.liveReload;
    }
    /** Build one entity into the LIVE scene. `json` is scene-shaped ({entities:[…], materials:{…}}).
     *  Returns the new engine entity id, or -1 — the id is a SLOT and slots are reused after a destroy,
     *  so callers addressing entities by array index must keep a mapping (store.ts engineIdOf). */
    addEntity(json) {
        return this.m.ccall("engine_add_entity", "number", ["string"], [json]);
    }
    /** Destroy one entity in the LIVE scene, children included. False if it isn't a live entity. */
    destroyEntity(id) {
        return this.m.ccall("engine_destroy_entity", "number", ["number"], [id]) === 1;
    }
    /** Load the in-game HUD document (RmlUi) — the editor calls this on Play with data/ui/hud.rml; scripts then
     *  drive it via ui_set_text/show/hide. uiClear hides it on Stop. Tolerated as a no-op on an engine.wasm
     *  built WITHOUT the UI module (ccall throws on a missing export). */
    uiLoad(rml) { try {
        this.m.ccall("engine_ui_load", null, ["string"], [rml]);
    }
    catch { /* no UI build */ } }
    uiClear() { try {
        this.m.ccall("engine_ui_clear", null, [], []);
    }
    catch { /* no UI build */ } }
    /** Toggle the in-game debug console overlay (logging milestone): the log tail + a stats line, on top of the
     *  scene. Bound to backtick in the editor; a no-op on a build without the UI module. */
    consoleToggle() { try {
        this.m.ccall("engine_console_toggle", null, [], []);
    }
    catch { /* no UI build */ } }
    /** Drain log records with seq > sinceSeq for the editor Console dock/toasts. Fields \x1f-separated, records
     *  newline-separated: "seq\x1flevel\x1fcat\x1fmsg". "" when nothing new. */
    logDrain(sinceSeq) { try {
        return this.m.ccall("engine_log_drain", "string", ["number"], [sinceSeq]) || "";
    }
    catch {
        return "";
    } }
    /** Total log entries overwritten in the ring since boot — the Console shows a "…N earlier dropped" marker
     *  when this grows (a burst outran the poll), so gaps aren't silent. */
    logDropped() { try {
        return this.m.ccall("engine_log_dropped", "number", [], []) || 0;
    }
    catch {
        return 0;
    } }
    /** Stop looping music — called on the Play→Stop transition (Stop doesn't reload the module, so a track started
     *  via audio.music() would otherwise keep playing in Edit). No-op on an engine.wasm without an audio backend. */
    stopAudio() { try {
        this.m.ccall("engine_stop_audio", null, [], []);
    }
    catch { /* no audio build */ } }
    /** Register a UI screen by name (its data/ui/screens/<name>.rml content). The editor registers every screen
     *  once at boot; the running game then shows/hides them by name via ui_open/ui_close. */
    uiRegisterScreen(name, rml) {
        try {
            this.m.ccall("engine_ui_register", null, ["string", "string"], [name, rml]);
        }
        catch { /* no UI build */ }
    }
    /** Register a shared file (the project's theme.rcss) that screens reference via <link href="theme.rcss">. */
    uiRegisterFile(name, content) {
        try {
            this.m.ccall("engine_ui_register_file", null, ["string", "string"], [name, content]);
        }
        catch { /* no UI build */ }
    }
    // Register a UI IMAGE (PNG bytes) so a screen's decorator:image can decode it in editor Play — the editor
    // has no disk, so it fetches the file and hands the bytes across (const char* would truncate at a null).
    /** M2b-2 (editor): stage ONE user-shader variant blob (canonical index 0..13); the engine
     *  commits the model to the frontend registry when all 14 have arrived. WGSL bytes on web. */
    userShaderVariant(name, idx, bytes) {
        try {
            const p = this.m._malloc(bytes.length || 1);
            this.m.HEAPU8.set(bytes, p);
            this.m.ccall("engine_user_shader_variant", null, ["string", "number", "number", "number"], [name, idx | 0, p, bytes.length]);
            this.m._free(p);
        }
        catch {
            console.error(`[shaders] engine_user_shader_variant unavailable — user shader '${name}' will not preview`);
        }
    }
    uiRegisterFileBin(name, bytes) {
        try {
            const p = this.m._malloc(bytes.length || 1);
            this.m.HEAPU8.set(bytes, p);
            this.m.ccall("engine_ui_register_file_bin", null, ["string", "number", "number"], [name, p, bytes.length]);
            this.m._free(p);
        }
        catch { /* no UI build */ }
    }
    /** Register a sprite-animation sidecar (ui/sprites/<name>.sprite.json) so screens can use
     *  `decorator: sprite-anim(name/clip)`. The sheet PNG must be registered via uiRegisterFileBin first. */
    uiRegisterSprite(name, json) {
        try {
            this.m.ccall("engine_ui_register_sprite", null, ["string", "string"], [name, json]);
        }
        catch { /* no UI build */ }
    }
    /** U2: register the whole ui/ from the loaded pack's project files (theme, images, sprites, screens) —
     *  the same feed native boots through. Returns the screen count; 0 = a pre-unification pack. */
    uiRegisterPack() {
        try {
            return this.m.ccall("engine_ui_register_pack", "number", [], []);
        }
        catch {
            return 0;
        }
    }
    /** M2b-2: register the pack's user shader assets into the frontend (returns the model count). */
    shadersRegisterPack() {
        try {
            return this.m.ccall("engine_shaders_register_pack", "number", [], []);
        }
        catch {
            return 0;
        }
    }
    /** Open / close a registered screen by name — the editor uses these to PREVIEW a screen over the Edit scene
     *  (the game opens screens itself in Play via its scripts). */
    uiOpen(name) { try {
        this.m.ccall("engine_ui_open", null, ["string"], [name]);
    }
    catch { /* no UI build */ } }
    uiCloseScreen(name) { try {
        this.m.ccall("engine_ui_close", null, ["string"], [name]);
    }
    catch { /* no UI build */ } }
    /** Set a data-bound value ({{key}}) — used to preview a screen with sample data. */
    uiSet(key, value) { try {
        this.m.ccall("engine_ui_set", null, ["string", "string"], [key, value]);
    }
    catch { /* no UI build */ } }
    /** Forward the pointer to the in-game HUD (Phase 5 interactive menus). Coords are #view backing-store pixels. */
    uiPointerMove(x, y) {
        try {
            this.m.ccall("engine_ui_pointer", null, ["number", "number", "number", "number"], [x | 0, y | 0, 0, 0]);
        }
        catch { /* no UI build */ }
    }
    uiPointerButton(down) {
        try {
            this.m.ccall("engine_ui_pointer", null, ["number", "number", "number", "number"], [0, 0, down ? 1 : 0, 1]);
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
            this.m.ccall("engine_pointer", null, ["number", "number", "number", "number"], [x | 0, y | 0, 0, 0]);
        }
        catch {
            Engine.ptrLoud("engine_pointer");
        }
    }
    /** `button`: the ENGINE's pointer button (input.h) — 0 primary, 1 secondary (the mouse's right), 2 middle. */
    pointerButton(down, button = 0) {
        try {
            this.m.ccall("engine_pointer", null, ["number", "number", "number", "number"], [0, 0, down ? 1 : 0, (button | 0) + 1]);
        }
        catch {
            Engine.ptrLoud("engine_pointer");
        }
    }
    /** The wheel → GAMEPLAY (input.wheel(), the inspect view's zoom). `notches` as uiWheel takes them — positive DOWN; the
     *  engine's are positive AWAY (up), so they are flipped here, once. */
    wheel(notches) {
        try {
            this.m.ccall("engine_wheel", null, ["number"], [-notches]);
        }
        catch {
            Engine.ptrLoud("engine_wheel");
        }
    }
    /** A touch finger → the SAME gameplay pointer (a tap reads as a click). phase 0 down / 1 move / 2 up.
     *  The engine decides which finger owns the pointer, so forward them all. */
    pointerTouch(id, x, y, phase) {
        try {
            this.m.ccall("engine_pointer_touch", null, ["number", "number", "number", "number"], [id | 0, x | 0, y | 0, phase | 0]);
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
            this.m.ccall("engine_ui_wheel", null, ["number", "number", "number"], [x | 0, y | 0, notches]);
        }
        catch { /* no UI build */ }
    }
    uiTouch(id, x, y, phase) {
        try {
            this.m.ccall("engine_ui_touch", null, ["number", "number", "number", "number"], [id | 0, x | 0, y | 0, phase | 0]);
        }
        catch { /* no UI build */ }
    }
    /** Register an imported mesh (.ocm blob) under `name`; returns its triangle count
     *  (0 = invalid). The blob is NOT freed — the engine's mesh points straight into it. */
    registerMesh(name, blob) {
        const p = this.m._malloc(blob.length);
        this.m.HEAPU8.set(blob, p);
        const tris = this.m.ccall("engine_register_mesh", "number", ["string", "number", "number"], [name, p, blob.length]);
        if (!tris) {
            this.m._free(p);
            return 0;
        } // rejected → engine kept nothing, reclaim the blob
        const prev = this.meshBlobs.get(name); // re-import → engine now points into `p`; free the old one
        if (prev !== undefined)
            this.m._free(prev);
        this.meshBlobs.set(name, p);
        return tris;
    }
    /** Register an imported texture (raw RGB565 px) under `name`. Blob kept live (engine points into it);
     *  a re-import of the same name frees the superseded blob. */
    registerTexture(name, px, w, h) {
        const p = this.m._malloc(px.length);
        this.m.HEAPU8.set(px, p);
        this.m.ccall("engine_register_texture", "number", ["string", "number", "number", "number"], [name, p, w, h]);
        const prev = this.texBlobs.get(name);
        if (prev !== undefined)
            this.m._free(prev);
        this.texBlobs.set(name, p);
    }
    /** IM3b: register an ALPHA-lane texture (raw RGBA8-sRGB with alpha, w*h*4 — cutout albedo). */
    registerTextureAlpha(name, px, w, h) {
        const p = this.m._malloc(px.length);
        this.m.HEAPU8.set(px, p);
        try {
            this.m.ccall("engine_register_texture_alpha", "number", ["string", "number", "number", "number"], [name, p, w, h]);
        }
        catch {
            this.m._free(p);
            return;
        } // older engine.wasm — the texture arrives via the pack after a reload
        const prev = this.texBlobs.get(name);
        if (prev !== undefined)
            this.m._free(prev);
        this.texBlobs.set(name, p);
    }
    /** IM4: register a transform CLIP (JSON props) live — a just-imported rigid animation plays without
     *  a reload. The engine copies the keys; nothing to keep alive JS-side. */
    registerXclip(name, json) {
        try {
            this.m.ccall("engine_register_xclip", "number", ["string", "string", "number"], [name, json, json.length]);
        }
        catch { /* an older engine.wasm without the export — the clip arrives via the pack after a reload */ }
    }
    /** MT3: register a mesh's shape-key bundle (the OCMT sidecar bytes) live under the MESH id — the
     *  kind-11 contract. The engine COPIES at parse, so the scratch heap block frees immediately. */
    registerMorphs(name, bytes) {
        try {
            const p = this.m._malloc(bytes.length);
            this.m.HEAPU8.set(bytes, p);
            this.m.ccall("engine_register_morphs", "number", ["string", "number", "number"], [name, p, bytes.length]);
            this.m._free(p);
        }
        catch { /* an older engine.wasm without the export — the bundle arrives via the pack after a reload */ }
    }
    /** IM1: register a LINEAR-lane texture (raw RGBA8, w*h*4 — normal maps) under `name`, same
     *  keep-alive/re-import contract as registerTexture. Data maps never ride the sRGB/565 path. */
    registerTextureLinear(name, px, w, h) {
        const p = this.m._malloc(px.length);
        this.m.HEAPU8.set(px, p);
        this.m.ccall("engine_register_texture_linear", "number", ["string", "number", "number", "number"], [name, p, w, h]);
        const prev = this.texBlobs.get(name);
        if (prev !== undefined)
            this.m._free(prev);
        this.texBlobs.set(name, p);
    }
    // SK5: register an imported HDRI equirect (RGBA16-float pixels, w*h*8 bytes) so the editor previews the
    // skybox live. Kept alive JS-side like textures; scene.skybox("<name>") / scene.json then draws it.
    // I4: `sh` = the 27 baked SH-L2 diffuse coeffs (server-computed on import), so Environment Light = Skybox
    // previews live in the viewport without a pack rebuild. ga_register_hdr stores the pointer zero-copy, so the
    // SH block is kept alive JS-side too. Omit/undefined = no SH (IBL falls back to the flat ambient).
    // I2d: `env` = the server-prefiltered specular cube ([6 faces × envMips, FACE-major, RGBA16F], the SAME layout
    // packassets ships), so a metal object reflects the sky live in the viewport without a pack rebuild. Kept alive
    // JS-side like px/sh (ga_register_hdr stores the pointer zero-copy). Omit → metals stay unlit (diffuse-only IBL).
    registerHdr(name, px, w, h, sh, env, envBase = 0, envMips = 0) {
        const p = this.m._malloc(px.length);
        this.m.HEAPU8.set(px, p);
        let sp = 0;
        if (sh && sh.length >= 27) {
            sp = this.m._malloc(27 * 4);
            this.m.HEAPF32.set(sh instanceof Float32Array ? sh.subarray(0, 27) : Float32Array.from(sh.slice(0, 27)), f32Index(sp));
        }
        let ep = 0;
        if (env && env.length > 0 && envBase > 0 && envMips > 0) {
            ep = this.m._malloc(env.length);
            this.m.HEAPU8.set(env, ep);
        }
        this.m.ccall("engine_register_hdr", "number", ["string", "number", "number", "number", "number", "number", "number", "number"], [name, p, w, h, sp, ep, envBase, envMips]);
        const prev = this.hdrBlobs.get(name);
        if (prev !== undefined)
            this.m._free(prev);
        this.hdrBlobs.set(name, p);
        const prevSh = this.hdrShBlobs.get(name);
        if (prevSh)
            this.m._free(prevSh);
        this.hdrShBlobs.set(name, sp);
        const prevEnv = this.hdrEnvBlobs.get(name);
        if (prevEnv)
            this.m._free(prevEnv);
        this.hdrEnvBlobs.set(name, ep);
    }
    hasMesh(name) {
        return !!this.m.ccall("engine_has_mesh", "number", ["string"], [name]);
    }
    // Canned motion (spin/bob/orbit) — runs every frame, even while editing (non-destructive preview).
    animate(dt) {
        this.m.ccall("engine_animate", null, ["number"], [dt]);
    }
    // Feed this frame's raw input from a set of pressed engine key bits (KEY_CODE_BITS values).
    // The editor is a keyboard device: we synthesize the virtual sticks here (WASD→LX/LY,
    // arrows→RX/RY look delta, E/Q→L/R fly) — the same mapping the desktop shim uses — so
    // movement_system responds, while keys[] still drives the action layer (Jump/Fire/…). Call
    // once per Play frame BEFORE play(). dt scales the arrow-look delta (matches desktop's rate).
    // mouseDx/Dy: the CAPTURED mouse's movement this frame (src/mouselook.ts — 0 when not captured), added to the arrows' look.
    input(keybits, dt, mouseDx = 0, mouseDy = 0) {
        const B = KEY_CODE_BITS;
        const s = rawSticks((code) => (keybits >> B[code]) & 1, dt, mouseDx, mouseDy);
        this.m.ccall("engine_input", null, ["number", "number", "number", "number", "number", "number"], [keybits, s.lx, s.ly, s.rx, s.ry, s.pad]);
    }
    // 2026-10-01: the running game asks for the mouse to be captured for look (a Movement "first person" walker is active —
    // movement_wants_mouse_look). The editor's Play and the web player capture it on the next click (src/mouselook.ts).
    wantsMouseLook() {
        return this.m.ccall("engine_wants_mouse_look", "number", [], []) !== 0;
    }
    // Gameplay (action input + movement + Condition/Action + scripts) — mutates scene state, so the
    // editor calls this only in Play mode. Stop reverts by reloading the authored scene (applyScene).
    play(dt) {
        this.m.ccall("engine_play", null, ["number"], [dt]);
    }
    /** The LIVE input binding table as a `{actions:[...]}` config block (the rebinding UI reads this
     *  to show current/default bindings — no JS-side duplication of the engine's defaults). */
    inputConfigJson() {
        // ccall with ret "string" returns a JS string at runtime; the local typing says number, so cast.
        return this.m.ccall("engine_input_config_json", "string", [], []);
    }
    /** Apply an edited binding block live (accepts the bare `{actions:[...]}` or a full `{input:{...}}`).
     *  Returns the number of actions overridden. */
    loadInputConfig(json) {
        return this.m.ccall("engine_load_input_config", "number", ["string"], [json]);
    }
    /** Select the physics backend for Play mode from the project's `{physics:{backend:"jolt"|"off"}}` block
     *  (default Jolt; absent/empty → default). The preview then simulates exactly what the built game will. */
    loadPhysics(json) {
        this.m.ccall("engine_load_physics", null, ["string"], [json]);
    }
    setGrid(on) {
        this.m.ccall("engine_set_grid", null, ["number"], [on ? 1 : 0]);
    }
    /** Editor collider wireframes (green) on/off. The viewport ties this to Edit mode (off in Play). */
    setColliders(on) {
        this.m.ccall("engine_set_colliders", null, ["number"], [on ? 1 : 0]);
    }
    /** Editor light gizmos (yellow sun/sphere/cone per Light entity) on/off — Edit mode only, like the grid. */
    setLightGizmos(on) {
        this.m.ccall("engine_set_light_gizmos", null, ["number"], [on ? 1 : 0]);
    }
    /** Editor VOLUME gizmos on/off: the box a decal projects through (magenta) + the box / sphere a fog volume fills
     *  (cyan) — Edit mode only, like the light gizmos. Why: a decal / fog-volume Size is in the entity's LOCAL units
     *  (the transform's Scale multiplies it, like a collider's); a [40,20,40] decal on a ×10/×21 platform was a
     *  425×857-unit box nobody could see, and the flat texture it produced was hunted for six hours as a web bug. */
    setVolumeGizmos(on) {
        this.m.ccall("engine_set_volume_gizmos", null, ["number"], [on ? 1 : 0]);
    }
    /** The project's rendering.shadows setting (Project Settings). Off = the zero-cost no-shadows path. */
    /** Apply EVERY project/game setting (input rebinds / physics backend / rendering) in one call — the
     *  shared runtime path all platforms boot through. Pass the baked game.json (or project.json) verbatim. */
    applyProject(json) {
        this.m.ccall("engine_apply_project", null, ["string"], [json]);
    }
    /** Project rendering.shadowDistance (m): how far ahead of the camera shadows reach. 0 = the 100 m default. */
    /** Project rendering.uiDataRate: 0 = data-bound values re-layout every frame; 30/15 = batched. */
    setUiDataRate(hz) {
        this.m.ccall("engine_set_ui_data_rate", null, ["number"], [hz]);
    }
    /** Project build.mode: production disarms the debug surfaces (console, overlay); development arms them. */
    setProduction(on) {
        this.m.ccall("engine_set_production", null, ["number"], [on ? 1 : 0]);
    }
    setShadowDistance(d) {
        this.m.ccall("engine_set_shadow_distance", null, ["number"], [d]);
    }
    /** Project rendering.shadowResolution: the directional shadow map's size in texels (1024 / 2048 / 4096; else 2048). */
    setShadowResolution(px) {
        this.m.ccall("engine_set_shadow_resolution", null, ["number"], [px]);
    }
    /** Project rendering.shadowCascades: 1..4 slices of the shadow distance, each its own tile of the sun's map (else 1). */
    setShadowCascades(n) {
        this.m.ccall("engine_set_shadow_cascades", null, ["number"], [n]);
    }
    setShadows(on) {
        this.m.ccall("engine_set_shadows", null, ["number"], [on ? 1 : 0]);
    }
    /** Project rendering.shadows "soft" (S2): the 4-tap PCF filter. Orthogonal to setShadows — Off/Hard/Soft
     *  maps to (on, soft) = (false,·) / (true,false) / (true,true). Live: the value rides the per-frame UBO. */
    setShadowFilter(soft) {
        this.m.ccall("engine_set_shadow_filter", null, ["number"], [soft ? 1 : 0]);
    }
    /** Project rendering.shadowUpdate (S5a): "high" / "medium" (default) / "low" — how many of the sun's cascade tiles
     *  re-render per frame. The NAME goes through: the engine's decoder is the one spelling of the values. Live. */
    setShadowUpdateRate(name) {
        this.m.ccall("engine_set_shadow_update_rate", null, ["string"], [name]);
    }
    /** Project rendering.lightingMode (G0): forward (false) / clustered (true — the default since 2026-10-17). Live: a per-frame value in the lights block. */
    setLightingMode(clustered) {
        this.m.ccall("engine_set_lighting_mode", null, ["number"], [clustered ? 1 : 0]);
    }
    /** Project rendering.cull: GPU (true) vs CPU (false) frustum culling. GPU is the default; see fe_frame. */
    setGpuCull(on) {
        this.m.ccall("engine_set_gpu_cull", null, ["number"], [on ? 1 : 0]);
    }
    /** Project rendering.renderQuality — the "Render quality" tier: "high" (RGBA16F HDR, default), "balanced"
     *  (RG11B10F HDR, half the memory) or "performance" (LDR — no HDR buffer, fastest). The tier bakes into the
     *  pipelines, so set this ONCE at boot before the first frame; a later change fully applies on the next
     *  editor reload. See docs/hdr-tonemap-plan.md T4. */
    setHdrFormat(tier) {
        this.m.ccall("engine_set_hdr_format", null, ["string"], [tier]);
    }
    /** Post P4 (docs/post-plan.md): push ONE post profile's document to the engine, LIVE — no scene reload (in Play a reload restarts
     *  the game). The editor's copy wins over the pack's until the next save rebuilds it. */
    /** The editor's scene VIEW → the engine: its whole post-profile set FIRST (the editor's live copies replace the engine's —
     *  engine_post_profiles_set; runtime/post_profiles.h), then the scene without it. The set is the editor's, never the scene
     *  format's: the shared scene parser ignores it, a saved scene never carries it, and the player loads with loadScene. */
    loadSceneView(scene) {
        const { postProfiles, ...rest } = scene;
        this.m.ccall("engine_post_profiles_set", null, ["string"], [JSON.stringify(postProfiles ?? {})]);
        return this.loadScene(JSON.stringify(rest));
    }
    postProfileUpdate(id, doc) {
        this.m.ccall("engine_post_profile_update", null, ["string", "string"], [id, JSON.stringify(doc)]);
    }
    /** Post P4: the project's DEFAULT profile ("" = none) — the PROJECT layer, live. */
    postSetProjectProfile(id) {
        this.m.ccall("engine_post_set_project_profile", null, ["string"], [id]);
    }
    /** Post P4: the SCENE's profile ("" = the project's look) — the SCENE layer, live (the scene file's "post" says it on reload). */
    postSetSceneProfile(id) {
        this.m.ccall("engine_post_set_scene_profile", null, ["string"], [id]);
    }
    /** Post P4: what the frame draws with — `param` "enabled" = on/off (1/0); a texture parameter = 1 when set; NaN = no such name. */
    postValue(effect, param) {
        return this.m.ccall("engine_post_value", "number", ["string", "string"], [effect, param]);
    }
    /** Post P4: the layer a value comes from — 0 project, 1 scene, 2 script, 3 debug; -1 = the declaration's default; 4 = the
     *  EFFECTS QUALITY limited it (post P5: the layers asked for more than the level allows). */
    postFrom(effect, param) {
        return this.m.ccall("engine_post_from", "number", ["string", "string"], [effect, param]);
    }
    /** Post P5: the project's EFFECTS QUALITY, live — "low" / "medium" / "high" (the engine's one name decoder; anything else =
     *  Medium). Project Settings saves it to project.json rendering.effectsQuality. */
    postSetQuality(level) {
        this.m.ccall("engine_post_set_quality", null, ["string"], [level]);
    }
    /** Post P5: the level the engine draws at — 0 Low, 1 Medium, 2 High. */
    postQuality() {
        return this.m.ccall("engine_post_quality", "number", [], []);
    }
    /** Project rendering.lodQuality — the cluster LOD cut's pixel threshold by name: "quality" (1 px), "balanced"
     *  (2 px, default) or "performance" (4 px). Read by the GPU cull every frame, so it applies live. T5.3. */
    setLodQuality(q) {
        this.m.ccall("engine_set_lod_quality", null, ["string"], [q]);
    }
    /** T0.4: the viewport's Debug view — "off" (the real picture) or "clusters" (every cluster the GPU cluster path
     *  draws in its own colour; batches it refused keep their real shader). An editor-session toggle, not a project
     *  setting; applies on the next frame and leaves no trace when switched off (gate-held pixel identity). */
    setDebugView(mode) {
        this.m.ccall("engine_set_debug_view", null, ["string"], [mode]);
    }
    /** 2026-09-14 the frame pacer: true when a frame is due at `nowMs` under `targetFps` (0 = every call runs) — the loop
     *  skips the animation frame otherwise. ONE pacer for every loop (engine/core/stats.h app_frame_due): the editor
     *  viewport, the web player, desktop and the phone pace to the same arithmetic. */
    frameDue(nowMs, targetFps) {
        return this.m.ccall("engine_frame_due", "number", ["number", "number"], [nowMs, targetFps]) !== 0;
    }
    /** The GAME's frame-rate cap — what a script's app.setTargetFps set (0 = uncapped). The viewport takes the slower of
     *  this and its own FPS dropdown while playing; the web player honours it alone. */
    setTargetFps(fps) { this.m.ccall("engine_set_target_fps", null, ["number"], [fps]); }
    targetFps() { return this.m.ccall("engine_target_fps", "number", [], []); }
    /** T0.4: Freeze culling — every camera-driven cull (frustum, cluster cones + LOD, occlusion) keeps the camera of
     *  the frame the freeze was engaged on while the view keeps following the orbit camera, so you can fly to the
     *  side and see what was culled. Session toggle, applies on the next frame. */
    setCullFreeze(on) {
        this.m.ccall("engine_set_cull_freeze", null, ["number"], [on ? 1 : 0]);
    }
    // ---- plugins P1 (docs/plugins-plan.md): JavaScript providers behind the engine's ads / iap / publisher services ----
    /** Register a JavaScript provider for one service under a plugin's name. The object is stored on
     *  Module.oceanPlugins[service] (the EM_JS bridge in engine/plugins/plugins_web.cpp reads it there) and the C
     *  registry gets a bridge entry under `name`, which is what the project file's "plugins" block selects. The
     *  provider contract (available/show/hideBanner, buy/restore/owned/price, loading/gameplay/happyTime/user) is
     *  documented in plugins_web.cpp. */
    registerProvider(service, name, provider) {
        const m = this.m;
        (m.oceanPlugins ?? (m.oceanPlugins = {}))[service] = provider;
        this.m.ccall("engine_plugins_register_web", null, ["string", "string"], [service, name]);
    }
    /** Select an already-registered provider by name ("test" / "null" / a plugin's). False = no such provider. */
    selectProvider(service, name) {
        return !!this.m.ccall("engine_plugins_select", "number", ["string", "string"], [service, name]);
    }
    /** Does THIS build carry a provider under that name? The builtins ("test", "null") always; a JavaScript plugin only
     *  once registerProvider ran. The editor's boot step asks before selecting (src/hostplugins.ts), since it cannot host
     *  a portal's SDK — that lives in the export. */
    pluginsRegistered(service, name) {
        return !!this.m.ccall("engine_plugins_registered", "number", ["string", "string"], [service, name]);
    }
    /** The project-file key this build reads from the "plugins" block ("web" for every browser build). */
    pluginsPlatform() {
        return this.m.ccall("engine_plugins_platform", "string", [], []);
    }
    /** registerProvider + selectProvider — a page or a test installing a provider outside the project file. */
    setProvider(service, name, provider) {
        this.registerProvider(service, name, provider);
        return this.selectProvider(service, name);
    }
    /** A JavaScript ads provider reports the outcome of the ad it started: rewarded | finished | dismissed | failed. */
    adResult(outcome, reason = "") {
        this.m.ccall("engine_plugins_ad_result", null, ["string", "string"], [outcome, reason]);
    }
    /** A JavaScript iap provider reports the outcome of a purchase/restore: purchased | cancelled | failed | restored. */
    iapResult(outcome, product, reason = "") {
        this.m.ccall("engine_plugins_iap_result", null, ["string", "string", "string"], [outcome, product, reason]);
    }
    publisherLoading(start) { this.m.ccall("engine_publisher_loading", null, ["number"], [start ? 1 : 0]); }
    publisherGameplay(start) { this.m.ccall("engine_publisher_gameplay", null, ["number"], [start ? 1 : 0]); }
    /** The HOST's mute switch (a portal's own audio toggle, e.g. CrazyGames game.settings.muteAudio): a mute reason UNDER the
     *  game's volume — the game's own setting survives, and an ad ending never unmutes a host-muted game. */
    hostMute(muted) { this.m.ccall("engine_host_mute", null, ["number"], [muted ? 1 : 0]); }
    /** The host paused the game (Playgama's PAUSE_STATE_CHANGED, a hidden tab): the simulation waits and the audio is muted
     *  under its own reason until the host resumes — composing with an ad in flight (plugins_host_pause). */
    hostPause(paused) { this.m.ccall("engine_host_pause", null, ["number"], [paused ? 1 : 0]); }
    adsAvailable(kind = "rewarded") {
        return !!this.m.ccall("engine_ads_available", "number", ["string"], [kind]);
    }
    /** Ask for an ad through the engine's ads service — the game's ads.showRewarded, from the page. */
    adsShow(kind, tag = "") {
        return !!this.m.ccall("engine_ads_show", "number", ["string", "string"], [kind, tag]);
    }
    pluginsBlocking() { return !!this.m.ccall("engine_plugins_blocking", "number", [], []); }
    pluginsSelected(service) {
        return this.m.ccall("engine_plugins_selected", "string", ["string"], [service]);
    }
    /** Hi-Z two-phase occlusion culling (rides the GPU cull path; byte-identical output). H4 profile default. */
    setOcclusion(on) {
        this.m.ccall("engine_set_occlusion", null, ["number"], [on ? 1 : 0]);
    }
    /** Project rendering.anisotropy — the "Anisotropic filtering" max (0/1 off, 2/4/8/16; default 8). Set at
     *  boot before the first texture upload (the material sampler is created lazily with it); a later change
     *  takes full effect on the next reload. T0, docs/resource-architecture-plan.md. */
    setAnisotropy(n) {
        this.m.ccall("engine_set_anisotropy", null, ["number"], [n | 0]);
    }
    /** MODEL MATERIALS (docs/model-materials-plan.md): the model material `mesh`'s slot FOLLOWS — the engine's own table, the one
     *  it renders with ("" = none: a plain mesh, or a model imported before model materials). Editor-only export. */
    meshMaterial(mesh, slot) {
        return this.m.ccall("engine_mesh_material", "string", ["string", "number"], [mesh, slot | 0]);
    }
    /** The LIVE import's half of the table: `mesh` follows these model materials (slot order) — a model imported mid-session is
     *  registered without a pack reload, so its meshes learn their materials here (the next pack brings the whole table). */
    setMeshMaterials(mesh, ids) {
        this.m.ccall("engine_set_mesh_materials", null, ["string", "string"], [mesh, JSON.stringify(ids)]);
    }
    /** How many material slots `mesh` has (a skinned character's submeshes); 0 = a mesh the engine does not know. Editor-only. */
    meshSlots(mesh) {
        return this.m.ccall("engine_mesh_slots", "number", ["string"], [mesh]);
    }
    /** Memory plan M3d: simulate a device with `mb` of memory — the editor runs at that number, every bucket following it live (the
     *  Memory window's "Simulate a device"; not saved). 0 = stop: the editor's own number again. */
    simulateMemoryMB(mb) {
        this.m.ccall("engine_simulate_memory_mb", null, ["number"], [Math.max(0, mb | 0)]);
    }
    /** The simulated device's memory in MB, 0 = none. */
    simulatedMemoryMB() {
        return this.m.ccall("engine_simulated_memory_mb", "number", [], []);
    }
    /** Memory plan M2: the project's textures share of the streamed memory (Project Settings ▸ Memory; 0 = the engine's default).
     *  Live — the next plan splits by it. */
    setTextureShare(pct) {
        this.m.ccall("engine_set_texture_share", null, ["number"], [pct | 0]);
    }
    /** Ragdoll R1b: skeleton-agnostic rig auto-fit on a registered mesh + skeleton — returns the
     *  record-props JSON ({"bones":[...]}) or "" when nothing fits (no skin / unknown ids). */
    rigAutofit(meshId, skelId) {
        return this.m.ccall("engine_rig_autofit", "string", ["string", "string"], [meshId, skelId]);
    }
    /** A mesh's local-space AABB { min, max }. Used to auto-fit a new Collider to its mesh (full size). */
    meshBounds(name) {
        const ptr = this.m._malloc(24);
        this.m.ccall("engine_mesh_bounds", null, ["string", "number"], [name, ptr]);
        const f = this.m.HEAPF32, b = f32Index(ptr);
        const r = { min: [f[b], f[b + 1], f[b + 2]], max: [f[b + 3], f[b + 4], f[b + 5]] };
        this.m._free(ptr);
        return r;
    }
    /** Editor free camera override (0 = use the scene's own camera). near/far 0 = engine defaults;
     *  the orbit camera passes distance-scaled planes so huge imports render without clipping. */
    setView(enabled, pos, rot, fov, near = 0, far = 0) {
        this.m.ccall("engine_set_view", null, ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number"], [enabled ? 1 : 0, pos[0], pos[1], pos[2], rot[0], rot[1], rot[2], fov, near, far]);
    }
    /** Raycast-select the entity under framebuffer pixel (x, y); -1 = empty space. */
    pick(x, y) {
        return this.m.ccall("engine_pick", "number", ["number", "number"], [x, y]);
    }
    /** Project a world point to a framebuffer pixel (same camera as the render). */
    project(x, y, z) {
        const ptr = this.m._malloc(8); // 2 floats out
        const vis = this.m.ccall("engine_project", "number", ["number", "number", "number", "number"], [x, y, z, ptr]);
        const b = f32Index(ptr);
        const out = { sx: this.m.HEAPF32[b], sy: this.m.HEAPF32[b + 1], visible: !!vis };
        this.m._free(ptr);
        return out;
    }
    /** Frame timings for the perf HUD (engine_api.cpp ENGINE_PERF_*): [cpuExtractMs, cpuRecordMs, then THE GPU PROFILE's
     *  last closed ~1 s window (docs/gpu-profiler-plan.md): gpuFrameMs, sceneMs, shadowsMs, cullMs, postMs (tonemap + HUD),
     *  otherMs, gapsMs, stampStepUs]. The GPU groups + other + gaps cover the whole GPU frame. GPU entries are 0 until the
     *  device supports timestamp-query and a window lands; stampStepUs 100 = Chrome's quantized timer (averages stay
     *  unbiased). The block is sized by the ENGINE (engine_perf_count) — a literal here once overflowed. */
    /** F3: which path drew the last frame, in the engine's words (engine_path_text) — the FPS card's path line. */
    pathText() {
        try {
            return this.m.ccall("engine_path_text", "string", [], []);
        }
        catch {
            return "–";
        }
    }
    perf() {
        if (!this.perfCount)
            this.perfCount = this.m.ccall("engine_perf_count", "number", [], []);
        const ptr = this.m._malloc(4 * this.perfCount);
        const n = this.m.ccall("engine_perf", "number", ["number"], [ptr]);
        const b = f32Index(ptr);
        const out = [];
        for (let i = 0; i < n; i++)
            out.push(this.m.HEAPF32[b + i]);
        this.m._free(ptr);
        return out;
    }
    /** THE GPU PROFILE's last closed window as text: a header line (the GPU frame = busy + gaps), then every group and pass,
     *  indented, with its average ms per frame (docs/gpu-profiler-plan.md). "" before the first window. */
    gpuProfile() {
        return this.m.ccall("engine_gpu_profile", "string", [], []); // ccall's typing says number; "string" returns one
    }
    /** A registered mesh's [vertices, triangles], or null if unknown (asset inspector). */
    meshInfo(name) {
        const ptr = this.m._malloc(8);
        const ok = this.m.ccall("engine_mesh_info", "number", ["string", "number"], [name, ptr]);
        const i32 = new Int32Array(this.m.HEAPU8.buffer, ptr, 2);
        const out = [i32[0], i32[1]];
        this.m._free(ptr);
        return ok ? out : null;
    }
    /** Drop all cached GPU textures — re-uploaded from the current registry next frame (quality rebake). */
    flushTextures() { try {
        this.m.ccall("engine_flush_textures", null, [], []);
    }
    catch { /* older wasm */ } }
    /** Drop all cached GPU meshes — re-uploaded from the current registry next frame (rescale rebake). */
    flushMeshes() { try {
        this.m.ccall("engine_flush_meshes", null, [], []);
    }
    catch { /* older wasm */ } }
    /** A registered mesh's local bounding-sphere radius (0 = unknown) — frames real-scale placements. */
    meshRadius(name) {
        try {
            return this.m.ccall("engine_mesh_radius", "number", ["string"], [name]);
        }
        catch {
            return 0;
        }
    }
    /** World-space position of entity `idx` (composes its parent chain). */
    entityWorldPos(idx) {
        const ptr = this.m._malloc(12); // 3 floats out
        this.m.ccall("engine_entity_world_pos", null, ["number", "number"], [idx, ptr]);
        const b = f32Index(ptr);
        const v = [this.m.HEAPF32[b], this.m.HEAPF32[b + 1], this.m.HEAPF32[b + 2]];
        this.m._free(ptr);
        return v;
    }
    /** What F frames for entity `idx`: the world point (its mesh's middle — parents and scale included) and the world radius
     *  to fit (0 = no mesh: its world position, keep the distance). The engine's sv_entity_focus_sphere. */
    entityFocus(idx) {
        const ptr = this.m._malloc(16); // 4 floats out
        this.m.ccall("engine_entity_focus", null, ["number", "number"], [idx, ptr]);
        const b = f32Index(ptr);
        const r = { center: [this.m.HEAPF32[b], this.m.HEAPF32[b + 1], this.m.HEAPF32[b + 2]], radius: this.m.HEAPF32[b + 3] };
        this.m._free(ptr);
        return r;
    }
    /** Keep-world reparent (hierarchy drag-drop): re-parent `child` under `parent` (parent < 0 = detach to
     *  root) preserving its WORLD transform, and return the resulting LOCAL transform for the caller to write
     *  into the scene JSON. Runs the engine's gated keep-world math on the live preview scene (indices match
     *  the editor's, as with entityWorldPos), so the child doesn't visually jump. */
    reparentKeepWorld(child, parent) {
        const ptr = this.m._malloc(36); // 9 floats out (pos, rot, scale)
        this.m.ccall("engine_reparent_keep_world", null, ["number", "number", "number"], [child, parent, ptr]);
        const b = f32Index(ptr), f = this.m.HEAPF32;
        const trs = {
            position: [f[b], f[b + 1], f[b + 2]],
            rotation: [f[b + 3], f[b + 4], f[b + 5]],
            scale: [f[b + 6], f[b + 7], f[b + 8]],
        };
        this.m._free(ptr);
        return trs;
    }
    tris() {
        return this.m.ccall("engine_tris", "number", [], []);
    }
    /** Drawn object count last frame (perf meter). */
    /** S5b-2: the shadow passes' WORK last frame — [sun paced tiles, sun dynamic tiles, lamp static tiles re-rendered,
     *  lamp dynamic tiles, lamp caster instances unsplit / static / dynamic]. The honest companion of perf(): a cached
     *  tile is 0 work whatever the GPU clock makes its timestamp read. */
    shadowTiles() {
        const ptr = this.m._malloc(7 * 4);
        const n = this.m.ccall("engine_shadow_tiles", "number", ["number"], [ptr]);
        const out = Array.from(new Int32Array(this.m.HEAPU8.buffer, ptr, n));
        this.m._free(ptr);
        return out;
    }
    draws() {
        return this.m.ccall("engine_draws", "number", [], []);
    }
    /** Render a frame. SW build: returns a view of the RGB565 framebuffer (byte-swapped for the ST7789) to blit.
     *  GPU build: presents directly to the #view WebGPU canvas and returns an EMPTY view (nothing to blit). */
    render() {
        if (this.gpu) {
            this.m.ccall("engine_render", null, [], []);
            return Engine.EMPTY_FB;
        }
        const ptr = this.m.ccall("engine_render", "number", [], []);
        const base = u16Index(ptr);
        return this.m.HEAPU16.subarray(base, base + this.width * this.height);
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
/** M2b-2/UX: (re)stage user shader-asset variants into the WASM registry from the dev server's
 *  /shaders channel — at viewport boot AND right after a shader import, so a freshly dropped or
 *  created .slang is assignable immediately (no page reload; registration replaces in place).
 *  `only` limits the fetch to the named shaders (an import's receipt); omitted = all listed.
 *  A refused blob is LOUD and skips that model — never half-registered. */
export async function refreshUserShaders(engine, only) {
    try {
        const shl = (await (await fetch("shaders/list")).json());
        for (const [sname, man] of Object.entries(shl.shaders || {})) {
            if (only && !only.includes(sname))
                continue;
            const keys = man.variants ?? [];
            for (let vi = 0; vi < keys.length; vi++) {
                const r = await fetch(`shaders/blob?name=${encodeURIComponent(`${sname}.${keys[vi]}.wgsl`)}`);
                if (!r.ok) {
                    console.error(`[shaders] blob ${sname}.${keys[vi]}.wgsl refused (${r.status}) — '${sname}' not registered`);
                    break;
                }
                engine.userShaderVariant(sname, vi, new Uint8Array(await r.arrayBuffer()));
            }
        }
    }
    catch { /* no user shaders / no backend */ }
}
