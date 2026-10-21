// packstore.ts — the asset pack held in PIECES (2026-10-01). DOM-free: the editor, the web player and the node gates
// (tools/packstore_test.ts, tools/decodeclient_test.ts) share this one implementation.
//
// WHY: a browser will not hold one ArrayBuffer of 2 GiB or more, and the page held the whole pack in one. The Sunny
// Subsea lobby at full texture size is a 2.12 GiB pack (2,278,017,376 B); the editor fetched it with
// `response.arrayBuffer()` and Chrome answered "TypeError: Failed to fetch" after 1.75 s — a body it cannot make into ONE
// buffer is reported as a NETWORK failure, not as out-of-memory (measured; a trap for anyone searching for OOM). The
// editor then came up with no pack at all, and the project needed its textures capped at 2K to open. Read as a STREAM
// into pieces, the same page took the same pack in 1.78 s (≈ 1.2 GB/s, the speed of the failed single read).
//
// So the pack is a list of CHUNKS — each its own ArrayBuffer of `chunkBytes`, the last one shorter — and a read of
// [off, off + len) is stitched across chunk boundaries. The engine still reads SYNCHRONOUSLY (residency S1: the build has
// no ASYNCIFY and needs none — the bytes are already in this page); only the container changed.
//
// THE CHUNK SIZE, 16 MiB, is small ON PURPOSE: the sample project's pack (~62 MB) spans four chunks, so every editor and
// web gate reads across boundaries on every boot. A 256 MiB chunk would leave the stitching exercised by the one project
// that needs it and no gate at all. Nothing reads the pack zero-copy — the engine's EM_JS copies into its heap, the decode
// client copies into the bytes it hands a worker — so a small chunk costs one more `set` for a read that straddles.
//
// OFFSETS ARE PLAIN NUMBERS: a byte offset passes 2^31 (and 2^32), and `|`, `&`, `>>`, `<<` truncate to int32 — the
// 2026-09-30 big-import bug class ("offset 0 of -1043377300 bytes"). Only Math.floor and arithmetic touch an offset here;
// tools/packstore_test.ts pins packChunkAt past 2^31, 2^32 and 2^40.
//
// LIMITS (said, not hidden): the pack still lives whole in the page's memory (no streaming from disk — that is the desktop
// editor's job, Step B); a 2.12 GiB pack is 2.12 GiB of the tab's memory, in 136 pieces instead of one.
/** The pack's piece size — see THE CHUNK SIZE above before changing it. */
export const PACK_CHUNK_BYTES = 16 * 1024 * 1024;
/** [chunk index, offset inside that chunk] for a byte offset. Arithmetic only — never a bitwise operator (see OFFSETS). */
export function packChunkAt(off, chunkBytes) {
    const i = Math.floor(off / chunkBytes);
    return [i, off - i * chunkBytes];
}
export class PackStore {
    /** Every chunk but the last holds exactly `chunkBytes` (the read's index arithmetic depends on it); the last holds 1..chunkBytes. */
    constructor(chunks, chunkBytes) {
        if (!Number.isInteger(chunkBytes) || chunkBytes < 1)
            throw new Error(`PackStore: chunk size ${chunkBytes} is not a positive whole number`);
        let total = 0;
        chunks.forEach((c, i) => {
            const last = i === chunks.length - 1;
            if (last ? c.length < 1 || c.length > chunkBytes : c.length !== chunkBytes)
                throw new Error(`PackStore: chunk ${i} of ${chunks.length} holds ${c.length} B — every chunk but the last holds exactly ${chunkBytes} B, the last 1..${chunkBytes}`);
            total += c.length;
        });
        this.chunks = chunks;
        this.chunkBytes = chunkBytes;
        this.length = total;
    }
    /** A store over bytes already in one buffer (a small pack, a gate's fixture) — views, no copy. */
    static fromBytes(bytes, chunkBytes = PACK_CHUNK_BYTES) {
        const chunks = [];
        for (let at = 0; at < bytes.length; at += chunkBytes)
            chunks.push(bytes.subarray(at, Math.min(at + chunkBytes, bytes.length)));
        return new PackStore(chunks, chunkBytes);
    }
    get chunkCount() { return this.chunks.length; }
    read(off, len, dst, at) {
        if (!Number.isInteger(off) || !Number.isInteger(len) || !Number.isInteger(at) || off < 0 || len < 0 || at < 0
            || off + len > this.length || at + len > dst.length)
            return false;
        let [ci, co] = packChunkAt(off, this.chunkBytes);
        for (let left = len, to = at; left > 0; ci++, co = 0) {
            const c = this.chunks[ci], n = Math.min(left, c.length - co);
            dst.set(c.subarray(co, co + n), to);
            left -= n;
            to += n;
        }
        return true;
    }
}
/** Read a response body into a PackStore, piece by piece. `what` names the pack in errors.
 *  Refuses LOUDLY: an HTTP error status (before 2026-10-01 a 404 page's bytes reached the engine, which refused them as
 *  "not an Ocean pack" with the status lost), and a body shorter or longer than its Content-Length. Content-Length counts
 *  the bytes ON THE WIRE, so it is checked only for an unencoded body — a host that gzips the pack streams more than it says. */
export async function packStoreFromResponse(res, what, chunkBytes = PACK_CHUNK_BYTES) {
    if (!res.ok)
        throw new Error(`${what}: HTTP ${res.status}${res.statusText ? " " + res.statusText : ""}`);
    const enc = (res.headers.get("Content-Encoding") ?? "identity").trim().toLowerCase();
    const cl = res.headers.get("Content-Length");
    const expect = enc === "identity" && cl !== null && /^\d+$/.test(cl.trim()) ? Number(cl.trim()) : -1;
    const chunks = [];
    let cur = null, used = 0, total = 0;
    const reader = res.body?.getReader();
    if (reader)
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            for (let at = 0; at < value.length;) {
                if (!cur || used === cur.length) {
                    // A known length sizes the last chunk exactly (no trim copy); every earlier chunk is full (the store's invariant).
                    const size = expect >= 0 ? Math.min(chunkBytes, expect - total) : chunkBytes;
                    if (size <= 0) {
                        void reader.cancel();
                        throw new Error(`${what}: the server sent more than its Content-Length of ${expect} bytes`);
                    }
                    cur = new Uint8Array(size);
                    chunks.push(cur);
                    used = 0;
                }
                const n = Math.min(value.length - at, cur.length - used);
                cur.set(value.subarray(at, at + n), used);
                used += n;
                at += n;
                total += n;
            }
        }
    if (expect >= 0 && total !== expect)
        throw new Error(`${what}: the download stopped at ${total} of ${expect} bytes`);
    if (cur && used < cur.length)
        chunks[chunks.length - 1] = cur.slice(0, used); // an unknown length: the last chunk trimmed (≤ one chunk copied)
    return new PackStore(chunks, chunkBytes);
}
/** Fetch a pack into a PackStore — THE way the page loads one (main.ts boot, assetsapi.ts reload, play.ts). */
export async function fetchPackStore(url, init, chunkBytes = PACK_CHUNK_BYTES) {
    return packStoreFromResponse(await fetch(url, init), url, chunkBytes);
}
