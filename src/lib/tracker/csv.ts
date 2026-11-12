/**
 * CSV for norsk Excel: semikolon som skilletegn og UTF-8 med BOM,
 * så æ, ø og å vises riktig når fila åpnes direkte.
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[], sep = ";"): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Beskytt mot formel-injeksjon i regneark (=, +, -, @ først i cellen).
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) || safe.includes(sep) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(sep)).join("\r\n") + "\r\n";
}
