// engineexports.ts — the ONE door every ccall goes through, so a wasm that predates the page's TypeScript fails
// with a sentence that names the export and the fix.
//
// The failure that motivates it (2026-09-23 night): a lane compiled the editor's TypeScript with a new
// ccall("engine_set_volume_gizmos") and did not rebuild platforms/web/engine.{js,wasm}. The owner opened the editor
// and the splash said "Ocean Engine could not start — func is not a function": Emscripten's ccall resolves
// Module["_" + name] and asserts on undefined with a message that names nothing. Every gate stayed green (the
// playtest boots the exported GAME, the editor tests boot the page without a GPU and stop before the first ccall).
//
// This module is DOM-free on purpose: tools/engineexports_test.ts imports it under tsconfig.node.json (no DOM lib)
// and proves the thrown sentence against a Module stub, since platforms/web/js must not be emitted by a gate.
//
// What it does NOT do: it cannot tell a genuinely optional export (engine_ui_load in a build without the UI
// module) from a stale wasm — the wrappers that tolerate a missing export keep their try/catch and the message
// simply becomes readable in the console. The static agreement of source calls, engine_api.cpp declarations and
// engine.js exports is tools/engineexports_test.ts's job; this door is the runtime's last word when that gate
// was not run.
function heapOf(m) {
    const h = m;
    return typeof h._malloc === "function" && typeof h._free === "function" && h.HEAPU8 instanceof Uint8Array ? h : null;
}
const utf8 = new TextEncoder();
/** The sentence the boot splash shows — one string, so the gate and the page cannot drift on it. */
export function missingExportMessage(name) {
    return `engine.wasm is older than the page's scripts: it lacks ${name} — rebuild it with scripts/build_wasm.sh`;
}
/** True when the Module carries export `name` (Emscripten's getCFunc: Module["_" + name]). */
export function hasExport(m, name) {
    return typeof m["_" + name] === "function";
}
/** Replace the Module's ccall with one that checks the export FIRST. Installed once, at createEngine time, before
 *  the first ccall; raw callers (editor_shot's --js `eng.m.ccall(...)`) go through the same door because it is
 *  the Module's own method that changes, not the Engine wrapper's. Returns the same object for chaining. */
export function guardExports(m) {
    const raw = m.ccall.bind(m);
    m.ccall = (name, ret, argTypes, args, opts) => {
        if (!hasExport(m, name))
            throw new Error(missingExportMessage(name));
        const h = heapOf(m);
        if (!h || !argTypes.includes("string"))
            return raw(name, ret, argTypes, args, opts);
        const types = argTypes.slice(), vals = args.slice(), held = [];
        const release = () => { for (const p of held)
            h._free(p); held.length = 0; };
        try {
            for (let i = 0; i < types.length; i++) {
                if (types[i] !== "string")
                    continue;
                types[i] = "number";
                const v = vals[i];
                if (v === null || v === undefined || v === 0) {
                    vals[i] = 0;
                    continue;
                } // Emscripten's null string
                const bytes = utf8.encode(String(v));
                const p = h._malloc(bytes.length + 1);
                if (!p)
                    throw new Error(`${name}: out of memory copying a ${bytes.length}-byte string argument into the engine`);
                held.push(p);
                const heap = m.HEAPU8; // read AFTER the malloc: a memory growth replaces the view
                heap.set(bytes, p);
                heap[p + bytes.length] = 0;
                vals[i] = p;
            }
            const r = raw(name, ret, types, vals, opts);
            if (r !== null && typeof r === "object" && typeof r.then === "function") { // an unwinding call
                const kept = held.splice(0);
                return r.then((x) => { for (const p of kept)
                    h._free(p); return x; }, (e) => { for (const p of kept)
                    h._free(p); throw e; });
            }
            return r;
        }
        finally {
            release();
        }
    };
    return m;
}
