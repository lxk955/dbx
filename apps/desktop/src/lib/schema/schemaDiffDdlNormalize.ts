function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferSchemaFromSql(sql: string): string | null {
  if (!sql) return null;
  const match = sql.match(
    /\b(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+|UNLOGGED\s+)?(?:TABLE|VIEW|SEQUENCE|FUNCTION|PROCEDURE|TRIGGER)|ALTER\s+TABLE(?:\s+ONLY)?|COMMENT\s+ON\s+(?:TABLE|COLUMN|INDEX|CONSTRAINT))\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)")|(?:`([^`]+)`)|(?:\[([^\]]+)\])|([a-zA-Z0-9_]+))\s*\./i,
  );
  if (!match) return null;
  return match[1] || match[2] || match[3] || match[4] || null;
}

export function stripSchemaFromSql(sql: string, schema?: string): string {
  if (!sql) return "";

  const targetSchemas: string[] = [];
  if (schema && schema.trim()) {
    targetSchemas.push(schema.trim());
  } else {
    const inferred = inferSchemaFromSql(sql);
    if (inferred) targetSchemas.push(inferred);
  }

  if (targetSchemas.length === 0) return sql;

  function replaceInText(text: string): string {
    let result = text;
    for (const s of targetSchemas) {
      const esc = escapeRegExp(s);
      // 1. Quoted with double quotes: "schema".
      result = result.replace(new RegExp(`"${esc}"\\s*\\.`, "gi"), "");
      // 2. Quoted with backticks: `schema`.
      result = result.replace(new RegExp(`\`${esc}\`\\s*\\.`, "gi"), "");
      // 3. Quoted with brackets: [schema].
      result = result.replace(new RegExp(`\\[${esc}\\]\\s*\\.`, "gi"), "");
      // 4. Unquoted: schema. (preceded by non-identifier character or start of string)
      result = result.replace(new RegExp(`(?<![\\w."\`\\[])${esc}\\s*\\.`, "gi"), "");
    }
    return result;
  }

  // Tokenize SQL to protect string literals and comments:
  // - single-quoted strings: '(?:[^']|'')*'
  // - block comments: /* ... */
  // - line comments: -- ...
  // - PostgreSQL dollar-quoted strings: $tag$ ... $tag$
  const tokenRegex = /(?:'(?:[^']|'')*')|(?:\/\*[\s\S]*?\*\/)|(?:--[^\r\n]*)|(?:\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$)/g;
  let out = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(sql)) !== null) {
    out += replaceInText(sql.slice(cursor, match.index));
    out += match[0];
    cursor = tokenRegex.lastIndex;
  }
  out += replaceInText(sql.slice(cursor));
  return out;
}
