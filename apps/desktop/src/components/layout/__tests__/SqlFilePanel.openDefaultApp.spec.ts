// @vitest-environment happy-dom

import { createApp, type App } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { useQueryStore } from "@/stores/queryStore";

const mocks = vi.hoisted(() => ({
  openPathWithDefaultApp: vi.fn(),
  readExternalSqlFileSnapshot: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/sqlFile/sqlFileFolders", () => ({
  getSqlFileFilter: () => ".*",
  getSqlFileFolderPaths: () => ["/sql"],
  saveSqlFileFilter: vi.fn(),
  saveSqlFileFolderPaths: vi.fn(),
  notifySqlFileFoldersChanged: vi.fn(),
}));

vi.mock("@/lib/backend/tauriRuntime", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/backend/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/backend/api")>()),
  listSqlFilesInFolder: vi.fn(async () => [
    { name: "query.sql", path: "/sql/query.sql", is_dir: false, children: [] },
    { name: "report.xlsx", path: "/sql/report.xlsx", is_dir: false, children: [] },
    { name: "notes.pdf", path: "/sql/notes.pdf", is_dir: false, children: [] },
  ]),
  openPathWithDefaultApp: mocks.openPathWithDefaultApp,
  readExternalSqlFileSnapshot: mocks.readExternalSqlFileSnapshot,
}));

import SqlFilePanel from "../SqlFilePanel.vue";

const mounted: Array<{ app: App; host: HTMLElement }> = [];

async function mountPanel() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const queryStore = useQueryStore();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(SqlFilePanel);
  app.use(pinia);
  app.use(i18n);
  app.mount(host);
  mounted.push({ app, host });
  await vi.waitFor(() => expect(host.textContent).toContain("report.xlsx"));
  return { host, queryStore };
}

beforeEach(() => {
  mocks.openPathWithDefaultApp.mockReset().mockResolvedValue(undefined);
  mocks.readExternalSqlFileSnapshot.mockReset().mockResolvedValue({
    content: "SELECT 1;",
    version: { contentHash: "hash", modifiedNs: "1", sizeBytes: 9 },
    encoding: "utf8",
  });
  mocks.toast.mockReset();
});

afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
  vi.restoreAllMocks();
});

describe("SqlFilePanel open with default application", () => {
  it("opens non-SQL files using openPathWithDefaultApp instead of reading as SQL", async () => {
    const { host } = await mountPanel();

    const excelEntry = Array.from(host.querySelectorAll(".tree-item-label")).find((el) => el.textContent?.includes("report.xlsx")) as HTMLElement;
    expect(excelEntry).not.toBeNull();

    excelEntry.click();
    await vi.waitFor(() => expect(mocks.openPathWithDefaultApp).toHaveBeenCalledTimes(1));

    expect(mocks.openPathWithDefaultApp).toHaveBeenCalledWith("/sql/report.xlsx");
    expect(mocks.readExternalSqlFileSnapshot).not.toHaveBeenCalled();
  });

  it("opens SQL files inside the editor tab using readExternalSqlFileSnapshot", async () => {
    const { host, queryStore } = await mountPanel();
    const openTabSpy = vi.spyOn(queryStore, "openExternalSqlFile");

    const sqlEntry = Array.from(host.querySelectorAll(".tree-item-label")).find((el) => el.textContent?.includes("query.sql")) as HTMLElement;
    expect(sqlEntry).not.toBeNull();

    sqlEntry.click();
    await vi.waitFor(() => expect(mocks.readExternalSqlFileSnapshot).toHaveBeenCalledTimes(1));

    expect(mocks.readExternalSqlFileSnapshot).toHaveBeenCalledWith("/sql/query.sql", expect.any(Number));
    expect(mocks.openPathWithDefaultApp).not.toHaveBeenCalled();
    expect(openTabSpy).toHaveBeenCalledWith("", "", "/sql/query.sql", "SELECT 1;", expect.any(Object), undefined, undefined, undefined, "utf8");
  });

  it("surfaces a toast error when opening with the default application fails", async () => {
    mocks.openPathWithDefaultApp.mockRejectedValue(new Error("No associated application"));
    const { host } = await mountPanel();

    const pdfEntry = Array.from(host.querySelectorAll(".tree-item-label")).find((el) => el.textContent?.includes("notes.pdf")) as HTMLElement;
    expect(pdfEntry).not.toBeNull();

    pdfEntry.click();
    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));

    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining("No associated application"), 5000);
  });
});
