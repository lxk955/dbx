// @vitest-environment happy-dom
import { createApp, nextTick, type App } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { useSavedSqlStore } from "@/stores/savedSqlStore";
import { useQueryStore } from "@/stores/queryStore";
import type { SavedSqlFile, SavedSqlFolder } from "@/types/database";

import { changeSearchMode } from "./sqlSearchTestUtils";

vi.mock("@/components/ui/select", () => import("./sqlSearchTestUtils"));
vi.mock("@/lib/backend/tauriRuntime", () => ({ isTauriRuntime: () => false }));

import SqlLibraryPanel from "../SqlLibraryPanel.vue";

const mounted: Array<{ app: App; host: HTMLElement }> = [];
const timestamp = "2026-10-01T00:00:00Z";
const scrollIntoView = vi.fn();

function folder(id: string, name: string, parentFolderId?: string): SavedSqlFolder {
  return { id, name, parentFolderId, connectionId: "", createdAt: timestamp, updatedAt: timestamp };
}

function file(id: string, name: string, sql = "SELECT 1", folderId?: string): SavedSqlFile {
  return { id, name, sql, sqlLoaded: true, folderId, connectionId: "", database: "metadata-only", createdAt: timestamp, updatedAt: timestamp };
}

async function mountPanel(options: { activeFileId?: string; locateRequest?: { id: number; fileId: string } | null; onLocateHandled?: (id: number) => void } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const savedSqlStore = useSavedSqlStore();
  const queryStore = useQueryStore();

  savedSqlStore.loadState = "loaded";
  savedSqlStore.folders = [folder("root-folder", "Parent Folder"), folder("sub-folder", "Child Folder", "root-folder")];
  savedSqlStore.files = [file("file-unfiled", "unfiled.sql"), file("file-nested", "nested.sql", "SELECT 2", "sub-folder"), file("file-other", "other.sql", "SELECT 3", "root-folder")];

  if (options.activeFileId) {
    const f = savedSqlStore.files.find((item) => item.id === options.activeFileId);
    if (f) {
      queryStore.openSavedSql(f);
    }
  }

  const host = document.createElement("div");
  document.body.appendChild(host);

  const app = createApp(SqlLibraryPanel, {
    locateRequest: options.locateRequest,
    "onLocate-handled": options.onLocateHandled,
  });
  app.use(pinia);
  app.use(i18n);
  app.mount(host);
  mounted.push({ app, host });

  await nextTick();
  return { app, host, savedSqlStore, queryStore };
}

beforeEach(() => {
  localStorage.clear();
  scrollIntoView.mockClear();
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scrollIntoView);
});

afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
  vi.restoreAllMocks();
});

describe("SqlLibraryPanel locate active file (#13412)", () => {
  it("renders locate button in toolbar, disabled when no saved sql is active", async () => {
    const { host } = await mountPanel();
    const locateBtn = host.querySelector<HTMLButtonElement>("button[data-sidebar-locate-button]");
    expect(locateBtn).not.toBeNull();
    expect(locateBtn?.getAttribute("aria-label")).toBe(i18n.global.t("sqlFileTree.locateActiveFile"));
    expect(locateBtn?.disabled).toBe(true);
  });

  it("enables locate button when active query tab is a saved sql file", async () => {
    const { host } = await mountPanel({ activeFileId: "file-unfiled" });
    const locateBtn = host.querySelector<HTMLButtonElement>("button[data-sidebar-locate-button]")!;
    expect(locateBtn.disabled).toBe(false);
  });

  it("locates nested active file by uncollapsing parent folders and scrolling into view", async () => {
    const { host } = await mountPanel({ activeFileId: "file-nested" });
    const locateBtn = host.querySelector<HTMLButtonElement>("button[data-sidebar-locate-button]")!;
    expect(locateBtn.disabled).toBe(false);

    locateBtn.click();
    await nextTick();
    await nextTick();

    const nestedRow = host.querySelector<HTMLElement>("[data-sql-library-file='file-nested']");
    expect(nestedRow).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("clears search filter and reveals active file if currently filtered out", async () => {
    const { host } = await mountPanel({ activeFileId: "file-nested" });
    const searchInput = host.querySelector<HTMLInputElement>("[data-sql-library-search]")!;
    searchInput.value = "unfiled";
    searchInput.dispatchEvent(new Event("input"));
    await nextTick();

    // Verify nested file is not currently visible in filtered rows
    expect(host.querySelector("[data-sql-library-file='file-nested']")).toBeNull();

    const locateBtn = host.querySelector<HTMLButtonElement>("button[data-sidebar-locate-button]")!;
    locateBtn.click();
    await nextTick();
    await nextTick();

    // Search query should be cleared and file visible
    expect(searchInput.value).toBe("");
    const nestedRow = host.querySelector<HTMLElement>("[data-sql-library-file='file-nested']");
    expect(nestedRow).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("handles locateRequest prop, uncollapses ancestors and emits locate-handled", async () => {
    const onHandled = vi.fn();
    const { host } = await mountPanel({
      locateRequest: { id: 42, fileId: "file-nested" },
      onLocateHandled: onHandled,
    });

    await vi.waitFor(() => expect(onHandled).toHaveBeenCalledWith(42));
    const nestedRow = host.querySelector<HTMLElement>("[data-sql-library-file='file-nested']");
    expect(nestedRow).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("restores persisted search mode from localStorage and persists changes", async () => {
    localStorage.setItem("dbx-saved-sql-search-mode", "content");
    const { host } = await mountPanel();
    const select = host.querySelector<HTMLSelectElement>("select[data-search-mode]");
    expect(select).not.toBeNull();
    expect(select?.value).toBe("content");

    await changeSearchMode(host, "name");
    expect(localStorage.getItem("dbx-saved-sql-search-mode")).toBe("name");
  });
});
