/**
 * Statuslogikk for søknadstrackeren. Rene funksjoner uten I/O, så de
 * kan testes isolert (se status-logic.test.ts).
 *
 * Brukeren kan ha egendefinerte statuser, men hver status har en fast
 * kategori. All statistikk regnes på kategoriene.
 */
import type { StatusCategory } from "@/lib/domain";
import { daysBetween, daysSince } from "./dates";

// Trinn i trakten. Avslag og trukket har ikke eget trinn: der teller
// det høyeste trinnet søknaden nådde før den ble avsluttet.
const STAGE: Record<StatusCategory, number | null> = {
  saved: 0,
  applied: 1,
  screening: 2,
  interview: 3,
  assessment: 4,
  offer: 5,
  accepted: 6,
  declined: 5,
  rejected: null,
  withdrawn: null,
};

export const FUNNEL_STAGES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "accepted",
] as const satisfies readonly StatusCategory[];

const CLOSED: ReadonlySet<StatusCategory> = new Set(["accepted", "declined", "rejected", "withdrawn"]);

export function isClosedCategory(c: StatusCategory) {
  return CLOSED.has(c);
}

export function isActiveCategory(c: StatusCategory) {
  return !CLOSED.has(c);
}

/** Høyeste trakt-trinn søknaden har vært innom (fra historikk + nåværende status). */
export function highestStage(current: StatusCategory, history: readonly (StatusCategory | null)[] = []): number {
  let best = STAGE[current] ?? -1;
  for (const c of history) {
    if (!c) continue;
    const s = STAGE[c];
    if (s !== null && s > best) best = s;
  }
  // Avslag uten historikk betyr at man i det minste hadde søkt.
  if (best < 1 && current === "rejected") best = 1;
  return best;
}

export type StatusChangeInput = {
  currentStatusId: string;
  currentCategory: StatusCategory;
  appliedAt: string | null;
};

export type StatusChangePatch = {
  status_id: string;
  last_activity_at: string;
  applied_at?: string;
};

/**
 * Hva som skal oppdateres når en søknad flyttes til en ny status.
 * - Søknadsdato settes automatisk første gang søknaden forlater "Lagret",
 *   med mindre den bare trekkes før man har søkt.
 * - Returnerer null hvis statusen ikke endres.
 */
export function computeStatusChange(
  input: StatusChangeInput,
  next: { id: string; category: StatusCategory },
  now: Date,
  today: string,
): StatusChangePatch | null {
  if (next.id === input.currentStatusId) return null;

  const patch: StatusChangePatch = {
    status_id: next.id,
    last_activity_at: now.toISOString(),
  };

  const leavesSaved = next.category !== "saved" && !(input.currentCategory === "saved" && next.category === "withdrawn");
  if (!input.appliedAt && leavesSaved) {
    patch.applied_at = today;
  }
  return patch;
}

/** Posisjon mellom to kort på kanban-tavlen (fraksjonell rekkefølge). */
export function positionBetween(before?: number | null, after?: number | null): number {
  const hasBefore = typeof before === "number";
  const hasAfter = typeof after === "number";
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + 1;
  if (hasAfter) return after - 1;
  return 0;
}

// ---------------------------------------------------------------------
// Dashboard-beregninger
// ---------------------------------------------------------------------

export type AppForMetrics = {
  id: string;
  category: StatusCategory;
  history: readonly (StatusCategory | null)[];
  appliedAt: string | null;
  lastActivityAt: string;
  deadline: string | null; // effektiv frist (søknad overstyrer stilling)
  nextStepAt: string | null;
  archived?: boolean;
};

export function hasApplied(app: Pick<AppForMetrics, "category" | "history" | "appliedAt">): boolean {
  return app.appliedAt !== null || highestStage(app.category, app.history) >= 1;
}

/** Har arbeidsgiveren svart? Avslag teller også som svar. */
export function hasResponse(app: Pick<AppForMetrics, "category" | "history">): boolean {
  return app.category === "rejected" || highestStage(app.category, app.history) >= 2;
}

export type Metrics = {
  total: number;
  saved: number;
  applied: number;
  responded: number;
  responseRate: number | null; // 0..1, null hvis ingen søkt
  rejected: number;
  interviews: number;
  offers: number;
  accepted: number;
  active: number;
  funnel: { stage: (typeof FUNNEL_STAGES)[number]; count: number }[];
};

export function computeMetrics(apps: readonly AppForMetrics[]): Metrics {
  const list = apps.filter((a) => !a.archived);
  const stages = list.map((a) => highestStage(a.category, a.history));
  const applied = list.filter(hasApplied);
  const responded = applied.filter(hasResponse);

  return {
    total: list.length,
    saved: list.filter((a) => a.category === "saved").length,
    applied: applied.length,
    responded: responded.length,
    responseRate: applied.length ? responded.length / applied.length : null,
    rejected: list.filter((a) => a.category === "rejected").length,
    interviews: stages.filter((s) => s >= 3).length,
    offers: stages.filter((s) => s >= 5).length,
    accepted: list.filter((a) => a.category === "accepted").length,
    active: list.filter((a) => isActiveCategory(a.category) && hasApplied(a)).length,
    funnel: FUNNEL_STAGES.map((stage, i) => ({
      stage,
      count: stages.filter((s) => s >= i).length,
    })),
  };
}

/**
 * "Ikke hørt noe": søkt, fortsatt aktiv, ikke et tilbud man selv skal
 * svare på, ingen planlagte steg fremover, og ingen aktivitet på X dager.
 */
export function isGhosted(app: AppForMetrics, ghostingDays: number, today: string): boolean {
  if (app.archived) return false;
  if (!isActiveCategory(app.category) || app.category === "offer" || app.category === "saved") return false;
  if (!hasApplied(app)) return false;
  if (app.nextStepAt && daysBetween(today, app.nextStepAt) >= 0) return false;
  return daysSince(app.lastActivityAt, today) >= ghostingDays;
}

export function ghostedApplications<T extends AppForMetrics>(apps: readonly T[], ghostingDays: number, today: string): T[] {
  return apps
    .filter((a) => isGhosted(a, ghostingDays, today))
    .sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt));
}

/** Lagrede (ikke søkte) søknader med frist innen `withinDays` dager, tidligst først. */
export function upcomingDeadlines<T extends AppForMetrics>(apps: readonly T[], today: string, withinDays = 14): T[] {
  return apps
    .filter((a) => !a.archived && a.category === "saved" && a.deadline)
    .filter((a) => {
      const d = daysBetween(today, a.deadline!);
      return d >= 0 && d <= withinDays;
    })
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
}

/** Aktive søknader med neste steg innen `withinDays` dager (inkl. forfalte). */
export function upcomingNextSteps<T extends AppForMetrics>(apps: readonly T[], today: string, withinDays = 14): T[] {
  return apps
    .filter((a) => !a.archived && isActiveCategory(a.category) && a.nextStepAt)
    .filter((a) => daysBetween(today, a.nextStepAt!) <= withinDays)
    .sort((a, b) => a.nextStepAt!.localeCompare(b.nextStepAt!));
}

export function effectiveDeadline(app: { deadline: string | null }, job: { deadline: string | null }) {
  return app.deadline ?? job.deadline;
}

// ---------------------------------------------------------------------
// Forventede tilbud (sannsynlighetsvektet pipeline)
// ---------------------------------------------------------------------

/**
 * Utgangspunkt: sannsynlighet for at en søknad på et gitt trinn ender i
 * tilbud. Grove anslag for konkurranseutsatte internships; erstattes av
 * brukerens egne tall når det finnes nok historikk (se under).
 */
export const BASE_OFFER_PROBABILITY: Partial<Record<StatusCategory, number>> = {
  applied: 0.05,
  screening: 0.12,
  interview: 0.3,
  assessment: 0.5,
  offer: 1,
};

/** Minste antall søknader som må ha nådd et trinn før egne tall brukes. */
export const MIN_SAMPLE = 8;

/**
 * Forventet antall tilbud fra aktive søknader. For hvert trinn brukes
 * brukerens egen andel (tilbud / nådd trinnet) hvis minst MIN_SAMPLE
 * søknader har nådd det, ellers standardanslaget.
 */
export function expectedOffers(apps: readonly AppForMetrics[]): { expected: number; calibrated: boolean } {
  const list = apps.filter((a) => !a.archived);
  const stages = list.map((a) => highestStage(a.category, a.history));
  const reached = (stage: number) => stages.filter((s) => s >= stage).length;
  const offers = reached(5);

  let calibrated = false;
  let expected = 0;
  for (const a of list) {
    if (!isActiveCategory(a.category) || a.category === "saved") continue;
    const base = BASE_OFFER_PROBABILITY[a.category];
    if (base === undefined) continue;
    const stage = STAGE[a.category]!;
    const n = reached(stage);
    if (a.category !== "offer" && n >= MIN_SAMPLE) {
      calibrated = true;
      expected += offers / n;
    } else {
      expected += base;
    }
  }
  return { expected: Math.round(expected * 10) / 10, calibrated };
}
