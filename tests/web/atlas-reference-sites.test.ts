import { describe, expect, it } from "vitest";
import { referenceFor } from "@/lib/atlas/reference-sites";

describe("referenceFor", () => {
  it("names the saved run that holds each catalogue site", () => {
    expect(referenceFor("rule-89.5S-E120")?.id).toBe("GR-001");
    expect(referenceFor("iau-haworth")?.id).toBe("GR-002");
    expect(referenceFor("iau-shackleton")?.id).toBe("GR-003");
  });
  it("has nothing for a custom point", () => {
    expect(referenceFor("custom-1")).toBeNull();
  });
});
