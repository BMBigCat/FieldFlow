import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Not using Vitest's `globals: true`, so RTL's automatic afterEach-based
// cleanup detection never fires on its own — register it explicitly.
afterEach(cleanup);
