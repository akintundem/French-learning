// Renders the dictionary to PDF via headless Chrome. Usage:
//
//   npx puppeteer@25 --yes browsers install chrome && node scripts/build-pdf.mjs
//
// Puppeteer is deliberately NOT a dependency: it downloads a 550MB Chrome, and
// this script runs about twice a year. Install it on demand, then remove it.
//
// Chrome is the only renderer available here that implements CSS paged media,
// so page breaks between parts and table headers repeating across pages work.
// macOS cupsfilter, tried first, ships no HTML or RTF filter on current versions.

import { readFileSync, statSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "data", "French-Dictionary-A2-B1.md");
const OUT = join(root, "data", "French-Dictionary-A2-B1.pdf");
const TMP_HTML = "/tmp/dict.html";

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

/** Minimal Markdown → HTML: enough for this document's headings and tables. */
function render(md) {
  const out = [];
  let inTable = false;

  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();

    if (!line) { closeTable(); continue; }

    if (/^\|/.test(line)) {
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;  // separator
      if (!inTable) {
        out.push('<table><thead><tr>' +
          cells.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr></thead><tbody>");
        inTable = true;
        continue;
      }
      out.push("<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      continue;
    }

    closeTable();

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      // Each PART starts a new page, so the printed copy is navigable.
      const brk = /^#\s+PART|^#\s+FAUX/.test(line) ? ' class="page"' : "";
      out.push(`<h${level}${brk}>${inline(h[2])}</h${level}>`);
      continue;
    }

    if (line === "---") { out.push("<hr>"); continue; }
    if (/^[-*]\s/.test(line)) { out.push(`<p class="li">• ${inline(line.slice(2))}</p>`); continue; }

    out.push(`<p>${inline(line)}</p>`);
  }
  closeTable();
  return out.join("\n");
}

const css = `
  body { font-family: Georgia, serif; font-size: 10pt; color: #1a1a1a; margin: 2em; }
  h1 { font-size: 20pt; border-bottom: 2px solid #333; padding-bottom: 4pt; margin-top: 1.5em; }
  h2 { font-size: 14pt; margin-top: 1.4em; color: #7a2e18; }
  h3 { font-size: 11pt; margin-top: 1em; }
  h1.page { page-break-before: always; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th { text-align: left; background: #eee; font-size: 9pt; padding: 3pt 6pt;
       border-bottom: 1px solid #999; }
  td { padding: 2.5pt 6pt; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  td:first-child { font-weight: 600; width: 42%; }
  code { font-family: Menlo, monospace; font-size: 9pt; background: #f3f3f3; }
  p { margin: 5pt 0; line-height: 1.4; }
  p.li { margin-left: 1em; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10pt 0; }
`;

const md = readFileSync(SRC, "utf8");
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>French Dictionary — A2 to B1</title><style>${css}</style></head>
<body>${render(md)}</body></html>`;

writeFileSync(TMP_HTML, html);

const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate:
      '<div style="width:100%;font-size:8pt;color:#888;text-align:center;' +
      "font-family:Georgia,serif;\">" +
      '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
} finally {
  await browser.close();
}

console.log(`${OUT}  ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
