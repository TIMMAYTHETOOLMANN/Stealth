/**
 * Parse raw job-posting content (HTML or plain text) retrieved from the stealth
 * browser, or pasted by the user, into structured fields. Operates only on the
 * provided text — it never fabricates company/title data.
 */

export interface ParsedJob {
  title: string;
  company: string;
  location: string;
  description: string;
}

function stripHtml(input: string): string {
  // Drop script/style blocks entirely, then remove tags.
  const noScripts = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = noScripts
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–");
}

function collapse(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

const looksLikeHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

export function parseJobContent(
  raw: string,
  opts: { url?: string; titleHint?: string; companyHint?: string } = {},
): ParsedJob {
  const cleaned = collapse(looksLikeHtml(raw) ? stripHtml(raw) : decodeEntities(raw));
  const lines = cleaned.split("\n");

  // Title: explicit hint > first "Title:"-style label > first substantial line.
  let title = opts.titleHint?.trim() ?? "";
  let company = opts.companyHint?.trim() ?? "";
  let location = "";

  for (const line of lines.slice(0, 40)) {
    const m = line.match(/^(job\s*title|title|position|role)\s*[:\-]\s*(.+)$/i);
    if (m && !title) title = m[2].trim();
    const c = line.match(/^(company|employer|organization|organisation)\s*[:\-]\s*(.+)$/i);
    if (c && !company) company = c[2].trim();
    const l = line.match(/^(location|based in|office)\s*[:\-]\s*(.+)$/i);
    if (l && !location) location = l[2].trim();
  }

  if (!title) {
    title = lines.find((l) => l.length >= 3 && l.length <= 90) ?? "Untitled role";
  }

  if (!company && opts.url) {
    try {
      const host = new URL(opts.url).hostname.replace(/^www\./, "");
      company = host.split(".")[0];
    } catch {
      /* ignore */
    }
  }

  return {
    title: title.slice(0, 140),
    company: (company || "Unknown company").slice(0, 120),
    location: location.slice(0, 120),
    description: cleaned,
  };
}
