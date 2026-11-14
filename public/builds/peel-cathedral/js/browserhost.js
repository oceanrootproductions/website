// The BROWSER's half of the editor's engine (enginehost.ts): the C++ engine compiled to WebAssembly (web/engine.js) in this page, and
// everything only a browser does around it — the WebGPU device on #view, the pack held in page memory, the bytes pushed into the
// engine's heap, the decode helpers, the page's own memory report. The table's browser-only rows (engineapi.ts where: "web",
// WebEngineApi) are reached from here and nowhere else in the editor's source: until P2 step 2 the Engine class called them itself,
// and in the desktop app each would have been a call to an engine that is not there. The code below moved here from engine.ts as it was.
import { u16Index } from "./heap.js"; // pointers past 2 GB: >>> not >> (see heap.ts)
import { guardExports } from "./engineexports.js"; // a stale engine.wasm fails by NAME, not "func is not a function"
import { wasmEngineApi, browserEngineDoor } from "./engineapi.gen.js"; // THE door: one typed method per row of engineapi.ts
import { DecodeClient, LANE_BASE_MB, LANE_TICKET_GROWTH_PCT } from "./decodeclient.js"; // 2026-09-26: streaming decodes on a Web Worker, off the frame
import { fetchPackStoreOrNone } from "./packstore.js"; // 2026-10-01: the pack in pieces (a browser refuses one buffer of 2 GiB+)
import { takeNameOk } from "./takes.js"; // THE TAKE (plan §5): which files, said once for both editors
import { NO_FACTS } from "./enginehost.js";
export class BrowserHost {
    aiWorking() { }
    constructor(m) {
        this.m = m;
        this.kind = "browser";
        /** The editor's WebAssembly build carries the HUD module (a build without it tolerates each call — engine.ts). */
        this.hasHud = true;
        this.capturePicture = null;
        /** No game modules: this engine has the game's scripts compiled in (Play's own path rebuilds it — main.ts rebuildWasm). */
        this.gameModules = null;
        this.width = 240;
        this.height = 240;
        this.framesDrawn = 0;
        /** The software build's last framebuffer (the viewport blits it); null in the GPU build, which presents to #view itself. */
        this.framebuffer = null;
        this.facts = NO_FACTS;
        // GPU build (engine_gpu.wasm): engine_render presents to #view via WebGPU — the viewport must NOT blit a
        // framebuffer, and the boot path awaits the async device init. false = the software build (returns an fb to blit).
        this.gpu = false;
        /** 2026-09-26: the streaming decode worker (decodeclient.ts). The engine hands every streaming decode (a mesh level
         *  range, a texture's mips) to it as a ticket once it answers; the island in the web editor ran at 24 fps while the
         *  camera moved when those decodes ran inside the frame. The client is registered at boot but the worker starts only at
         *  the engine's first streaming decode (wake). Its files sit beside the engine: js/decodeworker.js and decode.js /
         *  decode.wasm (scripts/build_wasm.sh builds the decoder from the engine's own decode sources). */
        this.decode = null;
        /** AN ASSET TILE (enginehost.ts): this engine draws its isolated preview onto its own off-screen canvas (#pview — it has no
         *  readback: the build drops ASYNCIFY, preview.h) and answers that canvas, the picture on it. The preview is made at the first tile,
         *  at that size (one preview, one size). The subject loads with the SAME loader the live scene uses, pointed at the preview's own
         *  scene, so a tile and a placed object never disagree about what a model looks like. */
        this.previewSize = 0;
        const wasm = wasmEngineApi(m);
        this.web = wasm;
        this.api = browserEngineDoor(wasm);
    }
    /** The raw Module — main.ts points Module.oceanSaveSink at the dev server (editor-only). */
    get module() { return this.m; }
    /** engine.js's module, guarded, and the engine up: its boot, the page's memory facts, the decode helpers, the WebGPU device. */
    /** `beforeRenderer` (the plan's (c4), 2026-11-09): what the page must do after the engine is up and before its renderer is made. The web
     *  player loads its pack there, so the engine's shaders come from the pack as on every other platform (a renderer made first finds
     *  none: they used to be embedded in the game's wasm, 3.9 MB of the sample's 9.9). The WebGPU device is asked for BEFORE it, so the
     *  device and the page's step (the download) still overlap. */
    static async start(opts = {}) {
        // Guard BEFORE the first ccall: a wasm built before a new export lands (2026-09-23: engine_set_volume_gizmos)
        // must fail the fatal boot step with the export's name and the fix — the splash shows this message verbatim.
        const h = new BrowserHost(guardExports(await createEngine()));
        h.api.engine_init();
        // Memory plan M2 (docs/memory-budget-plan.md): what only the page knows. The browser's memory report picks the web game's row
        // of the engine's table (rounded down and capped at 8 GB by the browser; absent in Safari/Firefox = "not reported"); the
        // page's own share — the asset pack it holds outside the engine's heap + the decode helpers' heaps — counts against the
        // number, reported about once a second (the editor has its own number; the page still counts toward it).
        h.web.engine_set_browser_memory(navigator.deviceMemory ?? 0);
        setInterval(() => h.reportPageMemory(), 1000);
        h.registerDecodeWorker(); // the worker itself starts at the engine's first streaming decode; until it answers, decodes run inline
        // M3e e3b: the helpers as the page plans them (decodeclient.ts) — told before any scene's door plans the shares
        if (h.decode)
            h.web.engine_set_decode_lanes(h.decode.laneCount, LANE_BASE_MB, LANE_TICKET_GROWTH_PCT);
        // Tolerate an OLDER software engine.wasm that predates this export (ccall throws on a missing function) — that
        // build is the SW renderer, so default to false. The GPU build returns 1 and drives the device init.
        try {
            h.gpu = !!h.web.engine_is_gpu();
        }
        catch {
            h.gpu = false;
        }
        // The GPU build creates its WebGPU device + swapchain on the #view canvas — async (ASYNCIFY suspends on the
        // device request), so await it once here. AAA-style: render at the canvas's REAL pixel size (CSS × DPR,
        // Retina-sharp), not a fixed 240×240 — size the backing store, then init the device + swapchain at that size.
        const device = h.gpu ? h.requestDevice() : null; // asked for now; it arrives while the page does what comes before the renderer
        if (opts.beforeRenderer)
            await opts.beforeRenderer(h);
        if (device)
            h.attachDevice(await device);
        h.width = h.web.engine_width();
        h.height = h.web.engine_height();
        return h;
    }
    /** The WebGPU device, made in JavaScript (the only async step), handed to emdawnwebgpu's preinitialized-device slot; answers the
     *  canvas size it was asked at. attachDevice makes the engine's renderer on it. Two halves so a page step can run between (start). */
    async requestDevice() {
        const cv = document.getElementById("view");
        const dpr = window.devicePixelRatio || 1; // the backing store = the CSS size × devicePixelRatio (Retina-sharp)
        const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
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
        this.m.preinitializedWebGPUDevice = device;
        return { w, h };
    }
    attachDevice(size) {
        this.web.engine_gpu_init("#view", size.w, size.h); // synchronous: the device is already made (requestDevice)
    }
    /** Keep the GPU render (depth + viewport) matched to #view's ACTUAL backing-store size — cv.width/height, which the VIEWPORT
     *  sets (viewport.ts: in Auto it follows the canvas's box through a ResizeObserver; a fixed resolution forces it). Nothing
     *  else sizes it: this comment used to say WebGPU/Dawn resizes the drawing buffer to the CSS box × DPR — it does not, and that
     *  belief hid the flat view of a page booted hidden (2026-10-20). Cheap (no layout query), safe to call every frame: a no-op
     *  unless the backing store actually changed. */
    resize(w, h) {
        if (!this.gpu || (w === this.width && h === this.height))
            return;
        this.web.engine_gpu_resize(w, h);
        this.width = w;
        this.height = h;
    }
    /** Render a frame. SW build: returns a view of the RGB565 framebuffer (byte-swapped for the ST7789) to blit.
     *  GPU build: presents directly to the #view WebGPU canvas and answers null (nothing to blit). */
    render() {
        if (this.gpu) {
            this.web.engine_render();
            return null;
        }
        const ptr = this.web.engine_render();
        const base = u16Index(ptr);
        return this.m.HEAPU16.subarray(base, base + this.width * this.height);
    }
    /** THE EDITOR'S TICK (enginehost.ts): the engine answers at once — this tick's facts — and a due tick draws here, now. A tick that
     *  cannot run THROWS (a stale engine.wasm without the row: guardExports names it): the boot's first frame fails by name, a later one
     *  stops the loop loudly. It was caught into a console line once, the first day — editorboot_test's canary went red: a stale engine
     *  booted to a view that never drew, with nothing on the splash. */
    frame(packet) {
        this.facts = JSON.parse(this.web.engine_editor_frame(packet));
        if (this.facts.due) {
            this.framebuffer = this.render();
            this.framesDrawn++;
        }
        return this.facts;
    }
    registerDecodeWorker() {
        const buildId = this.web.engine_decode_build_id();
        const client = new DecodeClient(this.m, this.web, new URL("./decodeworker.js", import.meta.url), new URL("../decode.js", import.meta.url).href, buildId);
        this.m.oceanDecode = client;
        this.decode = client;
    }
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
     *  number, and a refusal puts the previous pack back as the one the page reads.
     *  (The editor's copy of the pack's model-material table is refreshed by the Engine after any host's pack — engine.ts.) */
    loadAssets(pack) {
        const m = this.m;
        const packs = (m.oceanPacks ?? (m.oceanPacks = new Map()));
        const prevGen = m.oceanPackGen ?? 0;
        const gen = m.oceanPackSeq = (m.oceanPackSeq ?? 0) + 1;
        packs.set(gen, pack);
        m.oceanPack = pack;
        m.oceanPackGen = gen; // current BEFORE the call: anything the load itself streams reads the new pack
        this.reportPageMemory(); // M3e: the pack counts from now — before its scene's door plans the shares (the 1 s report came after it)
        const n = this.web.engine_load_assets_js(pack.length, gen);
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
        this.web.engine_set_page_memory(packMB, this.decode ? this.decode.heapTotal / 1048576 : 0);
    }
    /** The project's pack, fetched in pieces (packstore.ts): as ONE buffer, the 2.12 GiB Sunny Seaside lobby failed ("TypeError: Failed
     *  to fetch") and the editor came up with no pack at all. `reload`: the helper re-baked it — fetched past any cache. */
    async loadProjectPack(reload) {
        const pack = await fetchPackStoreOrNone("/assets.pack", reload ? { cache: "reload" } : undefined); // none yet (a fresh project): null
        return pack ? this.loadAssets(pack) : null;
    }
    async previewPicture(scene, view, size) {
        if (!this.previewSize) {
            if (!this.gpu || !this.web.engine_preview_init("#pview", size, size)) {
                console.error("[thumbs] no preview surface — asset tiles will keep their glyphs");
                return null;
            }
            this.previewSize = size;
        }
        if (size !== this.previewSize) {
            console.error(`[thumbs] a ${size}-px tile asked of the ${this.previewSize}-px preview — not drawn`);
            return null;
        }
        this.web.engine_preview_load_scene(scene);
        this.web.engine_preview_view(view.pos[0], view.pos[1], view.pos[2], view.rot[0], view.rot[1], view.rot[2], view.fov);
        if (this.web.engine_preview_render() <= 0)
            return null; // the subject did not resolve: keep the glyph
        const pv = document.getElementById("pview");
        return pv && pv.width && pv.height ? pv : null;
    }
    /** THE TAKE, the browser's half (docs/editor-app-plan.md §5): hand the engine one of the project's files, already fetched. The
     *  bytes are copied into a block of the engine's heap which the ENGINE owns from then on, refused or not (it frees the block a
     *  re-take replaces — this class kept three tables of them until 2026-10-31). Answers the engine's answer (takes.ts TakeAnswer). */
    takeBytes(take, bytes) {
        const p = this.m._malloc(bytes.length || 1);
        this.m.HEAPU8.set(bytes, p >>> 0); // >>> 0: the editor heap passes 2 GB (heap.ts)
        try {
            return JSON.parse(this.web.engine_take_bytes(JSON.stringify(take), p, bytes.length));
        }
        catch (e) {
            return { id: take.id, kind: take.kind, ok: false, why: `the engine could not take it — ${e instanceof Error ? e.message : String(e)}` };
        }
    }
    /** Take a list of the project's files (takes.ts — an import's answer, a sprite's sheet, a shader's variants): each fetched from the
     *  helper's /asset door and handed over, ONE AT A TIME (an 88-model import never holds every file in the page at once). The
     *  desktop app's twin reads them itself (takes.ts appTaker). A file the helper cannot serve is refused here with the engine's
     *  answer shape; the name rule is checked before any fetch, as the desktop engine checks it before any read. */
    async takeFiles(takes) {
        const out = [];
        for (const t of takes) {
            const file = t.kind === "shader" ? t.file + ".wgsl" : t.file; // this backend's variant (the desktop app's is .spv)
            if (!takeNameOk(t.file)) {
                out.push({ id: t.id, kind: t.kind, ok: false, why: `${t.file || "(no file)"}: not a file name inside the project` });
                continue;
            }
            if (t.kind === "pack") {
                out.push({ id: t.id, kind: t.kind, ok: false, why: "the browser hands its pack over by loadAssets, not as a take" });
                continue;
            }
            let r;
            try {
                r = await fetch(`asset?name=${encodeURIComponent(file)}`);
            }
            catch (e) {
                out.push({ id: t.id, kind: t.kind, ok: false, why: `${file}: the helper did not answer — ${e instanceof Error ? e.message : String(e)}` });
                continue;
            }
            if (!r.ok) {
                out.push({ id: t.id, kind: t.kind, ok: false, why: r.status === 404 ? `${file}: no such file in the project` : `${file}: the helper refused it (${r.status})` });
                continue;
            }
            out.push(this.takeBytes(t, new Uint8Array(await r.arrayBuffer())));
        }
        return out;
    }
    /** Register a JavaScript provider for one service under a plugin's name. The object is stored on
     *  Module.oceanPlugins[service] (the EM_JS bridge in engine/plugins/plugins_web.cpp reads it there) and the C
     *  registry gets a bridge entry under `name`, which is what the project file's "plugins" block selects. The
     *  provider contract (available/show/hideBanner, buy/restore/owned/price, loading/gameplay/happyTime/user) is
     *  documented in plugins_web.cpp. */
    registerProvider(service, name, provider) {
        const m = this.m;
        (m.oceanPlugins ?? (m.oceanPlugins = {}))[service] = provider;
        this.web.engine_plugins_register_web(service, name);
    }
}
