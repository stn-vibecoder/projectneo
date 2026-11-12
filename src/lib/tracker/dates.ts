// Datoer uten klokkeslett (YYYY-MM-DD) behandles som kalenderdager,
// uavhengig av tidssone.

const DAY_MS = 86_400_000;

export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayNumber(dateOnly: string): number {
  const [y, m, d] = dateOnly.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Antall kalenderdager fra `from` til `to` (negativ hvis `to` er før). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** Dager siden et tidspunkt (ISO-tidsstempel eller dato), målt i kalenderdager. */
export function daysSince(timestamp: string, today: string): number {
  const date = timestamp.length > 10 ? toDateOnly(new Date(timestamp)) : timestamp;
  return daysBetween(date, today);
}

/** Dato til visning: midt på dagen UTC, så den aldri havner på feil dag. */
export function dateOnlyToDate(dateOnly: string): Date {
  return new Date(`${dateOnly.slice(0, 10)}T12:00:00Z`);
}

export function isValidDateOnly(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(dateOnlyToDate(v).getTime());
}
