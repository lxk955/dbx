import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { resolveDataGridPaintTheme } from "../../apps/desktop/src/lib/dataGrid/dataGridPaintTheme.ts";

test("DataGrid scroller and root backgrounds use var(--background) to match theme canvas background (#10669)", () => {
  const source = readFileSync("apps/desktop/src/components/grid/DataGrid.vue", "utf8");

  // Ensure root background uses var(--background)
  assert.match(source, /\[data-grid-root\]\s*\{[^}]*background-color:\s*var\(--background\);/s);
  assert.match(source, /\[data-grid-root\]\.data-grid--dark,\s*:global\(\.dark\)\s*\[data-grid-root\]\s*\{[^}]*background-color:\s*var\(--background\);/s);

  // Ensure canvas scroller and DOM scroller use var(--background) rather than hardcoded RGB
  assert.match(source, /\.canvas-grid-scroller\s*\{[^}]*background-color:\s*var\(--background\);/s);
  assert.match(source, /\[data-grid-root\]\.data-grid--dark\s+\.canvas-grid-scroller,\s*:global\(\.dark\)\s*\[data-grid-root\]\s+\.canvas-grid-scroller\s*\{[^}]*background-color:\s*var\(--background\)\s*!important;/s);
  assert.match(source, /\.data-grid-scroller:not\(\.canvas-grid-scroller\)\s*\{[^}]*background-color:\s*var\(--background\);/s);

  // Ensure scrollbars use var(--background)
  assert.match(source, /\.data-grid-horizontal-scrollbar\s*\{[^}]*background-color:\s*var\(--background\);/s);
  assert.match(source, /:global\(\.dark\)\s*\[data-grid-root\]\s+\.data-grid-vertical-scrollbar\s*\{[^}]*background-color:\s*var\(--background\);/s);

  // Ensure unstriped even rows in rowStyle use var(--background)
  assert.match(source, /item\.displayIndex % 2 === 1[\s\S]*?:\s*"var\(--background\)";/);

  // Must not have hardcoded rgb(19, 20, 22) or rgb(255, 255, 255) for scroller backgrounds
  assert.doesNotMatch(source, /\.canvas-grid-scroller\s*\{[^}]*background-color:\s*rgb\(255,\s*255,\s*255\);/s);
  assert.doesNotMatch(source, /\.canvas-grid-scroller\s*\{[^}]*background-color:\s*rgb\(19,\s*20,\s*22\)/s);
});

test("resolveDataGridPaintTheme resolves background from --background CSS variable", () => {
  const getThemeBackground = (varBackground: string, isDark: boolean) => {
    return resolveDataGridPaintTheme({
      getVar: (name) => (name === "--background" ? varBackground : ""),
      isDark,
    }).background;
  };

  // When theme is IDEA dark (#2b2b2b / rgb(43, 43, 43))
  assert.equal(getThemeBackground("rgb(43, 43, 43)", true), "rgb(43, 43, 43)");

  // When theme is VS Code dark (rgb(30, 30, 30))
  assert.equal(getThemeBackground("rgb(30, 30, 30)", true), "rgb(30, 30, 30)");

  // When theme is amber light (rgb(255, 252, 242))
  assert.equal(getThemeBackground("rgb(255, 252, 242)", false), "rgb(255, 252, 242)");
});
