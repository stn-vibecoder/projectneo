import type { City, Industry, Rating } from "@/lib/domain";
import type { ApplicationWithRelations } from "@/lib/types";
import { effectiveDeadline } from "@/lib/tracker/status-logic";

/** Slank modell som sendes til klientkomponentene i trackeren. */
export type TrackerItem = {
  id: string;
  statusId: string;
  position: number;
  company: string;
  title: string;
  cities: City[];
  deadline: string | null;
  appliedAt: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  lastActivityAt: string;
  archived: boolean;
  jobClosed: boolean;
  industry: Industry | null;
  notes: string | null;
  rating: Rating | null;
  /** Søknadens egen frist (overstyring), og stillingens frist. */
  deadlineOverride: string | null;
  jobDeadline: string | null;
};

export function toTrackerItem(a: ApplicationWithRelations): TrackerItem {
  return {
    id: a.id,
    statusId: a.status_id,
    position: a.board_position,
    company: a.job.company.name,
    title: a.job.title,
    cities: a.job.cities,
    deadline: effectiveDeadline(a, a.job),
    appliedAt: a.applied_at,
    nextStep: a.next_step,
    nextStepAt: a.next_step_at,
    lastActivityAt: a.last_activity_at,
    archived: a.archived,
    jobClosed: a.job.status === "closed",
    industry: a.job.industry,
    notes: a.notes,
    rating: a.rating,
    deadlineOverride: a.deadline,
    jobDeadline: a.job.deadline,
  };
}
