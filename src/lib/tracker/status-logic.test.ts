import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  computeStatusChange,
  effectiveDeadline,
  ghostedApplications,
  hasApplied,
  hasResponse,
  highestStage,
  isGhosted,
  positionBetween,
  upcomingDeadlines,
  upcomingNextSteps,
  type AppForMetrics,
} from "./status-logic";
import { daysBetween, daysSince } from "./dates";

const TODAY = "2026-11-08";
const NOW = new Date("2026-11-08T10:00:00Z");

function app(partial: Partial<AppForMetrics> & Pick<AppForMetrics, "category">): AppForMetrics {
  return {
    id: Math.random().toString(36).slice(2),
    history: [],
    appliedAt: null,
    lastActivityAt: "2026-11-01T10:00:00Z",
    deadline: null,
    nextStepAt: null,
    ...partial,
  };
}

describe("dates", () => {
  it("teller kalenderdager", () => {
    expect(daysBetween("2026-11-08", "2026-11-10")).toBe(2);
    expect(daysBetween("2026-11-10", "2026-11-08")).toBe(-2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
  it("håndterer sommertid", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
  it("dager siden et tidsstempel", () => {
    expect(daysSince("2026-11-01", TODAY)).toBe(7);
  });
});

describe("highestStage", () => {
  it("bruker nåværende kategori", () => {
    expect(highestStage("interview")).toBe(3);
  });
  it("husker høyeste trinn før avslag", () => {
    expect(highestStage("rejected", ["saved", "applied", "interview", "rejected"])).toBe(3);
  });
  it("avslag uten historikk betyr minst søkt", () => {
    expect(highestStage("rejected")).toBe(1);
  });
  it("avslått tilbud teller som tilbud", () => {
    expect(highestStage("declined")).toBe(5);
  });
  it("trukket fra lagret er fortsatt lagret", () => {
    expect(highestStage("withdrawn", ["saved", "withdrawn"])).toBe(0);
  });
});

describe("computeStatusChange", () => {
  const base = { currentStatusId: "s-saved", currentCategory: "saved" as const, appliedAt: null };

  it("returnerer null når statusen ikke endres", () => {
    expect(computeStatusChange(base, { id: "s-saved", category: "saved" }, NOW, TODAY)).toBeNull();
  });

  it("setter søknadsdato når man går fra Lagret til Søkt", () => {
    const p = computeStatusChange(base, { id: "s-applied", category: "applied" }, NOW, TODAY);
    expect(p).toEqual({ status_id: "s-applied", last_activity_at: NOW.toISOString(), applied_at: TODAY });
  });

  it("setter søknadsdato når man hopper rett til Intervju", () => {
    const p = computeStatusChange(base, { id: "s-int", category: "interview" }, NOW, TODAY);
    expect(p?.applied_at).toBe(TODAY);
  });

  it("overskriver ikke eksisterende søknadsdato", () => {
    const p = computeStatusChange(
      { currentStatusId: "s-applied", currentCategory: "applied", appliedAt: "2026-10-01" },
      { id: "s-int", category: "interview" },
      NOW,
      TODAY,
    );
    expect(p?.applied_at).toBeUndefined();
  });

  it("setter ikke søknadsdato når man trekker en lagret stilling", () => {
    const p = computeStatusChange(base, { id: "s-w", category: "withdrawn" }, NOW, TODAY);
    expect(p?.applied_at).toBeUndefined();
  });

  it("setter søknadsdato ved avslag direkte fra Lagret", () => {
    const p = computeStatusChange(base, { id: "s-r", category: "rejected" }, NOW, TODAY);
    expect(p?.applied_at).toBe(TODAY);
  });

  it("setter ikke søknadsdato ved flytting mellom to Lagret-statuser", () => {
    const p = computeStatusChange(base, { id: "s-saved-2", category: "saved" }, NOW, TODAY);
    expect(p?.applied_at).toBeUndefined();
    expect(p?.status_id).toBe("s-saved-2");
  });
});

describe("positionBetween", () => {
  it("tom kolonne", () => expect(positionBetween()).toBe(0));
  it("øverst", () => expect(positionBetween(undefined, 4)).toBe(3));
  it("nederst", () => expect(positionBetween(4, undefined)).toBe(5));
  it("mellom to kort", () => expect(positionBetween(1, 2)).toBe(1.5));
  it("håndterer null", () => expect(positionBetween(null, null)).toBe(0));
});

describe("hasApplied / hasResponse", () => {
  it("lagret er ikke søkt", () => expect(hasApplied(app({ category: "saved" }))).toBe(false));
  it("søknadsdato teller som søkt", () =>
    expect(hasApplied(app({ category: "withdrawn", appliedAt: "2026-10-01" }))).toBe(true));
  it("søkt uten svar", () => expect(hasResponse(app({ category: "applied" }))).toBe(false));
  it("online-test er svar", () => expect(hasResponse(app({ category: "screening" }))).toBe(true));
  it("avslag er svar", () => expect(hasResponse(app({ category: "rejected" }))).toBe(true));
  it("trukket etter intervju er svar", () =>
    expect(hasResponse(app({ category: "withdrawn", history: ["applied", "interview"] }))).toBe(true));
});

describe("computeMetrics", () => {
  const apps: AppForMetrics[] = [
    app({ category: "saved" }),
    app({ category: "saved" }),
    app({ category: "applied", appliedAt: "2026-10-20" }),
    app({ category: "applied", appliedAt: "2026-10-21" }),
    app({ category: "screening", appliedAt: "2026-10-10", history: ["saved", "applied", "screening"] }),
    app({ category: "interview", appliedAt: "2026-10-01", history: ["saved", "applied", "interview"] }),
    app({ category: "rejected", appliedAt: "2026-09-01", history: ["saved", "applied", "interview", "rejected"] }),
    app({ category: "rejected", appliedAt: "2026-09-05", history: ["saved", "applied", "rejected"] }),
    app({ category: "offer", appliedAt: "2026-09-01", history: ["applied", "interview", "assessment", "offer"] }),
    app({ category: "accepted", appliedAt: "2026-08-01", history: ["applied", "interview", "offer", "accepted"] }),
    app({ category: "withdrawn", history: ["saved", "withdrawn"] }),
    app({ category: "applied", appliedAt: "2026-10-01", archived: true }),
  ];
  const m = computeMetrics(apps);

  it("teller totalt uten arkiverte", () => expect(m.total).toBe(11));
  it("teller lagrede", () => expect(m.saved).toBe(2));
  it("teller søkte", () => expect(m.applied).toBe(8));
  it("teller svar (inkl. avslag)", () => expect(m.responded).toBe(6));
  it("regner svarrate", () => expect(m.responseRate).toBeCloseTo(6 / 8));
  it("teller avslag", () => expect(m.rejected).toBe(2));
  it("teller intervjuer (nådd intervju eller lenger)", () => expect(m.interviews).toBe(4));
  it("teller tilbud (inkl. takket ja)", () => expect(m.offers).toBe(2));
  it("teller takket ja", () => expect(m.accepted).toBe(1));
  it("teller aktive søkte", () => expect(m.active).toBe(5));
  it("trakten er monotont synkende", () => {
    const counts = m.funnel.map((f) => f.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    // Alle søknader har vært lagret, også den som ble trukket fra Lagret.
    expect(m.funnel[0]).toEqual({ stage: "saved", count: 11 });
    expect(m.funnel.find((f) => f.stage === "applied")?.count).toBe(8);
  });
  it("svarrate er null uten søknader", () => {
    expect(computeMetrics([app({ category: "saved" })]).responseRate).toBeNull();
  });
});

describe("isGhosted", () => {
  it("søkt for 14 dager siden uten aktivitet", () => {
    expect(isGhosted(app({ category: "applied", appliedAt: "2026-10-20", lastActivityAt: "2026-10-25T09:00:00Z" }), 14, TODAY)).toBe(true);
  });
  it("ikke før grensen er nådd", () => {
    expect(isGhosted(app({ category: "applied", appliedAt: "2026-11-01", lastActivityAt: "2026-11-01T09:00:00Z" }), 14, TODAY)).toBe(false);
  });
  it("ikke når neste steg er planlagt", () => {
    expect(isGhosted(app({ category: "interview", appliedAt: "2026-09-01", lastActivityAt: "2026-09-01T09:00:00Z", nextStepAt: "2026-11-10" }), 14, TODAY)).toBe(false);
  });
  it("forfalt neste steg hindrer ikke", () => {
    expect(isGhosted(app({ category: "interview", appliedAt: "2026-09-01", lastActivityAt: "2026-09-01T09:00:00Z", nextStepAt: "2026-10-01" }), 14, TODAY)).toBe(true);
  });
  it("ikke for lagrede, tilbud eller avsluttede", () => {
    const old = { lastActivityAt: "2026-01-01T00:00:00Z", appliedAt: "2026-01-01" };
    expect(isGhosted(app({ category: "saved", ...old }), 14, TODAY)).toBe(false);
    expect(isGhosted(app({ category: "offer", ...old }), 14, TODAY)).toBe(false);
    expect(isGhosted(app({ category: "rejected", ...old }), 14, TODAY)).toBe(false);
    expect(isGhosted(app({ category: "applied", ...old, archived: true }), 14, TODAY)).toBe(false);
  });
  it("sorterer eldste først", () => {
    const a = app({ category: "applied", appliedAt: "2026-09-01", lastActivityAt: "2026-10-01T00:00:00Z" });
    const b = app({ category: "applied", appliedAt: "2026-09-01", lastActivityAt: "2026-09-01T00:00:00Z" });
    expect(ghostedApplications([a, b], 14, TODAY).map((x) => x.id)).toEqual([b.id, a.id]);
  });
});

describe("frister og neste steg", () => {
  const apps = [
    app({ id: "a", category: "saved", deadline: "2026-11-20" }),
    app({ id: "b", category: "saved", deadline: "2026-11-09" }),
    app({ id: "c", category: "saved", deadline: "2026-11-01" }), // passert
    app({ id: "d", category: "saved", deadline: "2027-01-01" }), // for langt frem
    app({ id: "e", category: "applied", deadline: "2026-11-10", appliedAt: "2026-11-01" }), // allerede søkt
    app({ id: "f", category: "interview", nextStepAt: "2026-11-12", appliedAt: "2026-10-01" }),
    app({ id: "g", category: "interview", nextStepAt: "2026-11-05", appliedAt: "2026-10-01" }), // forfalt
    app({ id: "h", category: "rejected", nextStepAt: "2026-11-12", appliedAt: "2026-10-01" }), // avsluttet
  ];
  it("kommende frister for lagrede", () => {
    expect(upcomingDeadlines(apps, TODAY, 14).map((a) => a.id)).toEqual(["b", "a"]);
  });
  it("neste steg inkluderer forfalte, ikke avsluttede", () => {
    expect(upcomingNextSteps(apps, TODAY, 14).map((a) => a.id)).toEqual(["g", "f"]);
  });
  it("søknadens frist overstyrer stillingens", () => {
    expect(effectiveDeadline({ deadline: "2026-12-01" }, { deadline: "2026-11-01" })).toBe("2026-12-01");
    expect(effectiveDeadline({ deadline: null }, { deadline: "2026-11-01" })).toBe("2026-11-01");
  });
});
