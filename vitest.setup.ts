import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// @testing-library/react's auto-cleanup relies on Vitest's injected globals,
// which we don't enable (tests import from "vitest" explicitly instead).
afterEach(() => {
  cleanup();
});
