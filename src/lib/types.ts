import type { City, Industry, Period, Rating, StatusCategory } from "@/lib/domain";

export type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: Industry | null;
  description: string | null;
  created_by: string | null;
};

export type Job = {
  id: string;
  company_id: string;
  title: string;
  cities: City[];
  location_raw: string | null;
  period: Period;
  industry: Industry | null;
  deadline: string | null; // YYYY-MM-DD
  url: string | null;
  apply_url: string | null;
  description: string | null;
  source: string;
  status: "open" | "closed";
  first_seen: string;
  last_seen: string;
  closed_at: string | null;
  created_by: string | null;
};

export type JobWithCompany = Job & { company: Company };

export type ApplicationStatus = {
  id: string;
  user_id: string;
  label: string;
  category: StatusCategory;
  color: string;
  position: number;
};

export type Application = {
  id: string;
  user_id: string;
  job_id: string;
  status_id: string;
  applied_at: string | null;
  deadline: string | null;
  next_step: string | null;
  next_step_at: string | null;
  cv_url: string | null;
  cover_letter_url: string | null;
  notes: string | null;
  rating: Rating | null;
  board_position: number;
  last_activity_at: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ApplicationWithRelations = Application & {
  job: JobWithCompany;
  status: ApplicationStatus;
};

export type ApplicationEvent = {
  id: string;
  application_id: string;
  type: "created" | "status_changed" | "note";
  from_label: string | null;
  to_label: string | null;
  from_category: StatusCategory | null;
  to_category: StatusCategory | null;
  note: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  application_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  locale: string;
  study_field: string | null;
  ghosting_days: number;
  onboarded_at: string | null;
};

export type Preferences = {
  user_id: string;
  cities: City[];
  industries: Industry[];
  periods: Period[];
};
