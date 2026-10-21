// play.ts — the STANDALONE web player. "Build for Web" (server /build/web) drops this beside a baked game.json
// (scene + input bindings + physics + UI screens), the project's assets.pack, and the engine WASM — a
// self-contained folder you can upload anywhere (itch / Poki / your own host). It reuses the SAME engine the
// editor's Play mode runs; this is just that Play loop with no editor chrome: load the project, then
// input → play → render every frame, full-screen.
import { Engine } from "./engine.js";
import { attachMouseLook, attachOtherButtons, wheelNotches } from "./mouselook.js"; // 2026-10-01: first-person mouse look (pointer lock)
import { attachKeyLatch } from "./keylatch.js";
import { KEY_CODE_BITS } from "./inputkeys.gen.js"; // 2026-10-08: a tap shorter than a frame still reaches the game
import { chooseSave } from "./savepolicy.js"; // P6: which copy boots when a storage provider and the local mirror both answer
import { hostAllowed } from "./sitelock.js";
import { fetchPackStore } from "./packstore.js"; // the pack in pieces (a browser refuses one buffer of 2 GiB or more)
// PORTAL SDKs START WITH THE PAGE, NOT WITH THE ENGINE (2026-10-07). Every declared plugin's module is imported and its start()
// begun here, before the WebGPU device exists and while the pack downloads. Until now the SDK started inside install(), which
// ran after BOTH — so a browser without a GPU never started it: Playgama's archive analyzer (no GPU) saw "Couldn't start" and
// reported "Playgama Bridge never initialized in this archive" (2026-09-30), and on a 2 MB/s link the check-in waited 28 s for
// the 57 MB download (measured on the shipped archive; 0.3 s once started at page load). Playgama's own Unity template starts
// the Bridge the moment its script loads, then loads the engine — the same order.
// window.__oceanPlugins records each plugin's state ("starting" | "started" | "no start step" | "failed: …", and the page time
// in ms) — what a person debugging a live game reads, and what the playtest's no-GPU boot checks.
function startPlugins(mods) {
    const record = {};
    window.__oceanPlugins = record;
    const mark = (name, state) => { record[name] = { state, ms: Math.round(performance.now()) }; };
    return mods.map((mod) => {
        mark(mod.name, "starting");
        const module = import(/* @vite-ignore */ "../" + mod.module); // js/play.js → ../plugins/<name>/provider.js
        const started = module.then((m) => {
            if (!m.start) {
                mark(mod.name, "no start step");
                return undefined;
            }
            return Promise.resolve(m.start(mod.settings ?? {})).then((v) => { mark(mod.name, "started"); return v; });
        });
        // Handled here so a failure is not an "uncaught (in promise)" while the engine is still coming up; the install loop says it by name.
        started.catch((e) => mark(mod.name, `failed: ${String(e)}`));
        return { mod, module, started };
    });
}
const isField = (t) => {
    const el = t;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || !!el.isContentEditable);
};
// Load the engine + the project, wire input, and return a function that starts the render loop.
async function load() {
    // The manifest comes FIRST — it is small, and a game bound to a portal (game.sitelock, from the chosen plugins'
    // manifests) refuses to run anywhere else BEFORE the engine boots and before the pack downloads (CrazyGames
    // technical requirement, 2026-09-08). The refusal is the portal's message, not an error.
    const game = await fetch("game.json").then((r) => r.json());
    if (game.sitelock?.labels?.length && !hostAllowed(location.hostname, game.sitelock.labels)) {
        const locked = new Error(game.sitelock.message || `Available only on ${game.sitelock.labels[0]}`);
        locked.sitelock = true;
        throw locked;
    }
    const plugins = startPlugins(game.pluginModules ?? []); // FIRST: a portal's SDK must not wait for the GPU or the download (above)
    const packFetch = fetchPackStore("assets.pack", { cache: "reload" }); // in flight while the device comes up
    const engine = await Engine.create(); // creates the WebGPU device on #view (also arms miniaudio's audio unlock)
    engine.setGrid(false);
    engine.setColliders(false); // editor-only overlays — never in the shipped game
    window.addEventListener("keydown", (e) => {
        if (e.key === "`" || e.key === "~") {
            e.preventDefault();
            engine.consoleToggle();
        }
    });
    engine.loadAssets(await packFetch);
    // (the save service arms AFTER the plugins below: a storage provider's copy must be fetched before the store boots — P6)
    // plugins P1 (docs/plugins-plan.md): install the JavaScript providers the export declared BEFORE applyProject
    // selects them by name from the project's "plugins" block. A module that fails to load says so in the console
    // and the selection fails loudly in the engine log (the service stays on the built-in Test provider, whose
    // overlay is unmistakable) — never a silent no-ads build.
    for (const { mod, module, started } of plugins) {
        try {
            const m = await module; // imported at page load (startPlugins); a failed import throws here and is said below
            // install() runs once the page-load start() has SETTLED. A start that failed is said, and install() is still called: the
            // providers' install() asks for their start again, which retries a check-in that failed at page load (a network blip may
            // have passed) and fails loudly if it fails twice. A hung SDK must not hang the GAME — 10 s for what remains of start +
            // install, then the boot goes on with the Test provider (loud) rather than a blank page forever.
            const installed = started.then(() => undefined, (e) => console.warn(`[plugins] ${mod.name}: start() failed at page load (${String(e)}) — install() tries again`))
                .then(() => (m.install ? m.install(engine, mod.settings ?? {}) : undefined));
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("start() + install() took longer than 10 s")), 10000));
            const provided = (await Promise.race([installed, timeout])) ?? {};
            for (const svc of ["ads", "iap", "publisher", "storage"]) {
                if (!mod.provides.includes(svc))
                    continue;
                if (provided[svc])
                    engine.registerProvider(svc, mod.name, provided[svc]);
                else
                    console.error(`[plugins] ${mod.name}: declares ${svc} but install() returned no ${svc} provider`);
            }
        }
        catch (e) {
            console.error(`[plugins] ${mod.name}: failed to install (${String(e)}) — its services stay on the Test provider`);
        }
    }
    engine.applyProject(JSON.stringify(game)); // input + physics + rendering, applied by the ONE shared
    // runtime path every platform boots through (no per-setting
    // calls to forget — the class of bug that once shipped a
    // shadow-less export). ⚠ Until 2026-09-04 the decoder's
    // rendering block did not compile on the web (runtime.cpp
    // guarded it by OCEAN_USE_RHI; the web build defines
    // OCEAN_EDITOR_GPU), so this applied input + physics only and
    // every web export ran shadow-less, CPU-culled, LOD off. The
    // playtest runner's boot tooth holds it now.
    // ---- SAVES (P6, 2026-09-09): the project's storage provider, if it named one, is the truth; localStorage stays the mirror ----
    // The save tier reads its initial JSON synchronously at save_init (Module.oceanSaveLoad) and hands every flush to a sink
    // (Module.oceanSaveSink). A cloud provider answers asynchronously, so the player awaits it HERE, the way it awaited
    // the pack, and only then arms the store. Policy (src/savepolicy.ts): the cloud copy wins once it exists; a local-only
    // save climbs to the cloud once, and only when the cloud actually answered; a copy that does not parse is absent.
    // Every flush lands in BOTH places, so an offline boot still has the last state. Playgama's rule ("never localStorage
    // directly — otherwise the data won't reach cloud saves") is met through the provider, not by dropping the mirror.
    const saveKey = "ocean.save." + (game.name ?? "game"); // per game, so two games on one site never share progress
    engine.module.oceanSaveKey = saveKey;
    const localRead = () => { try {
        return localStorage.getItem(saveKey);
    }
    catch {
        return null;
    } };
    const localWrite = (json) => { try {
        localStorage.setItem(saveKey, json);
    }
    catch (e) {
        console.error("[save] localStorage write failed:", e);
    } };
    const storageName = engine.pluginsSelected("storage");
    const storage = storageName !== "local" && storageName !== "null"
        ? (engine.module.oceanPlugins?.storage ?? null) : null;
    let initial = storageName === "null" ? null : localRead();
    if (storage) {
        let cloud = null, reachable = false;
        try {
            cloud = await Promise.race([storage.load(), new Promise((_, reject) => setTimeout(() => reject(new Error("storage.load() took longer than 8 s")), 8000))]);
            reachable = true;
        }
        catch (e) {
            console.error(`[plugins] storage (${storageName}): load failed — booting from the local mirror`, e);
        }
        const pick = chooseSave(cloud, initial, reachable);
        initial = pick.json;
        if (pick.migrate && pick.json) {
            try {
                storage.store(pick.json);
            }
            catch (e) {
                console.error("[plugins] storage: migrating the local save up failed", e);
            }
        }
        console.log(`[save] storage=${storageName}: booting from the ${pick.source} copy${pick.migrate ? " (climbed to the cloud)" : ""}`);
    }
    else if (storageName !== "null" && storageName !== "local") {
        console.error(`[plugins] storage: '${storageName}' was selected but installed no storage provider — saves stay local`);
    }
    const sm = engine.module;
    sm.oceanSaveLoad = () => initial;
    sm.oceanSaveSink = storageName === "null" ? () => { }
        : (json) => { localWrite(json); if (storage) {
            try {
                storage.store(json);
            }
            catch (e) {
                console.error("[plugins] storage: store failed", e);
            }
        } };
    engine.saveInit();
    // The playtest's seedSave writes through the SAME sink (a provider + the mirror), so a reload boots from what it seeded.
    engine.saveStore = (json) => sm.oceanSaveSink?.(json);
    engine.publisherLoading(true); // plugins P1: AFTER applyProject selected the providers — seen 2026-09-06: called earlier, the
    // Test provider heard loadingStart and CrazyGames never did (CrazyGames wants it after SDK.init)
    // U2 (docs/ui-pack-unification-plan.md): the pack the line above just loaded carries the WHOLE ui/
    // (theme, images, sprite sheets+sidecars, screens) as project files — register it all through the same
    // feed native boots with. This is where the invisible-menu class dies: image decorators finally have
    // their bytes on web. A 0 return = a pre-unification pack → the old game.json shim below still works.
    const packScreens = engine.uiRegisterPack();
    engine.shadersRegisterPack(); // M2b-2: user shader assets ride the pack (loud per miss in the console)
    if (!packScreens) {
        if (game.ui?.theme)
            engine.uiRegisterFile("theme.rcss", game.ui.theme);
        for (const [name, rml] of Object.entries(game.ui?.screens ?? {}))
            engine.uiRegisterScreen(name, rml);
    }
    engine.loadScene(JSON.stringify(game.scene));
    engine.makeResident(); // T2d: warm everything NOW (meshes, texture tuples, prefabs, UI screens) —
    // the same door native boots call, so the web player stops paying lazy
    // uploads mid-game (fe.lazy.* stays the tripwire for anything missed)
    if (game.ui?.start)
        engine.uiOpen(game.ui.start); // ui.json "start" screen (the game's scripts open their own too)
    // --- keyboard → the engine's virtual gamepad + action layer (same capture the editor's Play uses) ---
    // (src/keylatch.ts: held now OR pressed since the last frame — a quick tap is never lost; blur forgets everything)
    const STOP = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]); // keep these from scrolling the page
    const keys = attachKeyLatch(window, KEY_CODE_BITS, (e) => !isField(e.target), (e) => { if (STOP.has(e.code))
        e.preventDefault(); });
    // --- pointer → the in-game HUD (menu buttons, e.g. Knockout's START / RESTART) ---
    const cv = document.getElementById("view");
    const at = (e) => {
        const r = cv.getBoundingClientRect();
        const dpr = r.width ? cv.width / r.width : 1; // CSS px → backing-store px (the engine's UI space)
        return [Math.round((e.clientX - r.left) * dpr), Math.round((e.clientY - r.top) * dpr)];
    };
    // BOTH doors, like the editor viewport and the touch path below: engine.uiPointer* drives the HUD,
    // engine.pointer* drives GAMEPLAY (input.pointer* / camera.pointerRay — click-to-place). Wiring only
    // the UI door is the bug class where menus work but arena clicks silently vanish on desktop web.
    // MOUSE LOOK: while the game asks for it (a first-person walker), a click captures the mouse (src/mouselook.ts — the
    // editor's Play shares it); captured, the pointer doors stay quiet (the cursor is hidden, its position means nothing) and a
    // click is the CROSSHAIR click, pressed by mouselook at the view's centre through the gameplay door only.
    // The ordinary click (both doors, position first) — the mousedown below, and a click whose capture the browser REFUSED
    // (mouselook hands it back so it is never swallowed; stillDown false = its mouseup already passed — release at once).
    const pointerDown = (x, y) => {
        engine.uiPointerMove(x, y);
        engine.pointerMove(x, y); // position first, then press — a click must resolve at the pixel it landed on
        engine.uiPointerButton(true);
        engine.pointerButton(true);
    };
    const pointerUp = () => { engine.uiPointerButton(false); engine.pointerButton(false); };
    const look = attachMouseLook(cv, () => engine.wantsMouseLook(), () => true, (x, y) => { engine.pointerMove(x, y); engine.pointerButton(true); }, (e, stillDown) => { const [x, y] = at(e); pointerDown(x, y); if (!stillDown)
        pointerUp(); });
    cv.addEventListener("mousemove", (e) => { if (look.captured())
        return; const [x, y] = at(e); engine.uiPointerMove(x, y); engine.pointerMove(x, y); });
    cv.addEventListener("mousedown", (e) => { if (e.button === 0 && !look.captured()) {
        const [x, y] = at(e);
        pointerDown(x, y);
    } });
    addEventListener("mouseup", (e) => { if (e.button === 0)
        pointerUp(); });
    // the right and middle buttons → the game (input.pointerPressed(1) / (2)) — mouselook.ts attachOtherButtons
    attachOtherButtons(cv, () => true, () => look.captured(), at, (b, x, y) => { engine.pointerMove(x, y); engine.pointerButton(true, b); }, (b) => engine.pointerButton(false, b));
    // WHEEL -> scroll the UI under the cursor (a collection grid, a long settings list). Normalised here
    // rather than in the engine, because `deltaY`'s unit is deltaMode-dependent and only the browser knows
    // which: 0 = PIXELS (the common case; ~100 per notch on a wheel, small smooth values on a trackpad),
    // 1 = LINES, 2 = PAGES. passive:false + preventDefault so a scrollable game panel does not also scroll
    // the host page — on a portal the game sits in an iframe and the page jumping is the visible bug.
    cv.addEventListener("wheel", (e) => {
        const [x, y] = at(e);
        const notches = wheelNotches(e);
        engine.uiWheel(x, y, notches);
        engine.wheel(notches); // …and the game (input.wheel()) — the HUD and gameplay doors both, like the buttons
        e.preventDefault();
    }, { passive: false });
    // --- touch → the ENGINE's on-screen controls. Fingers forward to ui_touch (framebuffer px): elements
    // tagged data-stick / data-button in the game's OPEN screens become held controls (stick = axis, button =
    // held action), and any other tap clicks menus. Which controls exist — and how they look — is the game's
    // own UI markup (a screen like controls.rml), opened below only on touch devices. No controls screen =
    // no overlay: touch support is opt-in per game.
    const touchAt = (t) => {
        const r = cv.getBoundingClientRect();
        const dpr = r.width ? cv.width / r.width : 1;
        return [Math.round((t.clientX - r.left) * dpr), Math.round((t.clientY - r.top) * dpr)];
    };
    const forward = (phase) => (e) => {
        e.preventDefault(); // no scroll / zoom / synthetic mouse events
        for (const t of Array.from(e.changedTouches)) {
            const [x, y] = touchAt(t);
            const id = t.identifier & 0x7fffffff;
            engine.uiTouch(id, x, y, phase); // markup-bound touch controls (sticks / buttons)
            engine.pointerTouch(id, x, y, phase); // ...and the gameplay pointer, so a tap == a click (tap-to-place)
        }
    };
    cv.addEventListener("touchstart", forward(0), { passive: false });
    cv.addEventListener("touchmove", forward(1), { passive: false });
    cv.addEventListener("touchend", forward(2));
    cv.addEventListener("touchcancel", forward(2));
    // "If this game is running on mobile, show the mobile controls": open the project's designated touch
    // screen (ui.json "touch") only when a touchscreen is present. Desktop/laptop: never opened, zero cost.
    const touchDevice = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    if (touchDevice && game.ui?.touch)
        engine.uiOpen(game.ui.touch);
    window.__ocean = engine; // debug/test hook (harmless in production)
    // --- the game loop (the editor's Play path, always-on here) ---
    let last = performance.now();
    const frame = (now) => {
        // The frame pacer (engine app_frame_due): a capped game (app.setTargetFps from a script) skips animation frames
        // until its slot; `last` is untouched on a skip, so dt spans the skipped ticks (real elapsed time).
        if (!engine.frameDue(now, engine.targetFps())) {
            requestAnimationFrame(frame);
            return;
        }
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now; // clamp big gaps (e.g. a backgrounded tab)
        // The player OWNS the backing-store size: track the CSS box x DPR every frame so device rotation and
        // host-iframe resizes (game portals) re-render sharp instead of stretching a stale buffer.
        const dpr = window.devicePixelRatio || 1;
        const bw = Math.max(1, Math.round(cv.clientWidth * dpr)), bh = Math.max(1, Math.round(cv.clientHeight * dpr));
        if (cv.width !== bw || cv.height !== bh) {
            cv.width = bw;
            cv.height = bh;
        }
        engine.resize();
        // NO engine.animate() here: engine.play → game_update ticks the clip clocks itself, on the FIXED step,
        // exactly as the device does. Calling both would advance every animation TWICE per frame. animate()
        // survives for the EDITOR's edit mode, where motion previews while no game is running (2026-09-17).
        const [mdx, mdy] = look.take(); // the captured mouse's movement this frame (0 when not captured)
        engine.input(keys.snapshot(), dt, mdx, mdy);
        engine.play(dt);
        if (look.captured() && !engine.wantsMouseLook())
            look.release(); // the game stopped asking (no walker now)
        engine.render();
        requestAnimationFrame(frame);
    };
    engine.publisherLoading(false); // ...and its end: the game is ready to play
    return () => requestAnimationFrame(frame);
}
// No "click to play" gate (like CrazyGames/Poki): show a loading indicator, then AUTO-START once ready. Browser
// audio stays muted until the first user gesture, which miniaudio's own click/touch listeners catch — so on a portal
// (iframe with autoplay granted) sound is immediate, and on a bare link it kicks in on the first interaction (the
// in-game START button). The loading overlay just covers the WASM/asset fetch, then gets out of the way.
const overlay = document.getElementById("start");
load().then((start) => {
    overlay.remove();
    start();
}).catch((e) => {
    overlay.replaceChildren();
    const locked = !!e?.sitelock; // the sitelock's refusal is the portal's own message, verbatim
    overlay.textContent = locked ? (e.message) : "Couldn't start: " + (e?.message ?? String(e));
});
