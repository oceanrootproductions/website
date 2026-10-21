/** Input bytes one lane may hold in flight. A worker decodes one ticket at a time, so a deeper queue only holds memory
 *  (every queued input is a copy of pack bytes) and work the camera may no longer want; when every lane is past it, post()
 *  answers BUSY and the engine asks again next frame. A lane's first ticket always goes, however large. */
export const DECODE_WINDOW_BYTES = 64 * 1024 * 1024;
/** A ticket whose input + output reach this runs on lane 0 only (see SEVERAL WORKERS above). On the island 2 of 1,297
 *  tickets did (a 67 MB → 116 MB mesh level); the 32–64 MB texture chains stay on every lane. */
export const DECODE_BIG_BYTES = 128 * 1024 * 1024;
/** Memory plan M3e e3b (docs/memory-budget-plan.md §3.7 — the page's memory planned from what it WILL need): what a lane's heap
 *  holds after its first tickets (16 MB at start; 28 MB measured on the web game once it ran a few mesh levels), and how much a
 *  ticket grows it past that — its input + output + the transcoder's scratch and the heap's growth steps: lane 0 reached 106 MB
 *  for the booster sheet's 1.5 MB in + 57.6 MB out (132 %; planned at 150 %). The engine plans the page's helpers as
 *  laneCount × LANE_BASE_MB + (the largest ticket) × LANE_TICKET_GROWTH_PCT on lane 0 — which is why an IN-MEMORY ticket (a UI
 *  big picture: the largest a game makes, one at a time) runs on lane 0 only (post): on any lane, every lane grows to hold it. */
export const LANE_BASE_MB = 28;
export const LANE_TICKET_GROWTH_PCT = 150;
/** How many lanes. Cores: those left after the page's own thread and the browser's GPU/compositor work. Memory: every lane
 *  costs a heap (on the island 96–148 MB for lanes 1–2, 345 MB for lane 0), so a device that reports under 4 GB gets one
 *  lane, under 8 GB two; a browser that does not report memory (navigator.deviceMemory is Chromium-only, and caps at 8)
 *  gets two. At most 3: the island's zoom cycle settled in 2.9 s with 3 lanes, 6.7 s with 1. */
export function decodeLaneCount(cores, memGB) {
    const byCores = (cores || 4) - 2;
    const byMem = memGB === undefined || !(memGB > 0) ? 2 : memGB < 4 ? 1 : memGB < 8 ? 2 : 3;
    return Math.max(1, Math.min(3, byCores, byMem));
}
export class DecodeClient {
    /** `laneCount` and `makeWorker` exist for tools/decodeclient_test.ts (a fixed lane count, a fake worker). Plain fields, not
     *  parameter properties: node's type stripping (the tools run this file directly) refuses those. */
    constructor(m, workerUrl, decoderUrl, engineBuildId, laneCount = decodeLaneCount(globalThis.navigator?.hardwareConcurrency, globalThis.navigator?.deviceMemory), makeWorker = (url) => new Worker(url)) {
        this.posted = 0;
        this.landed = 0;
        this.dropped = 0;
        this.busy = 0;
        this.decodeMs = 0; // time the lanes spent decoding, summed (utilisation = this over wall time × lanes)
        this.msByKind = [0, 0, 0, 0]; // … split by request kind (fe_decode.h: 1 mesh, 2 texture, 3 volume block — B3 W3)
        this.maxJob = { inBytes: 0, outBytes: 0 }; // the largest single ticket seen (a lane's heap must hold its input + output)
        this.started = false;
        this.starting = false; // a lane is being started (one at a time)
        this.lanesStarted = 0;
        this.lanes = [];
        this.seq = 0;
        this.enabled = false;
        this.m = m;
        this.workerUrl = workerUrl;
        this.decoderUrl = decoderUrl;
        this.engineBuildId = engineBuildId;
        this.laneCount = laneCount;
        this.makeWorker = makeWorker;
    }
    /** Any lane is taking tickets. */
    get ready() { return this.lanes.some((l) => l.ready); }
    /** Lanes taking tickets now. */
    get lanesReady() { return this.lanes.filter((l) => l.ready).length; }
    /** Tickets posted and not yet answered (the gates read it: 0 once the streaming settles). */
    get pending() { return this.lanes.reduce((a, l) => a + l.jobs.size, 0); }
    /** The largest lane heap (wasm memory never shrinks: each lane's high-water mark) and all of them together. */
    get heapMax() { return this.lanes.reduce((a, l) => Math.max(a, l.heap), 0); }
    get heapTotal() { return this.lanes.reduce((a, l) => a + l.heap, 0); }
    /** The engine has streaming work: start lane 0 (once). The engine switches to the lanes when it answers. */
    wake() {
        if (this.started)
            return;
        this.started = true;
        if (!this.engineBuildId) {
            console.warn("[decode] this engine.wasm has no decode build id (built outside scripts/build_wasm.sh) — streaming decodes stay INSIDE the frame (slower while the camera moves)");
            return;
        }
        this.grow();
    }
    /** Start the next lane, if the count allows and none is starting. Lane 0's failure is loud (everything stays inline); a
     *  later lane's failure only says so — the lanes already up carry on, and no further lane is tried. */
    grow() {
        if (this.starting || this.lanesStarted >= this.laneCount)
            return;
        const id = this.lanesStarted++;
        this.starting = true;
        void this.startLane(id).then((why) => {
            this.starting = false;
            if (!why) {
                this.enable();
                return;
            }
            this.lanesStarted = this.laneCount; // never retried: a worker that failed once fails the same way again
            if (id === 0)
                console.warn(`[decode] the decode worker did not start: ${why} — streaming decodes stay INSIDE the frame (slower while the camera moves)`);
            else
                console.warn(`[decode] decode worker ${id} did not start: ${why} — the ${this.lanesReady} already up carry on`);
        });
    }
    enable() {
        if (this.enabled)
            return;
        this.enabled = true;
        this.m.ccall("engine_decode_enable", null, ["number"], [1]);
    }
    /** Start one lane. Resolves "" once its decoder answered with the engine's build id, else the reason it did not. */
    startLane(id) {
        return new Promise((resolve) => {
            let w;
            try {
                w = this.makeWorker(this.workerUrl);
            }
            catch (e) {
                resolve(`the worker could not be created (${String(e)})`);
                return;
            }
            const lane = { id, w, ready: false, jobs: new Map(), inflight: 0, heap: 0 };
            let settled = false;
            const fail = (why) => {
                if (settled)
                    return;
                settled = true;
                w.terminate();
                resolve(why);
            };
            const timer = setTimeout(() => fail("no answer in 20 s"), 20000);
            w.onerror = (e) => { clearTimeout(timer); fail(e.message || "the worker script failed"); };
            w.onmessage = (e) => {
                const d = e.data;
                clearTimeout(timer);
                if (!d.ready) {
                    fail(d.error ?? "the decoder module failed");
                    return;
                }
                if (d.buildId !== this.engineBuildId >>> 0) {
                    fail(`decode.wasm (build ${(d.buildId ?? 0).toString(16)}) and engine.wasm (build ${(this.engineBuildId >>> 0).toString(16)}) were built from different sources; rebuild with scripts/build_wasm.sh`);
                    return;
                }
                settled = true;
                w.onmessage = (ev) => this.onResult(lane, ev.data);
                w.onerror = (ev) => this.lost(lane, ev.message || "the worker failed");
                lane.ready = true;
                this.lanes.push(lane);
                this.lanes.sort((a, b) => a.id - b.id);
                resolve("");
            };
            w.postMessage({ init: this.decoderUrl });
        });
    }
    /** The engine's EM_JS calls this. 1 = posted; 0 = BUSY (the engine asks again next frame); -1 = this ticket can never
     *  go remote (no lane, no pack, a range past the pack) — the engine decodes it inline at once.
     *  srcPtr/srcLen: an IN-MEMORY ticket (engine/render/fe_decode.h — the UI's big pictures, whose bytes live in the engine's
     *  heap and have no pack range): the input is copied out of the heap and the ranges only split it; no pack is needed. */
    post(ticket, gen, reqPtr, reqLen, rangesPtr, nranges, outLen, srcPtr = 0, srcLen = 0) {
        const pack = this.m.oceanPack;
        const live = this.lanes.filter((l) => l.ready);
        if (!live.length || (!pack && !srcLen))
            return -1;
        const heap = this.m.HEAPU8;
        // fe_decode_range = { u64 off, u32 len, u32 pad } — 16 bytes (a static_assert in engine/render/fe_decode.cpp holds it)
        const dv = new DataView(heap.buffer, heap.byteOffset + rangesPtr, nranges * 16);
        const offs = [], lens = [];
        let total = 0;
        for (let i = 0; i < nranges; i++) {
            const off = dv.getUint32(i * 16, true) + dv.getUint32(i * 16 + 4, true) * 4294967296, len = dv.getUint32(i * 16 + 8, true);
            if (!srcLen && pack && off + len > pack.length)
                return -1; // a range past this pack: never read, decoded inline (where it fails loudly)
            offs.push(off);
            lens.push(len);
            total += len;
        }
        if (srcLen && total !== srcLen)
            return -1; // the ranges must tile the bytes exactly — inline, where fe_decode_run refuses it loudly
        if (!live.some((l) => l.inflight === 0))
            this.grow(); // every live lane is working: one more (up to the count)
        const fits = (l) => l.inflight === 0 || l.inflight + total <= DECODE_WINDOW_BYTES;
        let lane = null;
        // A giant, or an in-memory ticket (a UI big picture — the largest a game makes; the memory plan reserves it on lane 0 only):
        // the first live lane only. On the emptiest lane the booster sheets grew EVERY lane to ~106 MB over a session.
        if (total + outLen >= DECODE_BIG_BYTES || srcLen) {
            if (fits(live[0]))
                lane = live[0];
        }
        else
            for (const l of live)
                if (fits(l) && (!lane || l.inflight < lane.inflight))
                    lane = l; // the emptiest lane
        if (!lane) {
            this.busy++;
            return 0;
        }
        const req = heap.slice(reqPtr, reqPtr + reqLen);
        // An in-memory ticket: one copy out of the heap (the worker gets it transferred). A pack ticket: its ranges, back to back.
        const data = srcLen ? heap.slice(srcPtr, srcPtr + srcLen) : new Uint8Array(total);
        if (!srcLen && pack)
            for (let i = 0, at = 0; i < nranges; i++) {
                if (!pack.read(offs[i], lens[i], data, at))
                    return -1;
                at += lens[i];
            } // stitched across the pack's pieces
        const id = ++this.seq;
        const kind = new DataView(req.buffer).getUint32(0, true); // fe_decode_req.kind — the first field
        lane.jobs.set(id, { ticket, gen, outLen, inBytes: total, kind });
        lane.inflight += total;
        if (total + outLen > this.maxJob.inBytes + this.maxJob.outBytes)
            this.maxJob = { inBytes: total, outBytes: outLen };
        lane.w.postMessage({ id, req: req.buffer, data: data.buffer, outLen }, [req.buffer, data.buffer]);
        this.posted++;
        return 1;
    }
    onResult(lane, r) {
        const j = lane.jobs.get(r.id);
        if (!j)
            return;
        lane.jobs.delete(r.id);
        lane.inflight -= j.inBytes;
        this.decodeMs += r.ms ?? 0;
        if (j.kind >= 0 && j.kind < this.msByKind.length)
            this.msByKind[j.kind] += r.ms ?? 0;
        if ((r.heap ?? 0) > lane.heap)
            lane.heap = r.heap ?? 0;
        const ok = r.ok && r.out.byteLength === j.outLen;
        const dest = ok ? (this.m.ccall("engine_decode_dest", "number", ["number", "number", "number"], [j.ticket, j.gen, r.out.byteLength]) >>> 0) : 0;
        if (dest) {
            this.m.HEAPU8.set(new Uint8Array(r.out), dest);
            this.landed++;
        } // HEAPU8 read AFTER the call: never a stale view of a grown heap
        else
            this.dropped++;
        // ok 0 with a live ticket = the engine decodes it inline now; an abandoned ticket's gen no longer matches and is ignored
        this.m.ccall("engine_decode_done", null, ["number", "number", "number"], [j.ticket, j.gen, dest ? 1 : 0]);
    }
    /** A lane died after it answered: it takes no new ticket, and each of its tickets in flight is handed back empty — the
     *  engine decodes it inline. When no lane is left, the engine goes back to inline. */
    lost(lane, why) {
        if (!lane.ready)
            return;
        lane.ready = false;
        const jobs = [...lane.jobs.values()];
        lane.jobs.clear();
        lane.inflight = 0;
        lane.w.terminate();
        this.lanes = this.lanes.filter((l) => l !== lane);
        const last = !this.ready;
        console.error(`[decode] decode worker ${lane.id} failed (${why}) — ${jobs.length} decode(s) in flight are decoded inline` +
            (last ? ", and with no worker left streaming decodes go back INSIDE the frame" : ""));
        if (last) {
            this.m.ccall("engine_decode_enable", null, ["number"], [0]);
            this.enabled = false;
        }
        for (const j of jobs)
            this.m.ccall("engine_decode_done", null, ["number", "number", "number"], [j.ticket, j.gen, 0]);
    }
}
