import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES, defaultSqlVariableSyntaxToggles, enabledSqlParameterSyntaxes, isOracleSubstitutionDatabase, normalizeSqlVariableSyntaxOverrides, resolveSqlVariableSyntaxToggles } from "@/lib/sql/sqlVariableSyntax";

describe("isOracleSubstitutionDatabase", () => {
  it("identifies Oracle and Oracle-compatible databases", () => {
    expect(isOracleSubstitutionDatabase("oracle")).toBe(true);
    expect(isOracleSubstitutionDatabase("oceanbase-oracle")).toBe(true);
    expect(isOracleSubstitutionDatabase("dameng")).toBe(true);
    expect(isOracleSubstitutionDatabase("yashandb")).toBe(true);
    expect(isOracleSubstitutionDatabase("oscar")).toBe(true);
  });

  it("checks compatibility modes for openGauss and Kingbase", () => {
    expect(isOracleSubstitutionDatabase("opengauss", "A")).toBe(true);
    expect(isOracleSubstitutionDatabase("opengauss", "a")).toBe(true);
    expect(isOracleSubstitutionDatabase("opengauss", "PG")).toBe(false);
    expect(isOracleSubstitutionDatabase("opengauss", undefined)).toBe(false);

    expect(isOracleSubstitutionDatabase("gaussdb", "A")).toBe(true);
    expect(isOracleSubstitutionDatabase("gaussdb", "B")).toBe(false);

    expect(isOracleSubstitutionDatabase("kingbase", "oracle")).toBe(true);
    expect(isOracleSubstitutionDatabase("kingbase", "ORACLE")).toBe(true);
    expect(isOracleSubstitutionDatabase("kingbase", "pg")).toBe(false);
    expect(isOracleSubstitutionDatabase("kingbase", undefined)).toBe(false);
  });

  it("returns false for non-Oracle database types or undefined", () => {
    expect(isOracleSubstitutionDatabase("mysql")).toBe(false);
    expect(isOracleSubstitutionDatabase("postgres")).toBe(false);
    expect(isOracleSubstitutionDatabase("sqlserver")).toBe(false);
    expect(isOracleSubstitutionDatabase("sqlite")).toBe(false);
    expect(isOracleSubstitutionDatabase(undefined)).toBe(false);
  });
});

describe("defaultSqlVariableSyntaxToggles", () => {
  it("defaults substitution to false for generic, MySQL, PostgreSQL, etc.", () => {
    expect(defaultSqlVariableSyntaxToggles("mysql")).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
    expect(defaultSqlVariableSyntaxToggles("postgres")).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
    expect(defaultSqlVariableSyntaxToggles("sqlserver")).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
    expect(defaultSqlVariableSyntaxToggles(undefined)).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
  });

  it("defaults substitution to true for Oracle-compatible databases", () => {
    expect(defaultSqlVariableSyntaxToggles("oracle").substitution).toBe(true);
    expect(defaultSqlVariableSyntaxToggles("oceanbase-oracle").substitution).toBe(true);
    expect(defaultSqlVariableSyntaxToggles("dameng").substitution).toBe(true);
    expect(defaultSqlVariableSyntaxToggles("yashandb").substitution).toBe(true);
    expect(defaultSqlVariableSyntaxToggles("oscar").substitution).toBe(true);
    expect(defaultSqlVariableSyntaxToggles("opengauss", "A").substitution).toBe(true);
    expect(defaultSqlVariableSyntaxToggles("kingbase", "oracle").substitution).toBe(true);
  });

  it("defaults named to false for Neo4j and NebulaGraph", () => {
    expect(defaultSqlVariableSyntaxToggles("neo4j").named).toBe(false);
    expect(defaultSqlVariableSyntaxToggles("nebula").named).toBe(false);
  });
});

describe("resolveSqlVariableSyntaxToggles", () => {
  it("enables default syntaxes when there are no overrides", () => {
    expect(resolveSqlVariableSyntaxToggles(undefined, "mysql")).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
    expect(resolveSqlVariableSyntaxToggles({}, "mysql")).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
  });

  it("enables database-specific defaults for Oracle without overrides", () => {
    const oracleToggles = resolveSqlVariableSyntaxToggles(undefined, "oracle");
    expect(oracleToggles.substitution).toBe(true);
    expect(oracleToggles.named).toBe(true);
  });

  it("enables every syntax for a database type without an entry", () => {
    expect(resolveSqlVariableSyntaxToggles({ mysql: { shell: false } }, "postgres")).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
  });

  it("disables SQL-style named parameters for Neo4j patterns", () => {
    const toggles = resolveSqlVariableSyntaxToggles(undefined, "neo4j");
    expect(toggles).toEqual({ ...DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES, named: false });
    expect(enabledSqlParameterSyntaxes(toggles)).not.toContain("named");
    expect(resolveSqlVariableSyntaxToggles({ neo4j: { shell: false } }, "neo4j")).toEqual({ ...toggles, shell: false });
  });

  it("disables SQL named placeholders for NebulaGraph", () => {
    const toggles = resolveSqlVariableSyntaxToggles(undefined, "nebula");
    expect(toggles).toEqual({ ...DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES, named: false });
    expect(enabledSqlParameterSyntaxes(toggles)).not.toContain("named");
    expect(resolveSqlVariableSyntaxToggles(undefined, "mysql").named).toBe(true);
  });

  it("enables default syntaxes when the database type is unknown", () => {
    expect(resolveSqlVariableSyntaxToggles({ mysql: { shell: false } }, undefined)).toEqual(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES);
  });

  it("applies only the overridden syntaxes for the matching database type", () => {
    expect(resolveSqlVariableSyntaxToggles({ mysql: { sqlserver: false, atSet: false } }, "mysql")).toEqual({
      positional: true,
      named: true,
      shell: true,
      mybatis: true,
      sqlserver: false,
      substitution: false,
      atSet: false,
    });
  });

  it("allows user to explicitly override substitution on non-Oracle and Oracle databases", () => {
    // Explicitly enabling substitution on PostgreSQL
    expect(resolveSqlVariableSyntaxToggles({ postgres: { substitution: true } }, "postgres").substitution).toBe(true);
    // Explicitly disabling substitution on Oracle
    expect(resolveSqlVariableSyntaxToggles({ oracle: { substitution: false } }, "oracle").substitution).toBe(false);
  });

  it("disables every syntax when substitution is globally disabled", () => {
    expect(resolveSqlVariableSyntaxToggles({ mysql: { shell: false } }, "mysql", false)).toEqual({
      positional: false,
      named: false,
      shell: false,
      mybatis: false,
      sqlserver: false,
      substitution: false,
      atSet: false,
    });
    expect(resolveSqlVariableSyntaxToggles(undefined, "oracle", false)).toEqual({
      positional: false,
      named: false,
      shell: false,
      mybatis: false,
      sqlserver: false,
      substitution: false,
      atSet: false,
    });
  });

  it("restores per-database overrides when substitution is re-enabled", () => {
    const overrides = { mysql: { shell: false as const, atSet: false as const } };

    resolveSqlVariableSyntaxToggles(overrides, "mysql", false);

    expect(resolveSqlVariableSyntaxToggles(overrides, "mysql", true)).toEqual({
      positional: true,
      named: true,
      shell: false,
      mybatis: true,
      sqlserver: true,
      substitution: false,
      atSet: false,
    });
    expect(overrides).toEqual({ mysql: { shell: false, atSet: false } });
  });
});

describe("enabledSqlParameterSyntaxes", () => {
  it("returns the five default placeholder syntaxes for generic databases and never atSet", () => {
    expect(enabledSqlParameterSyntaxes(DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES)).toEqual(["positional", "named", "shell", "mybatis", "sqlserver"]);
  });

  it("returns all six placeholder syntaxes when substitution is enabled", () => {
    expect(enabledSqlParameterSyntaxes({ ...DEFAULT_SQL_VARIABLE_SYNTAX_TOGGLES, substitution: true })).toEqual(["positional", "named", "shell", "mybatis", "sqlserver", "substitution"]);
  });

  it("filters out disabled placeholder syntaxes", () => {
    expect(enabledSqlParameterSyntaxes({ positional: false, named: true, shell: false, mybatis: true, sqlserver: false, substitution: true, atSet: true })).toEqual(["named", "mybatis", "substitution"]);
  });

  it("ignores the atSet toggle entirely", () => {
    expect(enabledSqlParameterSyntaxes({ positional: true, named: true, shell: true, mybatis: true, sqlserver: true, substitution: true, atSet: false })).toEqual(["positional", "named", "shell", "mybatis", "sqlserver", "substitution"]);
    expect(enabledSqlParameterSyntaxes({ positional: false, named: false, shell: false, mybatis: false, sqlserver: false, substitution: false, atSet: true })).toEqual([]);
  });
});

describe("normalizeSqlVariableSyntaxOverrides", () => {
  it("returns an empty object for non-object input", () => {
    expect(normalizeSqlVariableSyntaxOverrides(undefined)).toEqual({});
    expect(normalizeSqlVariableSyntaxOverrides(null)).toEqual({});
    expect(normalizeSqlVariableSyntaxOverrides([])).toEqual({});
    expect(normalizeSqlVariableSyntaxOverrides("mysql")).toEqual({});
  });

  it("keeps only syntaxes that deviate from defaults", () => {
    expect(
      normalizeSqlVariableSyntaxOverrides({
        mysql: { positional: true, shell: false, substitution: false, atSet: false },
        postgres: { substitution: true },
        oracle: { substitution: false, shell: true },
      }),
    ).toEqual({
      mysql: { shell: false, atSet: false },
      postgres: { substitution: true },
      oracle: { substitution: false },
    });
  });

  it("drops entries with no deviating syntaxes", () => {
    expect(normalizeSqlVariableSyntaxOverrides({ mysql: { positional: true, substitution: false }, postgres: {} })).toEqual({});
    expect(normalizeSqlVariableSyntaxOverrides({ oracle: { positional: true, substitution: true } })).toEqual({});
  });

  it("ignores non-boolean values and unknown keys", () => {
    expect(normalizeSqlVariableSyntaxOverrides({ mysql: { shell: "false", named: 0, bogus: false, sqlserver: false } })).toEqual({ mysql: { sqlserver: false } });
  });

  it("skips non-object database entries", () => {
    expect(normalizeSqlVariableSyntaxOverrides({ mysql: null, postgres: [], sqlserver: { shell: false } })).toEqual({ sqlserver: { shell: false } });
  });

  it("is stable across a round-trip", () => {
    const normalized = normalizeSqlVariableSyntaxOverrides({
      mysql: { shell: false },
      postgres: { substitution: true },
      oracle: { atSet: false, substitution: false },
    });
    expect(normalizeSqlVariableSyntaxOverrides(normalized)).toEqual(normalized);
  });

  it("reads through a Vue reactive proxy without throwing (settings store is reactive; structuredClone would throw DataCloneError here)", () => {
    const overrides = reactive({ mysql: { shell: false, atSet: false }, postgres: { substitution: true } });
    const cloned = normalizeSqlVariableSyntaxOverrides(overrides);
    expect(cloned).toEqual({ mysql: { shell: false, atSet: false }, postgres: { substitution: true } });
    // Detached from the reactive source: mutating the clone must not touch the proxy.
    cloned.mysql = {};
    expect(overrides.mysql).toEqual({ shell: false, atSet: false });
  });
});
