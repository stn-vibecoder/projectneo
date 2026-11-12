import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-10 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  optional,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  optional?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted">({optional})</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * Flervalg som "chips". Bruker vanlige checkboxer, så det virker i
 * skjemaer uten JavaScript og med tastatur.
 */
export function ChipGroup({
  name,
  options,
  defaultValue = [],
  legend,
  hint,
  required,
}: {
  name: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  defaultValue?: readonly string[];
  legend?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      {legend && <legend className="mb-2 text-sm font-medium">{legend}</legend>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValue.includes(o.value)}
              className="peer sr-only"
              aria-required={required}
            />
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm transition-colors hover:bg-surface-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {o.icon}
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}
