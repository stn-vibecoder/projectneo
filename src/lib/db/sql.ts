import type { Transaction } from "@electric-sql/pglite";

export type Sql = {
  /** Rå rader. Datoer må castes til ::text i SQL-en. */
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Rader valgt som `to_jsonb(...) as row`: datoer og lister kommer riktig ut. */
  rows<T>(text: string, params?: unknown[]): Promise<T[]>;
  /** Første rad (`as row`) eller null. */
  row<T>(text: string, params?: unknown[]): Promise<T | null>;
};

export function wrap(tx: Pick<Transaction, "query">): Sql {
  const query = async <T>(text: string, params: unknown[] = []) => (await tx.query<T>(text, params)).rows;
  return {
    query,
    rows: async <T>(text: string, params: unknown[] = []) =>
      (await query<{ row: T }>(text, params)).map((r) => r.row),
    row: async <T>(text: string, params: unknown[] = []) => (await query<{ row: T }>(text, params))[0]?.row ?? null,
  };
}

/** JS-liste -> Postgres-listelitteral, f.eks. ["oslo","london"] -> {"oslo","london"}. */
export function pgArray(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}
