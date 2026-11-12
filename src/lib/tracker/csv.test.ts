import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("starter med BOM og bruker semikolon og CRLF", () => {
    expect(toCsv([["a", "b"], [1, null]])).toBe("﻿a;b\r\n1;\r\n");
  });
  it("siterer felt med semikolon, anførselstegn og linjeskift", () => {
    expect(toCsv([['Hudson; "Pine"', "linje1\nlinje2"]])).toBe('﻿"Hudson; ""Pine"""' + ';"linje1\nlinje2"\r\n');
  });
  it("nøytraliserer formler", () => {
    expect(toCsv([["=HYPERLINK(1)", "-5", "@x"]])).toBe("﻿'=HYPERLINK(1);'-5;'@x\r\n");
  });
  it("beholder æøå", () => {
    expect(toCsv([["Søkt", "Ståhlberg"]])).toContain("Søkt;Ståhlberg");
  });
});
