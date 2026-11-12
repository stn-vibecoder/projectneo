import { describe, expect, it } from "vitest";
import { detectFromHtml, detectFromUrl } from "./detect";

describe("detectFromUrl", () => {
  it.each([
    ["https://boards.greenhouse.io/stripe", "greenhouse", "stripe"],
    ["https://job-boards.greenhouse.io/point72/jobs/123", "greenhouse", "point72"],
    ["https://boards.greenhouse.io/embed/job_board?for=acme", "greenhouse", "acme"],
    ["jobs.lever.co/palantir", "lever", "palantir"],
    ["https://jobs.eu.lever.co/kahoot", "lever", "eu:kahoot"],
    ["https://jobs.ashbyhq.com/ramp", "ashby", "ramp"],
    ["https://oda.teamtailor.com/jobs", "teamtailor", "https://oda.teamtailor.com"],
    ["https://www.nu.nhhs.no/jobs/", "nhhs", "default"],
    ["https://bindeleddet.no/jobs", "bindeleddet", "default"],
    ["https://arbeidsplassen.nav.no/stillinger", "nav", "default"],
    ["https://arbetsformedlingen.se/platsbanken", "jobtech", "default"],
  ])("%s -> %s", (url, type, identifier) => {
    expect(detectFromUrl(url)).toMatchObject({ ok: true, type, identifier });
  });

  it("Workday er ikke støttet", () => {
    expect(detectFromUrl("https://dnb.wd3.myworkdayjobs.com/careers")).toMatchObject({ ok: false, reason: "workday" });
  });
  it("LinkedIn hentes aldri", () => {
    expect(detectFromUrl("https://www.linkedin.com/jobs/view/1")).toMatchObject({ ok: false, reason: "unsupported" });
  });
  it("ukjent side -> må sjekkes med henting", () => {
    expect(detectFromUrl("https://careers.example.com")).toBeNull();
  });
  it("ugyldig", () => {
    expect(detectFromUrl("ikke en lenke ::")).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("detectFromHtml", () => {
  it("finner innebygd Greenhouse", () => {
    const html = `<title>Karriere | Testbank</title><script src="https://boards.greenhouse.io/embed/job_board/js?for=testbank"></script>`;
    expect(detectFromHtml(html, "https://careers.testbank.no")).toMatchObject({ ok: true, type: "greenhouse", identifier: "testbank", name: "Karriere" });
  });
  it("finner Teamtailor på eget domene", () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/jobs.rss"><img src="https://teamtailor-cdn.com/x.png">`;
    expect(detectFromHtml(html, "https://jobs.oda.com/jobs")).toMatchObject({ type: "teamtailor", identifier: "https://jobs.oda.com" });
  });
  it("finner Lever-lenker", () => {
    expect(detectFromHtml(`<a href="https://jobs.lever.co/acme/123">Søk</a>`, "https://acme.com")).toMatchObject({ type: "lever", identifier: "acme" });
  });
});
