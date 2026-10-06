import type { SqlInsertDialect, SqlInsertMode } from "./sqlInsertMode";

export interface DatabaseExportSavedOptions {
  includeStructure: boolean;
  includeData: boolean;
  insertDialect: SqlInsertDialect;
  insertMode: SqlInsertMode;
  includeObjects: boolean;
  includeCreateDatabase: boolean;
  dropTableIfExists: boolean;
  omitAutoIncrement: boolean;
  preserveOriginalLanguage: boolean;
  splitSqlOutput: boolean;
  splitSqlPartMaxMb: number;
}

export const DEFAULT_DATABASE_EXPORT_OPTIONS: DatabaseExportSavedOptions = {
  includeStructure: true,
  includeData: true,
  insertDialect: "source",
  insertMode: "batch",
  includeObjects: true,
  includeCreateDatabase: false,
  dropTableIfExists: false,
  omitAutoIncrement: false,
  preserveOriginalLanguage: false,
  splitSqlOutput: false,
  splitSqlPartMaxMb: 100,
};

export const DATABASE_EXPORT_OPTIONS_STORAGE_KEY = "dbx-database-export-last-options";

export function loadSavedDatabaseExportOptions(storage?: Pick<Storage, "getItem">): DatabaseExportSavedOptions {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    if (!store) return { ...DEFAULT_DATABASE_EXPORT_OPTIONS };

    const raw = store.getItem(DATABASE_EXPORT_OPTIONS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATABASE_EXPORT_OPTIONS };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_DATABASE_EXPORT_OPTIONS };

    return {
      includeStructure: typeof parsed.includeStructure === "boolean" ? parsed.includeStructure : DEFAULT_DATABASE_EXPORT_OPTIONS.includeStructure,
      includeData: typeof parsed.includeData === "boolean" ? parsed.includeData : DEFAULT_DATABASE_EXPORT_OPTIONS.includeData,
      insertDialect: parsed.insertDialect === "standard" ? "standard" : "source",
      insertMode: parsed.insertMode === "single" ? "single" : "batch",
      includeObjects: typeof parsed.includeObjects === "boolean" ? parsed.includeObjects : DEFAULT_DATABASE_EXPORT_OPTIONS.includeObjects,
      includeCreateDatabase: typeof parsed.includeCreateDatabase === "boolean" ? parsed.includeCreateDatabase : DEFAULT_DATABASE_EXPORT_OPTIONS.includeCreateDatabase,
      dropTableIfExists: typeof parsed.dropTableIfExists === "boolean" ? parsed.dropTableIfExists : DEFAULT_DATABASE_EXPORT_OPTIONS.dropTableIfExists,
      omitAutoIncrement: typeof parsed.omitAutoIncrement === "boolean" ? parsed.omitAutoIncrement : DEFAULT_DATABASE_EXPORT_OPTIONS.omitAutoIncrement,
      preserveOriginalLanguage: typeof parsed.preserveOriginalLanguage === "boolean" ? parsed.preserveOriginalLanguage : DEFAULT_DATABASE_EXPORT_OPTIONS.preserveOriginalLanguage,
      splitSqlOutput: typeof parsed.splitSqlOutput === "boolean" ? parsed.splitSqlOutput : DEFAULT_DATABASE_EXPORT_OPTIONS.splitSqlOutput,
      splitSqlPartMaxMb: typeof parsed.splitSqlPartMaxMb === "number" && Number.isFinite(parsed.splitSqlPartMaxMb) ? Math.min(4096, Math.max(1, Math.round(parsed.splitSqlPartMaxMb))) : DEFAULT_DATABASE_EXPORT_OPTIONS.splitSqlPartMaxMb,
    };
  } catch {
    return { ...DEFAULT_DATABASE_EXPORT_OPTIONS };
  }
}

export function saveDatabaseExportOptions(options: Partial<DatabaseExportSavedOptions>, storage?: Pick<Storage, "setItem" | "getItem">): void {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    if (!store) return;

    const current = loadSavedDatabaseExportOptions(store);
    const updated: DatabaseExportSavedOptions = {
      ...current,
      ...options,
    };
    store.setItem(DATABASE_EXPORT_OPTIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write failures (quota exceeded, private browsing, etc.)
  }
}

export function sortDatabaseTableNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b));
}
