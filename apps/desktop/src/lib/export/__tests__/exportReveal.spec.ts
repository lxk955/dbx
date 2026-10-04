import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldAutoRevealExportedFile, revealExportedFile, notifyExportComplete } from "@/lib/export/exportReveal";

const mocks = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(),
  revealPathInFileManager: vi.fn(),
  editorSettings: {
    autoRevealExportedFile: false,
  },
}));

vi.mock("@/lib/backend/tauriRuntime", () => ({
  isTauriRuntime: () => mocks.isTauriRuntime(),
}));

vi.mock("@/lib/backend/api", () => ({
  revealPathInFileManager: (...args: unknown[]) => mocks.revealPathInFileManager(...args),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: () => ({
    editorSettings: mocks.editorSettings,
  }),
}));

describe("exportReveal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauriRuntime.mockReturnValue(true);
    mocks.revealPathInFileManager.mockResolvedValue(undefined);
    mocks.editorSettings.autoRevealExportedFile = false;
    (mocks.editorSettings as any).autoOpenExportFolder = false;
  });

  describe("shouldAutoRevealExportedFile", () => {
    it("returns false when not running under Tauri", () => {
      mocks.isTauriRuntime.mockReturnValue(false);
      mocks.editorSettings.autoRevealExportedFile = true;
      expect(shouldAutoRevealExportedFile()).toBe(false);
    });

    it("returns false when autoRevealExportedFile setting is false", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      mocks.editorSettings.autoRevealExportedFile = false;
      expect(shouldAutoRevealExportedFile()).toBe(false);
    });

    it("returns true when running under Tauri and autoRevealExportedFile setting is true", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      mocks.editorSettings.autoRevealExportedFile = true;
      expect(shouldAutoRevealExportedFile()).toBe(true);
    });

    it("returns true when running under Tauri and autoOpenExportFolder setting is true", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      mocks.editorSettings.autoRevealExportedFile = false;
      (mocks.editorSettings as any).autoOpenExportFolder = true;
      expect(shouldAutoRevealExportedFile()).toBe(true);
    });
  });

  describe("revealExportedFile", () => {
    it("returns false when path is empty or whitespace", async () => {
      expect(await revealExportedFile("")).toBe(false);
      expect(await revealExportedFile("   ")).toBe(false);
      expect(mocks.revealPathInFileManager).not.toHaveBeenCalled();
    });

    it("returns false when not running under Tauri", async () => {
      mocks.isTauriRuntime.mockReturnValue(false);
      expect(await revealExportedFile("/tmp/test.csv")).toBe(false);
      expect(mocks.revealPathInFileManager).not.toHaveBeenCalled();
    });

    it("calls api.revealPathInFileManager with trimmed path and returns true", async () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      const result = await revealExportedFile("  /path/to/exported.xlsx  ");
      expect(result).toBe(true);
      expect(mocks.revealPathInFileManager).toHaveBeenCalledWith("/path/to/exported.xlsx");
    });

    it("calls onError callback and returns false when api call rejects", async () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      const err = new Error("File not found");
      mocks.revealPathInFileManager.mockRejectedValueOnce(err);
      const onError = vi.fn();

      const result = await revealExportedFile("/tmp/file.sql", onError);
      expect(result).toBe(false);
      expect(onError).toHaveBeenCalledWith(err);
    });

    it("logs warning and returns false when api call rejects without onError", async () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      mocks.revealPathInFileManager.mockRejectedValueOnce(new Error("Permission denied"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await revealExportedFile("/tmp/file.sql");
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith("Failed to reveal exported file in file manager:", expect.any(Error));
      warnSpy.mockRestore();
    });
  });

  describe("notifyExportComplete", () => {
    it("shows toast without action when running in web environment", () => {
      mocks.isTauriRuntime.mockReturnValue(false);
      const toast = vi.fn();

      notifyExportComplete({
        filePath: "/tmp/exported.csv",
        message: "Exported",
        openFolderLabel: "Open Folder",
        toast,
      });

      expect(toast).toHaveBeenCalledWith("Exported");
      expect(mocks.revealPathInFileManager).not.toHaveBeenCalled();
    });

    it("shows toast without action when filePath is omitted or null", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      const toast = vi.fn();

      notifyExportComplete({
        filePath: null,
        message: "Exported",
        openFolderLabel: "Open Folder",
        toast,
      });

      expect(toast).toHaveBeenCalledWith("Exported");
      expect(mocks.revealPathInFileManager).not.toHaveBeenCalled();
    });

    it("shows toast with action button in Tauri and does not auto-reveal when setting is off", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      mocks.editorSettings.autoRevealExportedFile = false;
      const toast = vi.fn();

      notifyExportComplete({
        filePath: "/path/to/result.csv",
        message: "Exported",
        openFolderLabel: "Open Containing Folder",
        toast,
      });

      expect(mocks.revealPathInFileManager).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        "Exported",
        4000,
        expect.objectContaining({
          label: "Open Containing Folder",
          onClick: expect.any(Function),
        }),
      );

      // Clicking the action reveals the file
      const action = toast.mock.calls[0][2];
      action.onClick();
      expect(mocks.revealPathInFileManager).toHaveBeenCalledWith("/path/to/result.csv");
    });

    it("auto-reveals the file when autoRevealExportedFile is enabled", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      mocks.editorSettings.autoRevealExportedFile = true;
      const toast = vi.fn();

      notifyExportComplete({
        filePath: "/path/to/result.xlsx",
        message: "Exported",
        openFolderLabel: "Open Containing Folder",
        toast,
      });

      expect(mocks.revealPathInFileManager).toHaveBeenCalledWith("/path/to/result.xlsx");
      expect(toast).toHaveBeenCalledWith(
        "Exported",
        4000,
        expect.objectContaining({
          label: "Open Containing Folder",
        }),
      );
    });

    it("respects custom duration if provided", () => {
      mocks.isTauriRuntime.mockReturnValue(true);
      const toast = vi.fn();

      notifyExportComplete({
        filePath: "/path/to/result.sql",
        message: "Exported",
        openFolderLabel: "Open Folder",
        toast,
        duration: 8000,
      });

      expect(toast).toHaveBeenCalledWith("Exported", 8000, expect.any(Object));
    });
  });
});
