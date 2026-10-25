// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { getSqlFileSearchMode, saveSqlFileSearchMode, DEFAULT_SQL_FILE_SEARCH_MODE } from "@/lib/sql/sqlFileTreeFilter";
import { getSavedSqlSearchMode, saveSavedSqlSearchMode, DEFAULT_SAVED_SQL_SEARCH_MODE } from "@/lib/savedSql/savedSqlSearch";

describe("search mode persistence (#13412)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("SQL file search mode", () => {
    it("defaults to name mode when nothing is stored", () => {
      expect(getSqlFileSearchMode()).toBe(DEFAULT_SQL_FILE_SEARCH_MODE);
      expect(getSqlFileSearchMode()).toBe("name");
    });

    it("persists and retrieves content mode", () => {
      expect(saveSqlFileSearchMode("content")).toBe(true);
      expect(getSqlFileSearchMode()).toBe("content");
    });

    it("persists and retrieves name mode", () => {
      saveSqlFileSearchMode("content");
      expect(saveSqlFileSearchMode("name")).toBe(true);
      expect(getSqlFileSearchMode()).toBe("name");
    });

    it("falls back to default if stored value is invalid", () => {
      localStorage.setItem("dbx-sql-file-search-mode", "invalid_mode");
      expect(getSqlFileSearchMode()).toBe("name");
    });
  });

  describe("SQL library search mode", () => {
    it("defaults to name mode when nothing is stored", () => {
      expect(getSavedSqlSearchMode()).toBe(DEFAULT_SAVED_SQL_SEARCH_MODE);
      expect(getSavedSqlSearchMode()).toBe("name");
    });

    it("persists and retrieves content mode", () => {
      expect(saveSavedSqlSearchMode("content")).toBe(true);
      expect(getSavedSqlSearchMode()).toBe("content");
    });

    it("persists and retrieves name mode", () => {
      saveSavedSqlSearchMode("content");
      expect(saveSavedSqlSearchMode("name")).toBe(true);
      expect(getSavedSqlSearchMode()).toBe("name");
    });

    it("falls back to default if stored value is invalid", () => {
      localStorage.setItem("dbx-saved-sql-search-mode", "unknown");
      expect(getSavedSqlSearchMode()).toBe("name");
    });
  });
});
