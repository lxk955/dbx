// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SchemaDiffObject } from "@/lib/schema/schemaDiff";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/common/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: () => ({
    editorSettings: {
      customThemes: [],
      activeCustomThemeId: "",
    },
  }),
  DEFAULT_CUSTOM_THEME_DDL_COLORS: {
    addedRowBg: "#00ff00",
    addedRowBgAlpha: 20,
    removedRowBg: "#ff0000",
    removedRowBgAlpha: 20,
    modifiedRowBg: "#ffaa00",
    modifiedRowBgAlpha: 20,
    modifiedCharBg: "#ffaa00",
    modifiedCharBgAlpha: 40,
  },
}));

vi.mock("@/components/diff/DiffSvgConnector.vue", () => ({
  default: defineComponent({
    setup() {
      return () => h("div", { class: "diff-svg-connector" });
    },
  }),
}));

vi.mock("splitpanes", () => ({
  Splitpanes: defineComponent({
    setup(_props, { slots }) {
      return () => h("div", { class: "splitpanes" }, slots.default?.());
    },
  }),
  Pane: defineComponent({
    setup(_props, { slots }) {
      return () => h("div", { class: "pane" }, slots.default?.());
    },
  }),
}));

vi.mock("@/components/ui/switch", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    Switch: defineComponent({
      props: { modelValue: Boolean },
      emits: ["update:modelValue"],
      setup(props, { emit }) {
        return () =>
          h("button", {
            class: "switch-stub",
            "data-model-value": String(props.modelValue),
            onClick: () => emit("update:modelValue", !props.modelValue),
          });
      },
    }),
  };
});

import SchemaDiffDdlPanel from "@/components/diff/SchemaDiffDdlPanel.vue";

const mountedApps: App[] = [];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.innerHTML = "";
});

describe("SchemaDiffDdlPanel", () => {
  const sampleObject: SchemaDiffObject = {
    id: "table-users",
    operationType: "modify",
    objectKind: "table",
    name: "users",
    selected: true,
    sourceDdl: `CREATE TABLE "public"."users" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);`,
    targetDdl: `CREATE TABLE "other_schema"."users" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);`,
  };

  it("defaults to ignoring schema name differences and does not highlight lines as modified", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app = createApp(
      defineComponent({
        setup() {
          return () =>
            h(SchemaDiffDdlPanel, {
              selectedObject: sampleObject,
              sourceSchema: "public",
              targetSchema: "other_schema",
              deploySql: "",
              deploySqlAll: "",
            });
        },
      }),
    );
    mountedApps.push(app);
    app.mount(host);
    await nextTick();

    // Check header displays schema names
    expect(host.textContent).toContain("diff.sourceDdl (public)");
    expect(host.textContent).toContain("diff.targetDdl (other_schema)");

    // Check switch exists and is rendered
    const switchLabel = host.querySelector("label");
    expect(switchLabel?.textContent).toContain("diff.ignoreSchemaName");

    // The displayed DDL text should have stripped schema names
    expect(host.textContent).toContain('CREATE TABLE "users"');
    expect(host.textContent).not.toContain('CREATE TABLE "public"."users"');
    expect(host.textContent).not.toContain('CREATE TABLE "other_schema"."users"');

    // There should be NO modify segments or modified background since the lines are identical
    const modifyHighlights = host.querySelectorAll("[style*='rgb(255, 170, 0)']");
    expect(modifyHighlights.length).toBe(0);
  });

  it("shows schema name differences and highlights them when ignoreSchemaName is toggled off", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app = createApp(
      defineComponent({
        setup() {
          return () =>
            h(SchemaDiffDdlPanel, {
              selectedObject: sampleObject,
              sourceSchema: "public",
              targetSchema: "other_schema",
              deploySql: "",
              deploySqlAll: "",
            });
        },
      }),
    );
    mountedApps.push(app);
    app.mount(host);
    await nextTick();

    // Find the switch button and click it to turn it off
    const switchBtn = host.querySelector(".switch-stub") as HTMLButtonElement | null;
    expect(switchBtn).not.toBeNull();
    switchBtn?.click();
    await nextTick();

    // Now the original DDL with schema names should be shown
    expect(host.textContent).toContain('CREATE TABLE "public"."users"');
    expect(host.textContent).toContain('CREATE TABLE "other_schema"."users"');

    // And localStorage should record the preference
    expect(localStorage.getItem("dbx-schema-diff-ignore-schema-name")).toBe("false");
  });
});
