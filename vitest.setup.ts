import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // the analysis form keeps a per-tab draft; no test may see another test's draft
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
});
