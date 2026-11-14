// A count said right: "1 object", "4 objects" — never "1 object(s)" (docs/editor-ui-plan.md item 10, 2026-11-09).
//
// WHY: the editor wrote its counts as "used by 1 object(s) — edits change all of them", "importing 181 file(s)", "2 skybox(es)" in
// about a hundred places, each spelling the plural by hand. A person reads "(s)" as a program that could not be bothered; worse, the
// sentence around it often stays plural for one ("edits change all of them" about a single object). ONE rule now, here, and
// tools/plurals_test.ts refuses a word glued to "(s)", "(es)" or "(ies)" in any string the editor writes (its page, its React screens,
// its helper server and the desktop app's own files).
//
// The plural is NAMED by the caller when it is not the singular + "s" ("mesh", "meshes"; "entry", "entries"): no English rules are
// guessed here, so a word this file never heard of cannot come out wrong. Browser-safe, no imports: the helper server imports it too.
/** The count with its noun: countOf(1, "object") = "1 object", countOf(4, "object") = "4 objects", countOf(2, "mesh", "meshes"). */
export function countOf(n, one, many = one + "s") {
    return `${n} ${wordFor(n, one, many)}`;
}
/** The noun alone, for a sentence that places the number itself: wordFor(1, "object") = "object". Only exactly 1 is singular
 *  ("0 objects", "1.5 objects"), as English says. */
export function wordFor(n, one, many = one + "s") {
    return n === 1 ? one : many;
}
