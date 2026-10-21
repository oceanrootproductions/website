"use strict";
// decodeworker.ts — the browser's DECODE WORKER (2026-09-26). A CLASSIC Web Worker on purpose: no imports, no exports, so tsc
// emits it as a plain script and it loads the decoder module with importScripts. src/decodeclient.ts creates it; the page
// never runs this file itself.
//
// It hosts decode.js / decode.wasm — the engine's streaming decode core (engine/render/fe_decode.cpp, FE_DECODE_CORE_ONLY)
// plus the codecs, built by scripts/build_wasm.sh from the SAME sources the engine compiles — and answers two messages:
//   {init: <decode.js URL>}          → load the module, answer {ready, buildId} (the client checks the id against the
//                                      engine's: two modules built from different sources must never trade requests);
//   {id, req, data, outLen}          → decode: the request's bytes and its input (the pack ranges, back to back) copied into
//                                      the module's heap, fe_decode_run_c, the output posted back TRANSFERRED {id, ok, out}
//                                      with the decode's time and the heap's size (ms, heap — the client's gauges).
// Why a worker: the island in the web editor fell to 24 fps while the camera moved — every level decode ran inside the
// frame (engine/render/fe_decode.h has the measurements). Here a 200 ms texture transcode costs the page nothing.
(() => {
    const scope = self;
    let dec = null;
    scope.onmessage = (e) => {
        const d = e.data;
        if (d.init) {
            const url = d.init;
            try {
                scope.importScripts(url);
            }
            catch (err) {
                scope.postMessage({ ready: false, error: `could not load ${url}: ${String(err)}` });
                return;
            }
            const create = scope.createDecoder;
            if (!create) {
                scope.postMessage({ ready: false, error: `${url} defines no createDecoder` });
                return;
            }
            create({ locateFile: (p) => new URL(p, url).href }).then((m) => { dec = m; scope.postMessage({ ready: true, buildId: m._fe_decode_build_id() >>> 0 }); }, (err) => scope.postMessage({ ready: false, error: String(err) }));
            return;
        }
        if (!dec || d.id === undefined || !d.req || !d.data || d.outLen === undefined)
            return;
        const m = dec;
        let ok = 0, out = new ArrayBuffer(0), ms = 0;
        const rq = m._malloc(d.req.byteLength), ip = m._malloc(Math.max(1, d.data.byteLength)), op = m._malloc(Math.max(1, d.outLen));
        if (rq && ip && op) { // a heap that cannot hold them answers ok 0 like a failed decode — the engine decodes it inline instead
            m.HEAPU8.set(new Uint8Array(d.req), rq);
            m.HEAPU8.set(new Uint8Array(d.data), ip);
            const t0 = performance.now();
            ok = m._fe_decode_run_c(rq, d.req.byteLength, ip, d.data.byteLength, op, d.outLen);
            ms = performance.now() - t0;
            if (ok)
                out = m.HEAPU8.slice(op, op + d.outLen).buffer; // HEAPU8 read AFTER the call: the decode may have grown the heap
        }
        if (rq)
            m._free(rq);
        if (ip)
            m._free(ip);
        if (op)
            m._free(op);
        // ms = the decode alone; heap = this module's memory now (wasm memory never shrinks: it is the worker's high-water mark)
        scope.postMessage({ id: d.id, ok, out, ms, heap: m.HEAPU8.length }, [out]);
    };
})();
