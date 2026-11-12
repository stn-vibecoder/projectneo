import type { Adapter, SourceType } from "../types";
import { ashby, bamboohr, greenhouse, lever, teamtailor } from "./ats";
import { bindeleddet, nhhs } from "./portals";
import { adzuna, jobtech, nav } from "./public";

export const ADAPTERS: Record<SourceType, Adapter> = {
  greenhouse,
  lever,
  ashby,
  teamtailor,
  bamboohr,
  nhhs,
  bindeleddet,
  nav,
  jobtech,
  adzuna,
};
