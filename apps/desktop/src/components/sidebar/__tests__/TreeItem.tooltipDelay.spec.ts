// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { setLocale } from "@/i18n";
import TreeItem from "@/components/sidebar/TreeItem.vue";
import { createSidebarTreeRuntime, sidebarTreeRuntimeKey, type SidebarTreeRuntimeHost } from "@/lib/sidebar/sidebarTreeRuntime";
import type { ConnectionConfig, TreeNode } from "@/types/database";

const settingsState = {
  shortcuts: { openDataInNewTab: "" },
  sidebarActivation: "double",
  sidebarAllowHorizontalScroll: false,
  sidebarHiddenTablePrefixes: [],
  sidebarObjectInfoMode: "none",
  sidebarShowTooltips: true,
  sidebarTooltipDelaySecs: 3,
};

const connectionConfig: ConnectionConfig = {
  id: "conn-1",
  name: "Production DB",
  db_type: "mysql",
  host: "10.0.0.1",
  port: 3306,
  username: "root",
  database: "shop",
} as ConnectionConfig;

const connectionStore = {
  activeConnectionId: "conn-1",
  connectedIds: new Set(["conn-1"]),
  connectingIds: new Set<string>(),
  connectionErrors: {},
  connectionMultiSelectActive: false,
  connections: [],
  getConfig: () => connectionConfig,
  getSidebarVisibleFilterSummary: () => null,
  clearConnectionError: vi.fn(),
  isDefaultDatabase: () => false,
  isDefaultSchema: () => false,
  isPinnedTreeNodeReorderTarget: () => false,
  isTreeNodeChildrenLoaded: () => false,
  isTreeNodePinned: () => false,
  selectedTreeNodeId: null as string | null,
  selectedTreeNodeIds: [] as string[],
  selectedTreeNodeIdsSet: new Set<string>(),
  sidebarTableSearchQueries: {},
  tableNameFilterForScope: () => undefined,
  treeNodes: [],
  treeSelectionAnchorId: null as string | null,
};

vi.mock("@/stores/connectionStore", () => ({
  useConnectionStore: () => connectionStore,
}));

vi.mock("@/stores/queryStore", () => ({
  useQueryStore: () => ({ openDatabaseKeys: new Set<string>() }),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: () => ({
    editorSettings: settingsState,
  }),
}));

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mountedApps: App[] = [];

function runtimeHost(): SidebarTreeRuntimeHost {
  return {
    buildContextMenu: vi.fn(() => []),
    handleRowClick: vi.fn(),
    handleRowDoubleClick: vi.fn(),
    handleRowKeydown: vi.fn(),
    openPrimaryVisibleFilter: vi.fn(),
    openDataInNewTab: vi.fn(),
    requestPaste: vi.fn(() => false),
    toggleNode: vi.fn(),
  };
}

function mountConnectionItem() {
  const container = document.createElement("div");
  document.body.append(container);
  const node: TreeNode = {
    id: "conn-1",
    label: "Production DB",
    type: "connection",
    connectionId: "conn-1",
    isExpanded: true,
    children: [],
  };
  const app = createApp(
    defineComponent({
      setup: () => () => h(TreeItem, { node, depth: 0 }),
    }),
  );
  mountedApps.push(app);
  const runtime = createSidebarTreeRuntime();
  runtime.bindHost(runtimeHost());
  app.use(i18n);
  app.provide(sidebarTreeRuntimeKey, runtime);
  app.mount(container);

  const row = container.querySelector<HTMLElement>("[tabindex]");
  if (!row) throw new Error(`Row was not rendered: ${container.innerHTML}`);
  const trigger = row.parentElement;
  if (!trigger) throw new Error(`Tooltip trigger was not rendered: ${container.innerHTML}`);
  let isHovered = false;
  vi.spyOn(row, "matches").mockImplementation((selector) => selector === ":hover" && isHovered);
  return {
    container,
    row,
    trigger,
    enter: () => {
      isHovered = true;
      trigger.dispatchEvent(new MouseEvent("mouseenter"));
    },
    leave: () => {
      isHovered = false;
      trigger.dispatchEvent(new MouseEvent("mouseleave"));
    },
  };
}

beforeEach(async () => {
  vi.useFakeTimers();
  await setLocale("en");
  settingsState.sidebarShowTooltips = true;
  settingsState.sidebarTooltipDelaySecs = 3;
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("TreeItem sidebar tooltip delay", () => {
  it("delays showing detail tooltip by configured seconds (3s)", async () => {
    const { enter } = mountConnectionItem();
    await nextTick();

    // Mouse enters the trigger
    enter();
    await nextTick();

    // After 2000ms, the 3s delay has not elapsed; tooltip should not be visible
    vi.advanceTimersByTime(2000);
    await nextTick();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    // Advance the remaining 1000ms to hit 3000ms
    vi.advanceTimersByTime(1000);
    await nextTick();
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Production DB");
    expect(document.body.textContent).toContain("10.0.0.1");
  });

  it("cancels tooltip when mouse leaves before delay expires", async () => {
    const { enter, leave } = mountConnectionItem();
    await nextTick();

    enter();
    await nextTick();

    // Advance 1500ms
    vi.advanceTimersByTime(1500);
    await nextTick();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    // Mouse leaves
    leave();
    await nextTick();

    // Advance remaining time and beyond
    vi.advanceTimersByTime(2000);
    await nextTick();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("shows immediately when sidebarTooltipDelaySecs is 0", async () => {
    settingsState.sidebarTooltipDelaySecs = 0;
    const { enter } = mountConnectionItem();
    await nextTick();

    enter();
    await nextTick();

    vi.advanceTimersByTime(0);
    await nextTick();
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Production DB");
  });

  it("does not show tooltip when sidebarShowTooltips is false", async () => {
    settingsState.sidebarShowTooltips = false;
    const { enter } = mountConnectionItem();
    await nextTick();

    enter();
    await nextTick();

    await vi.runAllTimersAsync();
    await nextTick();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});
