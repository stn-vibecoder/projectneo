import type { Industry } from "@/lib/domain";

export const SOURCE_TYPES = [
  "greenhouse",
  "lever",
  "ashby",
  "teamtailor",
  "bamboohr",
  "nhhs",
  "bindeleddet",
  "nav",
  "jobtech",
  "adzuna",
] as const;
/** «manual» = lenke som følges manuelt (hentes ikke). */
export type AnySourceType = SourceType | "manual";
export type SourceType = (typeof SOURCE_TYPES)[number];

export function isSourceType(v: string): v is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(v);
}

/** Det adapterne trenger å vite om en kilde. */
export type SourceConfig = {
  id: string;
  type: SourceType;
  identifier: string;
  name: string;
  url: string | null;
  industry: Industry | null;
  state: Record<string, unknown>;
};

/** Én stilling slik kilden beskriver den, før normalisering. */
export type RawPosting = {
  externalId: string;
  title: string;
  company: string;
  /** Fritekst om sted, f.eks. «London, UK» eller «Oslo / Stockholm». */
  locations: string[];
  url: string | null;
  applyUrl?: string | null;
  description?: string | null; // ren tekst
  deadline?: string | null; // YYYY-MM-DD
  /** Kilden sier selv at dette er internship/sommerjobb/trainee. */
  internshipHint?: boolean;
  industry?: Industry | null;
};

export type AdapterResult = {
  postings: RawPosting[];
  /**
   * true: lista er fullstendig, så stillinger som mangler kan stenges.
   * false: inkrementell feed (NAV) – bare `removedIds` stenges.
   */
  complete: boolean;
  removedIds?: string[];
  /** Ny tilstand som lagres på kilden (f.eks. hvor i feeden vi er). */
  state?: Record<string, unknown>;
  /** Antall stillinger i kilden totalt (til statistikk), hvis kjent. */
  total?: number;
};

export type Adapter = {
  type: SourceType;
  fetch(source: SourceConfig): Promise<AdapterResult>;
};
