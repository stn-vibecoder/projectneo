import { describe, expect, it } from "vitest";
import { guessPeriod, htmlToText, matchCities, normalizeCompanyName, toDateOnlyOrNull } from "./normalize";

describe("normalizeCompanyName (samme resultat som SQL-funksjonen)", () => {
  it.each([
    ["Nordvik Capital ASA", "nordvik capital"],
    ["Hudson & Pine Partners, LLC", "hudson pine partners"],
    ["Lindqvist Investment AB", "lindqvist investment"],
    ["Ståhlberg Industri", "ståhlberg industri"],
    ["  Brekke   Revisjon AS ", "brekke revisjon"],
    ["Boston Consulting Group (BCG)", "boston consulting group"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });
});

describe("matchCities", () => {
  it.each([
    ["Oslo, Norway", ["oslo"]],
    ["Stockholm, Sweden", ["stockholm"]],
    ["New York, NY", ["new_york"]],
    ["NYC (Hybrid)", ["new_york"]],
    ["Brooklyn, NY, USA", ["new_york"]],
    ["London, United Kingdom", ["london"]],
    ["Canary Wharf", ["london"]],
    ["Oslo / London", ["oslo", "london"]],
    ["London, ON, Canada", []],
    ["New London, CT", []],
    ["London / New London", ["london"]],
    ["Bergen", []],
    ["", []],
  ])("%s", (input, expected) => {
    expect(matchCities(input)).toEqual(expected);
  });
});

describe("guessPeriod", () => {
  it.each([
    ["Summer Analyst 2027", "summer"],
    ["Sommerjobb revisjon", "summer"],
    ["Sommarpraktik 2027", "summer"],
    ["Winternship – Strategy", "winter"],
    ["Winter Intern 2027", "winter"],
    ["Høstinternship", "autumn"],
    ["Autumn Intern – Credit Risk", "autumn"],
    ["Full-year placement", "full_year"],
    ["Helårsinternship", "full_year"],
    ["Software Engineering Intern", "unknown"],
  ])("%s -> %s", (input, expected) => {
    expect(guessPeriod(input)).toBe(expected);
  });
});

describe("htmlToText", () => {
  it("fjerner tagger og beholder avsnitt", () => {
    expect(htmlToText("<p>Hei &amp; velkommen</p><ul><li>En</li><li>To</li></ul><script>x()</script>")).toBe(
      "Hei & velkommen\n• En\n• To",
    );
  });
});

describe("toDateOnlyOrNull", () => {
  it("tar datodelen av ISO", () => expect(toDateOnlyOrNull("2026-12-01T23:59:00+01:00")).toBe("2026-12-01"));
  it("ugyldig gir null", () => expect(toDateOnlyOrNull("snart")).toBeNull());
  it("ikke-streng gir null", () => expect(toDateOnlyOrNull(42)).toBeNull());
});
