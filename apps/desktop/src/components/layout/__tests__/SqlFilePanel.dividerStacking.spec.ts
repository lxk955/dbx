// @vitest-environment happy-dom

import { createApp, nextTick, type App } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";

vi.mock("@/lib/sqlFile/sqlFileFolders", () => ({
  getSqlFileFilter: () => "",
  getSqlFileFolderPaths: () => ["/test/folder"],
  saveSqlFileFilter: vi.fn(),
  saveSqlFileFolderPaths: vi.fn(),
  notifySqlFileFoldersChanged: vi.fn(),
}));
vi.mock("@/lib/backend/tauriRuntime", () => ({ isTauriRuntime: () => false }));
vi.mock("@/lib/backend/api", () => ({
  listSqlFiles: vi.fn().mockResolvedValue([
    { name: "alpha.sql", path: "/test/folder/alpha.sql", is_dir: false, size: 100, modified: 1 },
    { name: "beta.sql", path: "/test/folder/beta.sql", is_dir: false, size: 200, modified: 2 },
  ]),
}));

import SqlFilePanel from "../SqlFilePanel.vue";

const mounted: Array<{ app: App; host: HTMLElement }> = [];

function mountPanel() {
  setActivePinia(createPinia());
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(SqlFilePanel);
  app.use(i18n);
  app.mount(host);
  mounted.push({ app, host });
  return host;
}

afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
});

describe("SqlFilePanel divider stacking isolation (#13584)", () => {
  it("isolates internal stacking context on root container", async () => {
    const host = mountPanel();
    await nextTick();

    const rootElement = host.firstElementChild as HTMLElement;
    expect(rootElement).not.toBeNull();
    expect(rootElement.classList.contains("isolate")).toBe(true);
    expect(rootElement.classList.contains("overflow-hidden")).toBe(true);
  });

  it("keeps sticky z-10 on folder header to remain above scrolled file entries inside panel", async () => {
    const host = mountPanel();
    await nextTick();

    const folderRow = host.querySelector('[data-sql-file-row="true"]');
    expect(folderRow).not.toBeNull();
    expect(folderRow!.classList.contains("sticky")).toBe(true);
    expect(folderRow!.classList.contains("top-0")).toBe(true);
    expect(folderRow!.classList.contains("z-10")).toBe(true);
  });

  it("renders folder header container with border separation between roots", async () => {
    const host = mountPanel();
    await nextTick();

    const folderContainer = host.querySelector(".border-b");
    expect(folderContainer).not.toBeNull();
  });
});
