// sitelock.ts — the exported player's SITELOCK (CrazyGames technical requirement, 2026-09-08): a game whose project
// bound it to a portal refuses to run when its files are copied to another site. The rule is the portal's own
// (docs.crazygames.com/resources/html5/sitelock): the label ("crazygames") must be one of the LAST THREE host labels —
// www.crazygames.com, de.crazygames.com, www.crazygames.com.br, games.crazygames.com, app.crazygames.com all pass;
// evil.com does not. Deliberately no stricter than theirs: a stricter rule could refuse a regional domain their own
// reviewer opens. Local development always passes (localhost, 127.0.0.1, ::1, *.localhost; a file:// page has no
// host) so the playtest gate, the editor preview and the SDK's local mode keep working. A sitelock is a deterrent,
// not security — the check runs in the copier's browser and the wasm is not encrypted.
export function hostAllowed(hostname, labels) {
    const h = (hostname || "").toLowerCase().replace(/\.$/, "");
    if (h === "" || h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]" || h.endsWith(".localhost"))
        return true;
    const parts = h.split(".");
    return labels.some((label) => { const idx = parts.indexOf(label); return idx !== -1 && idx >= parts.length - 3; });
}
