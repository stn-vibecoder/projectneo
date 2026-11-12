/**
 * Hva som regnes som internship. Rediger listene her for å justere filteret.
 * Alle mønstre sjekkes mot tittelen (og typen kilden oppgir), ikke hele
 * stillingsteksten – ellers slipper «vi har også sommerjobber» gjennom.
 */

/** Minst ett av disse må finnes i tittelen. */
export const INCLUDE: RegExp[] = [
  // «Intern»/«internship» – men ikke «internal», «international», og ikke norsk/svensk
  // «intern» brukt som adjektiv foran et substantiv («intern reception»).
  /\bintern(s|ship|ships)\b/i,
  /\bintern\b(?!\s+[a-zæøåäö]{3,})/i,
  /\bsummer\s+(analyst|associate|intern|internship|programme|program|placement|consultant|student)s?\b/i,
  /\b(spring|insight)\s+(week|programme|program|day)s?\b/i,
  /\boff[-\s]cycle\b/i,
  /\bwinternship\b/i,
  /\bplacement\b/i, // britisk «industrial/summer placement»
  /\bsommer(jobb|jobber|student|studenter|internship|praktikant|praksis)\b/i,
  /\bsommar(jobb|jobba|praktik|praktikant|student)\b/i,
  /\bvinter(jobb|internship)\b/i,
  /\bpraktikant(er)?\b/i,
  // Svensk «praktik» kan også bety (tannlege)praksis – krev tydelig sammenheng.
  /\bpraktik(plats|platser)\b/i,
  /\bpraktik\s+(inom|hos)\b/i,
  /\bLIA\b/,
  /\btrainee(s|program|programme|programmet)?\b/i,
];

/** Treff på disse gjør at stillingen IKKE regnes som internship. */
export const EXCLUDE: RegExp[] = [
  // Norsk «intern» betyr ofte «internt», f.eks. «intern utlysning», «internrevisor».
  /\bintern(e|t)?\s+(utlysning|stilling|søker|kandidat|kontroll|revisjon|revisor|kommunikasjon)\b/i,
  /\bsommervikar/i, // vikariater i barnehage, helse osv.
  /\b(program(me)?\s+manager|coordinator|koordinator|recruiter|rekrutterer|director|head of)\b/i,
];

export function isInternshipTitle(title: string): boolean {
  if (EXCLUDE.some((re) => re.test(title))) return false;
  return INCLUDE.some((re) => re.test(title));
}
