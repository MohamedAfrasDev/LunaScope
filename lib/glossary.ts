/**
 * The key terms, in one place (galaxy D8). The wording is lifted from the user guide (docs/USER-GUIDE.md) so the product
 * says the same thing everywhere: in the term popovers, on the explainer page, and in the guide.
 */
export type GlossaryId = "terrain-aware" | "flat-horizon" | "availability-range" | "unresolved" | "unknown" | "excluded";

export const GLOSSARY: { id: GlossaryId; term: string; text: string }[] = [
  {
    id: "terrain-aware",
    term: "Terrain-aware",
    text: "The result that counts. It uses the real terrain skyline from the elevation data, so ridges and crater walls can hide the Sun or Earth.",
  },
  {
    id: "flat-horizon",
    term: "Flat horizon",
    text: "What a level horizon would say. It is shown only as a comparison, to make clear how much the terrain changes the answer. It is not the result.",
  },
  {
    id: "availability-range",
    term: "Availability range",
    text: "How much of the time a target is visible, as a range rather than one number: from the lower bound (the time confirmed visible) to the upper bound (adding time still inside the decision band).",
  },
  {
    id: "unresolved",
    term: "Unresolved",
    text: "Time inside the narrow numerical decision band around a crossing. It is bounded, and it widens the availability range rather than counting as an outage.",
  },
  {
    id: "unknown",
    term: "Unknown",
    text: "Time that cannot be confirmed either way is kept as unknown. It is never counted as an outage.",
  },
  {
    id: "excluded",
    term: "Excluded",
    text: "Missing data or an uncertified region. The case is left out. It is not a failure.",
  },
];

export function glossaryEntry(id: GlossaryId) {
  const e = GLOSSARY.find((g) => g.id === id);
  if (!e) throw new Error(`unknown glossary term: ${id}`);
  return e;
}
