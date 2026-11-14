/** A file name the engine may be handed: RELATIVE to the project's data folder, in plain segments — no absolute path, no "..", no
 *  backslash, no control character, no empty segment. The helper's /asset door serves the browser by this rule; the desktop app's
 *  engine checks the same rule in C++ (engine_host_native.cpp take_name_ok) — the twin test holds them to the same refusals. */
export function takeNameOk(file) {
    if (!file || file.startsWith("/"))
        return false;
    return file.split("/").every((seg) => seg !== "" && seg !== ".." && !/[\\\u0000-\u001f]/.test(seg));
}
/** A piece's looks (the server's looksOf, import.ts): its slots when it has several, else itself. */
export const looksOf = (pc) => (pc.slots && pc.slots.length > 1 ? pc.slots : [pc]);
function lookTakes(lk) {
    const out = [];
    // IM3b: a cutout albedo bakes .rgba8 (sRGB WITH alpha, 4 bytes a pixel); every other albedo is 565 (2)
    if (lk.texture && lk.texBaked && lk.w && lk.h)
        out.push({ kind: "texture", id: lk.texture, file: lk.texBaked, w: lk.w, h: lk.h, lane: lk.texBaked.endsWith(".rgba8") ? "alpha" : "565" });
    for (const mp of lk.maps ?? [])
        if (mp.w && mp.h)
            out.push({ kind: "texture", id: mp.id, file: mp.baked, w: mp.w, h: mp.h, lane: mp.linear ? "linear" : "565" });
    return out;
}
/** The files a single-file import's answer names, in the order the engine needs them (a mesh before its shape keys). A model: its
 *  own mesh (the umbrella — EMPTY, and refused, when every triangle lives in moving or shape-key pieces), each piece's mesh and
 *  looks, each moving piece, each shape-key piece's bundle, a skinned model's bundle. A texture, a sky, a sprite: one file. The
 *  clips and the model-material table are not files — the importer hands them over by their own doors. */
export function importTakes(j) {
    if (!j.ok || !j.baked || !j.name)
        return [];
    if (j.kind === "sprite")
        return j.sprite ? [spriteTake(j.sprite.sheet)] : [];
    if (j.kind === "hdr")
        return [{ kind: "sky", id: j.name, file: j.baked, w: j.w ?? 0, h: j.h ?? 0,
                ...(j.sh ? { sh: j.sh } : {}), ...(j.env ? { env: j.env, envBase: j.envBase, envMips: j.envMips } : {}) }];
    if (j.kind !== "mesh")
        return [{ kind: "texture", id: j.name, file: j.baked, w: j.w ?? 0, h: j.h ?? 0, lane: "565" }];
    const out = [{ kind: "mesh", id: j.name, file: j.baked }];
    for (const pt of j.parts ?? []) {
        out.push({ kind: "mesh", id: pt.mesh, file: pt.mesh + ".ocm" });
        for (const lk of looksOf(pt))
            out.push(...lookTakes(lk));
    }
    for (const an of j.anims ?? []) {
        out.push({ kind: "mesh", id: an.mesh, file: an.mesh + ".ocm" });
        for (const lk of looksOf(an))
            out.push(...lookTakes(lk));
    }
    for (const mo of j.morphs ?? []) {
        out.push({ kind: "mesh", id: mo.mesh, file: mo.mesh + ".ocm" });
        if (mo.bundle)
            out.push({ kind: "morphs", id: mo.mesh, file: mo.bundle });
        for (const lk of looksOf(mo))
            out.push(...lookTakes(lk));
    }
    if (j.skinMorph)
        out.push({ kind: "morphs", id: j.name, file: j.skinMorph.bundle });
    return out;
}
/** A sprite's sheet: a HUD image under its file name, from the derived data/ui/sprites (the boot channel registers it the same way). */
export function spriteTake(sheet) { return { kind: "uifile", id: sheet, file: "ui/sprites/" + sheet }; }
/** A user shader's variants (its manifest's keys, canonical order 0..13): data/shaders/<id>.<key>, each backend's own extension. */
export function shaderTakes(id, variants) {
    return variants.map((key, index) => ({ kind: "shader", id, file: `shaders/${id}.${key}`, index }));
}
/** The desktop app's taker: the whole list in ONE question — its engine reads each file from the open project's folder. */
export function appTaker(door) {
    return async (takes) => JSON.parse(await door.engine_take_files(JSON.stringify(takes)));
}
