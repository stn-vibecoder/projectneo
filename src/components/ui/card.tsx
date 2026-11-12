import { cn } from "@/lib/utils";
import { statusColor } from "@/lib/domain";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface shadow-[0_1px_0_rgba(14,26,43,0.03)]", className)}
      {...props}
    />
  );
}

/** Seksjonstittel i versaler med tynn linje under, som i en rapport. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <h2 className="eyebrow flex items-center gap-2 text-foreground [&_svg]:size-3.5 [&_svg]:text-gold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5 text-gold">{eyebrow}</p>}
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ label, color, className }: { label: string; color: string; className?: string }) {
  const c = statusColor(color);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium", c.badge, className)}>
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {label}
    </span>
  );
}

/** Firmamerke som et ticker-symbol, f.eks. «NVC» for Nordvik Capital. */
export function CompanyMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-9 w-11 shrink-0 font-mono items-center justify-center rounded-md bg-sidebar text-[11px] font-semibold tracking-wider text-gold",
        className,
      )}
    >
      {tickerSymbol(name)}
    </span>
  );
}

export function tickerSymbol(name: string): string {
  const words = name
    .replace(/&/g, " ")
    .split(/[\s\-–.,]+/)
    .filter((w) => w && !/^(as|asa|ab|ltd|inc|llc|plc|co|and|og|the)$/i.test(w));
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
