import { describe, expect, it } from "vitest";
import { boardMatchesCompany, parseCsv, sectorToIndustry, slugCandidates, toImportRows } from "./csv-import";

const CSV = `﻿selskap,sektor,byer,url,merknad
ABG Sundal Collier,Investment banking,Oslo; Stockholm,https://abgsc.teamtailor.com/jobs,Karriereside: https://www.abgsc.com/working-at-abgsc/
DNB Carnegie,Investment banking,Oslo,https://www.dnb.no/x,"Internship (IBD, FICC, Research) og graduate"
SB1 Markets,Investment banking,Oslo,https://www.sb1markets.no/en/,"Åpen søknad til karriere@sb1markets.no"
`;

describe("CSV-import", () => {
  it("tolker anførselstegn med komma inni", () => {
    expect(parseCsv('a,"b, c",d\n1,"x ""y""",3')).toEqual([
      ["a", "b, c", "d"],
      ["1", 'x "y"', "3"],
    ]);
  });
  it("godtar semikolon", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("leser kolonnene og lenker i merknaden", () => {
    const rows = toImportRows(CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ company: "ABG Sundal Collier", url: "https://abgsc.teamtailor.com/jobs" });
    expect(rows[0].extraUrls).toEqual(["https://www.abgsc.com/working-at-abgsc/"]);
    expect(rows[1].notes).toBe("Internship (IBD, FICC, Research) og graduate");
    expect(rows[2].extraUrls).toEqual([]);
  });
  it("sektor -> bransje", () => {
    expect(sectorToIndustry("Investment banking")).toBe("finance");
    expect(sectorToIndustry("Private equity")).toBe("finance");
    expect(sectorToIndustry("Hedgefond/trading")).toBe("finance");
    expect(sectorToIndustry("Revisjon")).toBe("audit");
    expect(sectorToIndustry("Consulting")).toBe("consulting");
    expect(sectorToIndustry("Jobbportal")).toBeNull();
  });
  it("forslag til navn på stillingsside", () => {
    expect(slugCandidates("Jane Street")).toEqual(expect.arrayContaining(["janestreet", "jane-street"]));
    expect(slugCandidates("Norges Bank Investment Management (NBIM)")).toContain("norgesbankinvestmentmanagement");
    expect(slugCandidates("Moelis & Company")).toContain("moelis");
  });
  it.each([
    ["Jane Street", "Jane Street", true],
    ["Nordic Capital", "Nordic Capital Advisors", true],
    ["Investor AB", "Investor AB", true],
    ["BDO Norge", "BDO", true],
    ["Point72", "Point72 ", true],
    ["Apollo", "Apollo Education Systems", false],
    ["Oliver Wyman", "OLIVER", false],
  ])("%s ↔ %s = %s", (company, board, expected) => {
    expect(boardMatchesCompany(company, board)).toBe(expected);
  });
});
