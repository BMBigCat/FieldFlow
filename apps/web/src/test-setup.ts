import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Not using Vitest's `globals: true`, so RTL's automatic afterEach-based
// cleanup detection never fires on its own — register it explicitly.
afterEach(cleanup);

// jsdom doesn't implement matchMedia — ThemeProvider's system-theme
// detection needs it.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
