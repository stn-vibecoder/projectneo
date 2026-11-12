import Link from "next/link";
import { cn } from "@/lib/utils";

export type TickerEntry = {
  key: string;
  href: string | null;
  company: string;
  label: string;
  date: string; // YYYY-MM-DD
  dotClass: string;
};

/**
 * Rullende stripe med kommende frister og intervjuer, som en kurstavle.
 * Stopper når musa er over, og står stille hvis brukeren har bedt om
 * redusert bevegelse.
 */
export function Ticker({ title, entries }: { title: string; entries: TickerEntry[] }) {
  if (entries.length === 0) return null;

  // Fyll opp så stripa alltid er bredere enn skjermen, og doble for sømløs loop.
  const base: TickerEntry[] = [];
  while (base.length < 10) base.push(...entries);
  const loop = [...base, ...base];

  return (
    <div className="mb-6 flex h-10 overflow-hidden rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="eyebrow z-10 flex shrink-0 items-center gap-2 bg-gold px-3 text-[10px] text-sidebar">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sidebar opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-1.5 rounded-full bg-sidebar" />
        </span>
        {title}
      </div>
      <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
        <div
          className="flex h-full w-max animate-ticker items-center hover:[animation-play-state:paused] motion-reduce:overflow-x-auto"
          style={{ animationDuration: `${base.length * 6}s` }}
        >
          {loop.map((e, i) => {
            const content = (
              <>
                <span className={cn("size-1.5 rounded-full", e.dotClass)} />
                <span className="font-semibold uppercase tracking-wide">{e.company}</span>
                <span className="text-sidebar-muted">{e.label}</span>
                <span className="num text-gold">
                  {e.date.slice(8, 10)}.{e.date.slice(5, 7)}
                </span>
              </>
            );
            const cls =
              "flex h-full items-center gap-2 whitespace-nowrap border-r border-sidebar-border px-5 text-xs";
            return e.href ? (
              <Link key={`${e.key}-${i}`} href={e.href} className={cn(cls, "hover:bg-sidebar-hover")} tabIndex={i < base.length ? 0 : -1}>
                {content}
              </Link>
            ) : (
              <span key={`${e.key}-${i}`} className={cls}>
                {content}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
