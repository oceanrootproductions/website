// heap.ts — the ONE way to turn a wasm pointer into a typed-array index.
//
// The editor's wasm heap may grow past 2 GB (-sMAXIMUM_MEMORY=4GB; featurelab's island reached 3.75 GB on
// 2026-09-03). Emscripten hands such pointers to JS as plain positive numbers above 2^31, and JavaScript's
// SIGNED shift (`ptr >> 2`) converts to int32 first — every pointer past 2 GB became a NEGATIVE index and every
// read came back undefined: mesh bounds, world positions, projections, perf readings all turned into nulls, so
// the F framing sent the camera to NaN and the move gizmo drew nothing (found 2026-09-04; no gate had ever
// run the editor JS with a heap that large). The unsigned shift (`>>>`) is right for both a positive pointer
// and the signed form a raw i32 return would take. tools/heapindex_test.ts holds this, and lints the src for
// the signed spelling.
export function f32Index(ptr) { return ptr >>> 2; }
export function u16Index(ptr) { return ptr >>> 1; }
