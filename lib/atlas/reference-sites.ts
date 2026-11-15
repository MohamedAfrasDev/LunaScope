/** Which saved reference run holds each catalogue site, so a site that is not in the loaded run can offer the run that has it. */
export const REFERENCE_SITES: Record<string, { label: string; sites: string[] }> = {
  "GR-001": { label: "GR-001, the three rule points", sites: ["rule-89.5S-E0", "rule-89.5S-E120", "rule-89.5S-E240"] },
  "GR-002": { label: "GR-002, the Artemis III features", sites: ["iau-haworth", "iau-mons-malapert", "iau-mons-mouton", "iau-nobile", "iau-de-gerlache", "iau-slater"] },
  "GR-003": { label: "GR-003, the well-known craters", sites: ["iau-shackleton", "iau-shoemaker", "iau-faustini", "iau-cabeus", "iau-amundsen", "iau-sverdrup"] },
};

export function referenceFor(siteId: string): { id: string; label: string } | null {
  for (const [id, r] of Object.entries(REFERENCE_SITES)) if (r.sites.includes(siteId)) return { id, label: r.label };
  return null;
}
