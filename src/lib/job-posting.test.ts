import { describe, expect, it } from "vitest";
import { extractPrefill } from "./job-posting";

const jsonLdPage = `<!doctype html><html><head>
<title>Careers</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Ignore me"}</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{
  "@type":"JobPosting",
  "title":"Summer Analyst 2027 – Investment Banking",
  "hiringOrganization":{"@type":"Organization","name":"Nordvik Capital"},
  "jobLocation":[{"@type":"Place","address":{"addressLocality":"Oslo","addressCountry":"NO"}},
                 {"@type":"Place","address":{"addressLocality":"London","addressCountry":"GB"}}],
  "validThrough":"2026-12-01T23:59:00+01:00",
  "description":"<p>Vi søker <strong>studenter</strong> til sommerjobb.</p><ul><li>Analyse</li></ul>"
}]}
</script></head><body></body></html>`;

describe("extractPrefill", () => {
  it("leser JobPosting fra JSON-LD (også inne i @graph)", () => {
    const p = extractPrefill(jsonLdPage);
    expect(p.foundJsonLd).toBe(true);
    expect(p.title).toBe("Summer Analyst 2027 – Investment Banking");
    expect(p.company).toBe("Nordvik Capital");
    expect(p.cities).toEqual(["oslo", "london"]);
    expect(p.period).toBe("summer");
    expect(p.deadline).toBe("2026-12-01");
    expect(p.description).toBe("Vi søker studenter til sommerjobb.\n• Analyse");
  });

  it("faller tilbake til OpenGraph", () => {
    const html = `<html><head>
      <meta property="og:title" content="Winternship – Strategy | Fjell &amp; Berg" />
      <meta property="og:site_name" content="Fjell &amp; Berg Consulting" />
      <meta name="description" content="Bli med oss i Oslo i januar." />
    </head></html>`;
    const p = extractPrefill(html);
    expect(p.foundJsonLd).toBe(false);
    expect(p.title).toBe("Winternship – Strategy | Fjell & Berg");
    expect(p.company).toBe("Fjell & Berg Consulting");
    expect(p.cities).toEqual(["oslo"]);
    expect(p.period).toBe("winter");
  });

  it("tåler ugyldig JSON-LD og tomme sider", () => {
    const p = extractPrefill(`<script type="application/ld+json">{ugyldig</script><title>Jobb</title>`);
    expect(p.foundJsonLd).toBe(false);
    expect(p.title).toBe("Jobb");
    expect(extractPrefill("").cities).toEqual([]);
  });
});
