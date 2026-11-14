// The DESKTOP APP's half of the editor's engine (enginehost.ts; docs/editor-app-plan.md §2–§3, P2 step 2). The page is the editor the
// helper serves — the same files as the browser editor — and the app's preload (platforms/app/preload.cjs) is what tells it where it
// runs: window.oceanApp (the app's messages) and window.engineBridge (the engine's door). The native engine runs on its own thread in
// the app's main program; each finished frame arrives as a shared texture this draws into #view, under every overlay of the page.
import { appEngineDoor, appHostDoor } from "./engineapi.gen.js";
import { appTaker } from "./takes.js";
import { NO_FACTS } from "./enginehost.js";
/** The app's bridges, or null in a browser. */
export function appBridges() {
    const w = window;
    return w.oceanApp && w.engineBridge ? { app: w.oceanApp, bridge: w.engineBridge } : null;
}
export class AppHost {
    aiWorking() { this.app.aiWorking(); }
    constructor(app, bridge, ready) {
        this.app = app;
        this.kind = "app";
        this.gpu = true;
        this.module = {};
        /** Frames drawn into #view since the start — the app's boot test reads it (the picture arrives, not only the asks). */
        this.framesDrawn = 0;
        /** The engine's once-a-second line (fps and GPU times, as the desktop player's title says them). */
        this.statsLine = "";
        /** The answer of the last editor tick a DRAWN frame carried (the page never waits for one — enginehost.ts frame). */
        this.facts = NO_FACTS;
        this.said = new Set();
        this.capturePicture = (o) => this.app.capture(o);
        this.api = appEngineDoor(bridge);
        const own = appHostDoor(bridge);
        this.own = own;
        this.take = appTaker(own);
        this.gameModules = {
            load: async (path) => JSON.parse(await own.engine_module_load(path)),
            drop: () => own.engine_module_drop(),
            failure: () => own.engine_script_failure(),
        };
        this.width = ready.width;
        this.height = ready.height;
        this.hasHud = ready.hud;
    }
    /** Start the engine at #view's backing size and draw every frame it finishes into #view (a 2D canvas here: the browser's WebGPU
     *  context is never made). Answers once the engine's device is up — the project is the editor's boot to load. */
    static async start(app, bridge, view) {
        const dpr = window.devicePixelRatio || 1;
        view.width = Math.max(1, Math.round(view.clientWidth * dpr));
        view.height = Math.max(1, Math.round(view.clientHeight * dpr));
        const host = new AppHost(app, bridge, await app.start(view.width, view.height));
        const ctx = view.getContext("2d");
        if (!ctx)
            throw new Error("the scene view has no 2D context (another context was made on #view first)");
        // A frame of the old size, after a resize, is drawn stretched until the next one arrives — never refused (the view would blink).
        app.onFrame((imported, meta) => {
            const vf = imported.getVideoFrame();
            try {
                ctx.drawImage(vf, 0, 0, view.width, view.height);
            }
            finally {
                vf.close();
            }
            host.framesDrawn++;
            if (meta.facts) {
                try {
                    host.facts = JSON.parse(meta.facts);
                }
                catch { /* the previous facts stand */ }
            }
        });
        app.on("app:stats", (line) => { host.statsLine = line; });
        app.on("app:engine-error", (m) => console.error(`[engine] ${m}`));
        return host;
    }
    resize(w, h) {
        if (w === this.width && h === this.height)
            return;
        this.width = w;
        this.height = h;
        this.app.resize(w, h);
    }
    /** The web player's frame — not the editor's (it ticks: frame below); the desktop app runs no web player. */
    render() { this.once("render", "[app] render() asks the desktop app for nothing — the editor ticks (frame)"); return null; }
    /** THE EDITOR'S TICK (enginehost.ts): sent, never awaited — queued after every call sent before it; its answer comes with the frame
     *  it draws, so this answers the LAST drawn frame's facts (one frame late: the gizmo follows a moving object a frame behind). */
    frame(packet) { this.app.frame(packet); return this.facts; }
    /** The project's pack, read by the engine itself (the take's "pack" kind, engine_host_native.cpp) — no bytes cross the page. */
    async loadProjectPack(_reload) {
        const [a] = await this.take([{ kind: "pack", id: "", file: "assets.pack" }]);
        if (a?.none)
            return null;
        if (!a?.ok)
            throw new Error(a?.why ?? "the engine did not answer the pack take");
        return a.assets ?? 0;
    }
    takeFiles(takes) { return this.take(takes); }
    /** AN ASSET TILE (enginehost.ts; P2 step 6): the engine draws its isolated preview and READS IT BACK (engine_host_native.cpp
     *  engine_preview_rgba — this engine can; the browser's cannot) — its pixels, sRGB as the screen shows them, base64. */
    async previewPicture(scene, view, size) {
        const b64 = await this.own.engine_preview_rgba(scene, view.pos[0], view.pos[1], view.pos[2], view.rot[0], view.rot[1], view.rot[2], view.fov, size);
        if (!b64)
            return null; // nothing drew: keep the glyph
        const bin = atob(b64);
        if (bin.length !== size * size * 4) {
            this.once("preview-size", `[app] a tile came back ${bin.length} bytes, not ${size}×${size}×4 — not drawn`);
            return null;
        }
        const px = new Uint8ClampedArray(bin.length);
        for (let i = 0; i < bin.length; i++)
            px[i] = bin.charCodeAt(i);
        return new ImageData(px, size, size);
    }
    /** A JavaScript store provider (a web SDK's) does not apply here: the app's engine runs as the DESKTOP platform, whose providers are
     *  native (the project's "plugins".desktop, else the Test provider — the engine says which at boot). Said once, by name. */
    registerProvider(service, name) {
        this.once(`provider:${service}`, `[app] the ${service} provider '${name}' is a web (JavaScript) provider — the desktop app's engine uses the desktop platform's native providers`);
    }
    once(key, line) {
        if (this.said.has(key))
            return;
        this.said.add(key);
        console.warn(line);
    }
}
