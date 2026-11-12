import type { City } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Enkle strekikoner for byene, tegnet i samme stil som Lucide
 * (24×24, 1,75 strek, runde ender), så de passer med resten av ikonene.
 *  - Oslo: Operahuset (skrått tak ned mot vannet)
 *  - Stockholm: Stadshuset (tårn med de tre kronene)
 *  - New York: Empire State Building (trappetrinn og spir)
 *  - London: Big Ben (klokketårn med urskive og spir)
 */
const PATHS: Record<City, React.ReactNode> = {
  oslo: (
    <>
      {/* Taket som går slakt opp fra vannet, det flate taket og scenetårnet */}
      <path d="M2 17.5 11 12h3.5V8h4.5v4h2.5v5.5" />
      <path d="M2 17.5h19.5" />
      {/* Den skrå glassfasaden */}
      <path d="m11 12 1.5 5.5" />
      {/* Fjorden */}
      <path d="M3 21c1.4-.9 2.8-.9 4.2 0s2.8.9 4.2 0 2.8-.9 4.2 0 2.8.9 4.2 0" />
    </>
  ),
  stockholm: (
    <>
      {/* De tre kronene og spiret */}
      <path d="M10.5 2.5h3M12 2.5v2" />
      {/* Tårntopp og tårn */}
      <path d="M10.5 4.5h3l.5 2.5h-4z" />
      <path d="M10 7v14h4V7" />
      {/* Hovedbygningen ved vannet */}
      <path d="M3 21v-7h7M14 14h7v7" />
      <path d="M2 21h20" />
      {/* Buer */}
      <path d="M5.5 21v-2.5a1 1 0 0 1 2 0V21M16.5 21v-2.5a1 1 0 0 1 2 0V21" />
    </>
  ),
  new_york: (
    <>
      {/* Spir */}
      <path d="M12 1.5v3.5" />
      {/* Trappetrinn */}
      <path d="M10.5 5h3v3h-3zM9.5 8h5v3h-5z" />
      <path d="M8 11h8v10H8z" />
      {/* Vindusbånd */}
      <path d="M10.5 13.5v5M13.5 13.5v5" />
      <path d="M5 21h14" />
    </>
  ),
  london: (
    <>
      {/* Spir */}
      <path d="M12 1.5 14.5 6h-5z" />
      {/* Tårn */}
      <path d="M9.5 6h5v15h-5z" />
      {/* Urskive */}
      <circle cx="12" cy="9.75" r="1.6" />
      {/* Klokkerom og etasjer */}
      <path d="M9.5 13h5M9.5 16h5" />
      <path d="M6.5 21h11" />
    </>
  ),
};

export function CityIcon({ city, className }: { city: City; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      {PATHS[city]}
    </svg>
  );
}
