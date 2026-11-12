/**
 * Kalendereksport i iCalendar-format (.ics) for Google/Apple/Outlook.
 * Ren funksjon (se ics.test.ts).
 */
export type IcsEvent = {
  uid: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM (Oslo-tid)
  summary: string;
  description?: string | null;
  url?: string | null;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (date: string) => date.replace(/-/g, "");

function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Linjer over 75 tegn skal brytes («folding») ifølge standarden. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}

export function toIcs(events: readonly IcsEvent[], now: Date, calendarName = "Internship-portalen"): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Internship-portalen//NO",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Oslo",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@internship-portalen`, `DTSTAMP:${stamp}`);
    if (e.time) {
      const [h, m] = e.time.split(":").map(Number);
      const end = `${String((h + 1) % 24).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
      const endDate = h === 23 ? nextDay(e.date) : e.date;
      lines.push(
        `DTSTART;TZID=Europe/Oslo:${compact(e.date)}T${e.time.replace(":", "")}00`,
        `DTEND;TZID=Europe/Oslo:${compact(endDate)}T${end}`,
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`);
    }
    lines.push(`SUMMARY:${esc(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
