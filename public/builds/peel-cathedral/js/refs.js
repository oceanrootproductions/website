// Asset references (docs/asset-identity-plan.md, decision 3) — the PURE half of the registry
// rules, browser-safe (no node imports): a reference is either a bare id ("cube",
// "room__Floor") or "<id>#<display name>". Resolvers trust the id half; the name after '#'
// is a human hint that keeps scene diffs readable and doubles as a fallback. The node-side
// registry module (platforms/web/registry.ts) re-exports these so there is ONE rule.
export function refId(ref) {
    const h = ref.indexOf("#");
    return h < 0 ? ref : ref.slice(0, h);
}
export function makeRef(id, name) {
    return id === name ? id : `${id}#${name}`; // unrenamed assets stay bare (clean diffs)
}
export function refName(ref) {
    const h = ref.indexOf("#"); // else the whole ref (bare names read as
    return h < 0 ? ref : ref.slice(h + 1); // themselves; bare ids show their hex)
}
// The ONE folder-name rule for the asset browser's virtual tree. Lives here (browser-safe, no node
// imports) so the PANEL and the SERVER validate identically — they used to carry separate copies of
// an A-Za-z0-9 regex, which both rejected perfectly good names ("Cenário", "Characters & Props") and
// could drift apart so the panel accepted what the server refused.
// These labels never touch the filesystem: the on-disk assets/ tree stays flat and the folder is a
// display path on the record. So the invariant is only: non-empty, not padded, no separator, no
// control characters — validate that, not an alphabet (the /ui/img filename lesson).
export function validFolderSegment(seg) {
    if (seg === "." || seg === "..")
        return false; // never a real label, and a traversal shape if a
    // future consumer ever joins one onto a real path
    return seg.length > 0 && seg.trim() === seg && !seg.includes("/") && !/[\u0000-\u001f]/.test(seg);
}
// ---- WHICH FOLDER A RECORD IS BORN INTO — declared once, used by every mint site --------------------
// The asset browser's folder tree is a DISPLAY layer: a record carries a `path` label and the on-disk
// assets/ tree stays flat, so this is pure metadata. It lives beside validFolderSegment for the same
// reason that rule does — the SERVER (shared.ts addProjectAsset, registry.ts hoistSceneMaterials) and
// the TOOL (tools/assetfolders.ts) must answer identically or records drift apart by who made them.
//
// ⚠ THE FAILURE THAT MOTIVATED IT: filing used to happen ONLY in tools/assetfolders.ts, a manual pass
// nothing called. Records were born unfiled and sat at the root until a human remembered the command.
// assetfolders_test's "the sample project has no unfiled assets" tooth went red twice in one session
// (2026-08-29/30) — once for a four-level import, once for three scene materials the scene-save hoist
// minted. Detection was never the problem; the gap between minting and filing was. Now a record is
// born filed and the manual pass is only a sweeper for history.
//
// Kept SMALL on purpose — a folder per kind FAMILY, not per kind. A kind missing here is left at the
// root rather than invented a home for, so a new kind gets a deliberate decision, loudly, instead of
// a silent default.
export const FOLDER_OF = {
    model: "3DModels", mesh: "3DModels", rig: "3DModels", xclip: "3DModels",
    skeleton: "3DModels", // R1d: a rig belongs beside the characters that bind to it
    animclip: "Animations", // R1d: one clip per asset — a character's clips are a LIST,
    // and a hundred of them in 3DModels would bury the models
    prefab: "Prefabs",
    texture: "Textures", hdr: "Textures",
    material: "Materials",
    uiimage: "UI", sprite: "UI", ui: "UI",
    audio: "Audio",
    script: "Scripts",
    shader: "Shaders",
    postprofile: "Post", // post P4: the project's looks (a default + the scenes' own)
    volume: "Volumes", // B3: imported VDBs (clouds, smoke, fire)
    splat: "Splats", // Plankton P3b: Gaussian-splat captures (props and captured spaces)
};
/** A record the browser nests INSIDE another tile has no folder of its own — that is a model's part
 *  MESHES only. A part's TEXTURE renders as its own tile and is filed like anything else. */
export function nestsInOwnerTile(rec) {
    return !!rec.ownerModel && (rec.kind ?? rec.type) === "mesh";
}
/** The home this record belongs in, or null to leave it at the root (no kind, nests in an owner
 *  tile, or an unmapped kind). The sweeper tool plans from it; mint sites go through fileRecord. */
export function folderFor(rec) {
    if (nestsInOwnerTile(rec))
        return null;
    const kind = (rec.kind ?? rec.type);
    return (kind && FOLDER_OF[kind]) || null;
}
/** Stamp a NEW registry record with its folder home, unless it already has one. THE call every mint
 *  site makes — there are three (registry.ts syncFileKind + hoistSceneMaterials, shared.ts
 *  addProjectAsset) and a fourth is the way this bug comes back, so the "unless already filed" rule
 *  lives here once rather than as a two-line idiom copied per site. Returns the same object. */
export function fileRecord(rec) {
    if (rec.path === undefined) {
        const home = folderFor(rec);
        if (home)
            rec.path = home;
    }
    return rec;
}
export const SLOT_CLASS = {
    texture: "color", // base colour — a picture
    emissiveMap: "color", // emission is a colour too
    wearMap: "color", // the wear layer's albedo — also a picture
    mrMap: "data", // metallic-roughness — measurements
    aoMap: "data", // baked occlusion — a measurement
    normalMap: "data", // tangent-space vectors, not a colour
    maskMap: "data", // M1: the packed mask (AO in R, wear in G)
    wearNormalMap: "data",
    wearMrMap: "data",
    tintMask: "data", // M2: R/G/B SELECT zones — a selector, never a picture
};
/** Does this material slot need a DATA-classed (linear) texture? Unknown slots are not policed. */
export function slotNeedsData(slot) { return SLOT_CLASS[slot] === "data"; }
// THE BOX TILE (docs/generated-coords-plan.md, 2026-10-23): a box-placed material's "tileSize" is ONE number (the same on every axis —
// what every project before 2026-10-23 holds) or [x, y, z] per axis (engine axes: an uneven Mapping scale, Blender's Generated
// coordinates). One rule for every reader — the editor's inspector and sanitizers, the server's record and receipt, the importer —
// mirroring the engine's (runtime/scene_json.cpp): a number above 1e-4 is every axis; an array is read only when it is THREE
// positive finite numbers, else it is 1 on every axis (never half-read, as the shift's rule). Writers write ONE number when the
// axes agree, so a project that never needed three keeps its exact bytes. Here, in the pure shared module (node loads this file
// directly — a sibling import would not resolve there).
// THE BOX PLACEMENTS — one table every reader asks (the game export's shader strip, the editor's inspector and sanitizers, the
// server's record): the textures are placed by the box projection, not the UVs. Found 2026-10-23: the strip asked for "worldBox"
// ALONE, so a game whose box materials were all Object box lost the box shaders in its export and drew them with their UVs (one
// flat colour) — each reader had its own list, and Object box reached all but one. "generatedBox" (Blender's Generated
// coordinates, docs/generated-coords-plan.md) joins here, and so reaches every one of them.
export const BOX_PLACEMENTS = ["worldBox", "objectBox", "generatedBox"];
export const isBoxPlacement = (p) => BOX_PLACEMENTS.includes(p);
const OK = (v) => typeof v === "number" && Number.isFinite(v) && v > 1e-4 && v < 1e7;
/** The tile on each axis, as the engine reads it. */
export function readTile(v) {
    if (Array.isArray(v))
        return v.length === 3 && v.every(OK) ? [v[0], v[1], v[2]] : [1, 1, 1];
    return OK(v) ? [v, v, v] : [1, 1, 1];
}
/** What to WRITE: one number when the three agree (to 1e-9), else the three. */
export function tileValue(t) {
    return Math.abs(t[0] - t[1]) < 1e-9 && Math.abs(t[0] - t[2]) < 1e-9 ? t[0] : [t[0], t[1], t[2]];
}
/** For words: "2 m" or "1 × 2 × 0.5 m". */
export function tileWords(v, unit = "m") {
    const t = readTile(v), r = (x) => String(+x.toFixed(2)); // two decimals: the receipt's wording before three axes
    return Math.abs(t[0] - t[1]) < 1e-9 && Math.abs(t[0] - t[2]) < 1e-9 ? `${r(t[0])} ${unit}` : `${t.map(r).join(" × ")} ${unit}`;
}
/** A texture record's cooked class. `linear` marks data; `alpha` marks the cutout lane (sRGB). */
export function recordClass(rec) {
    return rec && rec.linear === true ? "data" : "color";
}
export const MATERIAL_EXTRAS = {
    ocean_mask_map: { field: "maskMap", kind: "texture" }, // packed: R = AO, G = wear
    ocean_mask_uv1: { field: "maskUV1", kind: "flag" }, // sample it on the mesh's unique unwrap
    ocean_wear_map: { field: "wearMap", kind: "texture" }, // the wear layer's colour
    ocean_wear_normal: { field: "wearNormalMap", kind: "texture" },
    ocean_wear_mr: { field: "wearMrMap", kind: "texture" },
    ocean_tint_mask: { field: "tintMask", kind: "texture" }, // R/G/B SELECT zones
    ocean_tint1: { field: "tint1", kind: "color" }, // "#rrggbb" or "r,g,b"
    ocean_tint2: { field: "tint2", kind: "color" },
    ocean_tint3: { field: "tint3", kind: "color" },
};
/** Parse an extras colour: "#rrggbb", "rrggbb", or "r,g,b" (0..255). null when it is not a colour. */
export function parseExtraColor(v) {
    if (Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === "number"))
        return v.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))));
    if (typeof v !== "string")
        return null;
    const t = v.trim();
    const hex = t.replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex))
        return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const parts = t.split(",").map((x) => Number(x.trim()));
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n)))
        return parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))));
    return null;
}
/** Pick the recognized ocean_* keys out of a glTF material's `extras`. Unknown keys are ignored —
 *  Blender materials carry unrelated custom properties, and this is a whitelist, not a scanner. */
export function readMaterialExtras(extras) {
    const out = {};
    if (!extras || typeof extras !== "object")
        return out;
    for (const [k, spec] of Object.entries(MATERIAL_EXTRAS)) {
        const v = extras[k];
        if (v === undefined || v === null)
            continue;
        if (spec.kind === "flag") {
            if (v === true || v === 1 || v === "true" || v === "1")
                out[spec.field] = true;
            continue;
        }
        if (spec.kind === "color") {
            const c = parseExtraColor(v);
            if (c)
                out[spec.field] = c;
            continue;
        }
        if (typeof v === "string" && v.trim())
            out[spec.field] = v.trim();
    }
    return out;
}
export function partMaterial(pt) {
    const hasPbr = pt.metallic !== undefined || pt.roughness !== undefined
        || !!pt.normalMap || !!pt.mrMap || !!pt.aoMap || !!pt.emissiveMap || !!pt.emissive;
    return {
        shader: "lit", quality: hasPbr ? "high" : "low",
        ...(pt.texture ? { color: [255, 255, 255], texture: pt.texture } : { color: [...pt.color] }),
        ...(pt.texture && pt.normalMap ? { normalMap: pt.normalMap } : {}),
        ...(pt.texture && pt.mrMap ? { mrMap: pt.mrMap } : {}),
        ...(pt.texture && pt.aoMap ? { aoMap: pt.aoMap } : {}),
        ...(pt.texture && pt.aoMap && pt.aoUV1 ? { aoUV1: true } : {}), // T3: AO samples the unique set
        ...(pt.texture && pt.emissiveMap ? { emissiveMap: pt.emissiveMap } : {}),
        ...(pt.emissive ? { emissive: [...pt.emissive] } : {}),
        ...(pt.metallic !== undefined ? { metallic: pt.metallic } : {}),
        ...(pt.roughness !== undefined ? { roughness: pt.roughness } : {}),
        // IM3: BLEND = the engine's transparent state (factor alpha as uniform opacity); MASK + doubleSided
        // ride to the material for the engine's alpha-test / cull-off support.
        ...(pt.transparent ? { transparent: true, opacity: pt.opacity ?? 1 } : {}),
        ...(pt.alphaMask ? { alphaMask: true, alphaCutoff: pt.alphaCutoff ?? 0.5 } : {}),
        ...(pt.doubleSided ? { doubleSided: true } : {}),
    };
}
/** MODEL MATERIALS (docs/model-materials-plan.md, 2026-10-01): the look a model's material is minted with — partMaterial plus the
 *  mask family the artist DECLARED in Blender (M3's MATERIAL_EXTRAS fields, resolved onto the part entry by bindMaterialExtras).
 *  Add to scene's per-part recipe never carried those, so a declared wear / tint / packed mask reached the part record and
 *  stopped there. The family rides the base texture like every map (materials.ts normalize: no texture, no maps; the wear
 *  normal/MR only with a wear map; the tints only with a tint mask). Kept apart from partMaterial ON PURPOSE: placements made
 *  before model materials were minted by partMaterial, and the re-import recognises them as untouched by comparing with
 *  exactly that recipe (server/import.ts, legacy placements). */
export function modelMaterialRecipe(pt) {
    const out = partMaterial(pt);
    // GLASS (2026-10-02, glb2mesh glassOf): Blender's Transmission made this the engine's glass — the bend for its IOR. BEFORE the
    // texture guard: a glass needs no texture (the lobby's M_Glass has none). NOT in partMaterial: the re-import recognises a
    // legacy placement as untouched by comparing with exactly partMaterial's recipe.
    if (typeof pt.refraction === "number" && pt.refraction > 0)
        out.refraction = pt.refraction;
    if (typeof pt.paneTint === "number" && pt.paneTint > 0)
        out.paneTint = Math.min(1, pt.paneTint); // W-A2: the pane's tint (glass only)
    // SPECULAR (2026-10-02, tools/specularimport.ts): the file's non-metal reflectance — the strength and its tint need no texture
    // (BEFORE the guard, glass's rule); the MR-alpha flag rides the MR map it describes (below). NOT in partMaterial (the same reason).
    if (typeof pt.specular === "number" && pt.specular >= 0)
        out.specular = pt.specular;
    {
        const t = Array.isArray(pt.specularTint) && pt.specularTint.length >= 3 && pt.specularTint.every((n) => typeof n === "number")
            ? pt.specularTint.slice(0, 3) : undefined;
        if (t)
            out.specularTint = t;
    }
    // DECALS (2026-10-17, glb2mesh materialDecal): the artist marked this material ocean_decal = mesh — the engine's MESH DECAL (E1,
    // material_t.decal). BEFORE the texture guard (a flat-colour decal sheet is still a decal); NOT in partMaterial (glass's reason).
    if (pt.decal === true)
        out.decal = true;
    if (!pt.texture)
        return out;
    if (pt.specularInMrAlpha === true && out.mrMap)
        out.specularInMrAlpha = true;
    const name = (k) => (typeof pt[k] === "string" && pt[k] ? pt[k] : undefined);
    const rgb = (v) => Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === "number") ? v.slice(0, 3) : undefined;
    if (name("maskMap")) {
        out.maskMap = name("maskMap");
        if (pt.maskUV1 === true)
            out.maskUV1 = true;
    }
    if (name("wearMap")) {
        out.wearMap = name("wearMap");
        if (name("wearNormalMap"))
            out.wearNormalMap = name("wearNormalMap");
        if (name("wearMrMap"))
            out.wearMrMap = name("wearMrMap");
    }
    if (name("tintMask")) {
        out.tintMask = name("tintMask");
        for (const k of ["tint1", "tint2", "tint3"]) {
            const c = rgb(pt[k]);
            if (c)
                out[k] = c;
        }
    }
    // WORLD BOX (docs/world-box-plan.md): the import found Blender placed this material by world position — rides the base texture
    // like the maps, with the tile size the file implied (the owner's edits to it survive re-imports: the per-value merge).
    // OBJECT BOX (2026-10-08): or by the object's own position (the Blender add-on's Object coordinates), with the shift it implied.
    if (isBoxPlacement(pt.placement)) {
        out.placement = pt.placement;
        out.tileSize = tileValue(readTile(pt.tileSize)); // one number or three per axis (refs.ts readTile — the engine's rule)
        if (typeof pt.boxBlend === "number" && pt.boxBlend > 0)
            out.boxBlend = Math.min(1, pt.boxBlend);
        const o = pt.boxOffset;
        if (Array.isArray(o) && o.length === 3 && o.every((v) => typeof v === "number" && Number.isFinite(v)) && o.some((v) => v !== 0))
            out.boxOffset = o.slice(0, 3);
    }
    return out;
}
