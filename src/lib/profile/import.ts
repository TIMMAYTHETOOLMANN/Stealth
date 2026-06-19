/**
 * Core-document importer.
 *
 * Parses an operator's existing resume / CV ("core document") that they drop in
 * as plain text and reconfigures their master profile from it — extracting
 * identity, contact details, summary, skills, experience bullets and education.
 *
 * Like the rest of Stealth, it NEVER fabricates content: every field is derived
 * strictly from the text the operator pasted. Parsing is heuristic and lossless
 * toward existing data — it fills empty fields and appends newly-found items,
 * but never overwrites information already present in the profile. The operator
 * always reviews the populated profile before saving.
 */

import type { EducationItem, ExperienceItem, Profile } from "../types";
import { SKILL_PHRASES } from "../tailor/keywords";

export interface ImportResult {
  /** Profile with parsed data merged in (non-destructive). */
  profile: Profile;
  /** Human-readable list of what was extracted, for operator feedback. */
  filled: string[];
}

type Section = "summary" | "skills" | "experience" | "education" | null;

const SECTION_HEADERS: { section: Exclude<Section, null>; re: RegExp }[] = [
  {
    section: "summary",
    re: /^(professional\s+summary|summary|profile|about(?:\s+me)?|objective|overview)\s*:?\s*$/i,
  },
  {
    section: "skills",
    re: /^(technical\s+skills|core\s+competencies|competencies|technologies|skills|tech\s+stack)\s*:?\s*$/i,
  },
  {
    section: "experience",
    re: /^(work\s+experience|professional\s+experience|employment\s+history|work\s+history|experience|employment)\s*:?\s*$/i,
  },
  {
    section: "education",
    re: /^(education|academic\s+background|academics)\s*:?\s*$/i,
  },
];

const BULLET_RE = /^[\s]*[•\-*–·▪◦]\s+/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/;
const URL_RE = /\bhttps?:\/\/[^\s,)]+/i;
const YEAR_RE = /(19|20)\d{2}/;
const DATE_RANGE_RE =
  /\(?\s*((?:19|20)\d{2}|present|current)\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|present|current)\s*\)?/i;
const DEGREE_RE =
  /\b(ph\.?d|m\.?b\.?a|m\.?s\.?c?|b\.?s\.?c?|b\.?a|m\.?a|b\.?eng|m\.?eng|bachelor|master|associate|diploma|doctorate)\b/i;
const SCHOOL_RE = /\b(university|college|institute|school|academy|polytechnic)\b/i;

function splitLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim());
}

function detectSection(line: string): Section {
  for (const { section, re } of SECTION_HEADERS) {
    if (re.test(line)) return section;
  }
  return null;
}

function isContactLine(line: string): boolean {
  return EMAIL_RE.test(line) || URL_RE.test(line) || /\d{3}/.test(line);
}

function looksLikeName(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false;
  if (isContactLine(line)) return false;
  const words = line.split(/\s+/);
  if (words.length < 1 || words.length > 5) return false;
  // Mostly alphabetic, allows hyphens/periods/apostrophes (e.g. "J. O'Brien").
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, "").trim();
}

function newExpId(i: number): string {
  return `exp_imp_${Date.now().toString(36)}_${i}`;
}

function newEduId(i: number): string {
  return `edu_imp_${Date.now().toString(36)}_${i}`;
}

/** Pull a "2019 - Present" style range out of a header, returning the rest. */
function extractDates(line: string): {
  rest: string;
  startDate?: string;
  endDate?: string;
} {
  const m = line.match(DATE_RANGE_RE);
  if (m) {
    return {
      rest: line.replace(m[0], "").replace(/[|,–—-]\s*$/, "").trim(),
      startDate: m[1],
      endDate: m[2],
    };
  }
  return { rest: line };
}

/** Split a role header into title + company using common separators. */
function parseRoleHeader(line: string): { title: string; company: string } {
  const seps = [" at ", " @ ", " — ", " – ", " | ", " - "];
  for (const sep of seps) {
    const idx = line.toLowerCase().indexOf(sep);
    if (idx > 0) {
      return {
        title: line.slice(0, idx).trim(),
        company: line.slice(idx + sep.length).trim(),
      };
    }
  }
  // "Title, Company" — ambiguous; keep first part as the title.
  const comma = line.indexOf(",");
  if (comma > 0) {
    return {
      title: line.slice(0, comma).trim(),
      company: line.slice(comma + 1).trim(),
    };
  }
  return { title: line.trim(), company: "" };
}

function parseExperience(lines: string[]): ExperienceItem[] {
  const roles: ExperienceItem[] = [];
  let current: ExperienceItem | null = null;
  let idx = 0;

  const startRole = (header: string): ExperienceItem => {
    const { rest, startDate, endDate } = extractDates(header);
    const { title, company } = parseRoleHeader(rest);
    const role: ExperienceItem = {
      id: newExpId(idx++),
      company,
      title,
      startDate,
      endDate,
      bullets: [],
    };
    roles.push(role);
    return role;
  };

  for (const line of lines) {
    if (!line) continue;
    if (BULLET_RE.test(line)) {
      if (!current) current = startRole("Experience");
      const text = stripBullet(line);
      if (text) current.bullets.push(text);
      continue;
    }
    // Non-bullet line. If it is a bare company line directly under a role header
    // that still lacks a company and bullets, attach it as the company.
    const hasDates = DATE_RANGE_RE.test(line);
    if (
      current &&
      current.bullets.length === 0 &&
      !current.company &&
      !hasDates &&
      !/ at | @ | — | – | \| | - |,/.test(line)
    ) {
      current.company = line.trim();
      continue;
    }
    current = startRole(line);
  }

  // Drop roles that captured neither a title/company nor any bullets.
  return roles.filter((r) => r.title || r.company || r.bullets.length > 0);
}

function parseEducation(lines: string[]): EducationItem[] {
  const items: EducationItem[] = [];
  let idx = 0;
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    const yearMatch = line.match(YEAR_RE);
    const graduationDate = yearMatch ? yearMatch[0] : undefined;
    const cleaned = line.replace(/\(?\s*(19|20)\d{2}\s*\)?/g, "").trim();
    const segments = cleaned
      .split(/[,|—–]|\s-\s/)
      .map((s) => s.trim())
      .filter(Boolean);

    const school =
      segments.find((s) => SCHOOL_RE.test(s)) ??
      (SCHOOL_RE.test(cleaned) ? cleaned : "");
    const degree =
      segments.find((s) => DEGREE_RE.test(s)) ??
      (DEGREE_RE.test(cleaned) ? cleaned : "");
    const field = segments.find((s) => s !== school && s !== degree);

    if (!school && !degree && !cleaned) continue;
    items.push({
      id: newEduId(idx++),
      school: school || (degree ? "" : cleaned),
      degree: degree || (school ? "" : cleaned),
      field: field && field !== school && field !== degree ? field : undefined,
      graduationDate,
    });
  }
  return items;
}

function parseSkills(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    for (const part of line.split(/[,|;•·]/)) {
      const skill = part.trim().replace(/\s+/g, " ");
      if (skill && skill.length <= 60) out.push(skill);
    }
  }
  return out;
}

/** Detect curated lexicon skills present anywhere in the document. */
function lexiconSkills(raw: string): string[] {
  const lower = raw.toLowerCase();
  const found: string[] = [];
  for (const phrase of SKILL_PHRASES) {
    const re = new RegExp(
      `(?:^|[^a-z0-9+#])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9+#]|$)`,
      "i",
    );
    if (re.test(lower)) {
      found.push(phrase.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }
  return found;
}

function dedupePush(target: string[], candidates: string[]): number {
  const seen = new Set(target.map((s) => s.toLowerCase()));
  let added = 0;
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (!c || seen.has(key)) continue;
    seen.add(key);
    target.push(c);
    added++;
  }
  return added;
}

/**
 * Parse a pasted core document and merge it non-destructively into `base`.
 */
export function parseResumeToProfile(raw: string, base: Profile): ImportResult {
  const lines = splitLines(raw);
  const filled: string[] = [];

  // 1. Partition into sections.
  const header: string[] = [];
  const buckets: Record<Exclude<Section, null>, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
  };
  let section: Section = null;
  for (const line of lines) {
    const detected = detectSection(line);
    if (detected) {
      section = detected;
      continue;
    }
    if (section) buckets[section].push(line);
    else header.push(line);
  }

  // 2. Contact details (searched across the whole document).
  const email = raw.match(EMAIL_RE)?.[0] ?? "";
  const phone = (() => {
    // Strip emails and URLs first so their digits don't masquerade as a phone.
    const scrubbed = raw
      .replace(new RegExp(EMAIL_RE.source, "gi"), " ")
      .replace(new RegExp(URL_RE.source, "gi"), " ");
    const m = scrubbed.match(PHONE_RE)?.[0];
    return m && m.replace(/\D/g, "").length >= 7 ? m.trim() : "";
  })();
  const links = [...raw.matchAll(new RegExp(URL_RE.source, "gi"))].map((m) => {
    const url = m[0].replace(/[.,);]+$/, "");
    let label = url;
    try {
      label = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* keep raw url as label */
    }
    return { label, url };
  });

  // 3. Identity from the header area.
  const headerNonEmpty = header.filter(Boolean);
  const name = headerNonEmpty.find(looksLikeName) ?? "";
  const headline =
    headerNonEmpty.find(
      (l) => l !== name && !isContactLine(l) && l.length <= 90,
    ) ?? "";
  const location =
    header.find((l) => /^[A-Za-z .'-]+,\s*[A-Za-z]{2,}/.test(l) && l !== name) ??
    "";

  // 4. Build the merged profile (non-destructive).
  const profile: Profile = {
    ...base,
    links: [...base.links],
    skills: [...base.skills],
    experience: [...base.experience],
    education: [...base.education],
  };

  const fill = (
    key: "fullName" | "headline" | "email" | "phone" | "location" | "summary",
    value: string,
    label: string,
  ) => {
    if (value && !(base[key] ?? "").trim()) {
      profile[key] = value;
      filled.push(label);
    }
  };

  fill("fullName", name, "name");
  fill("headline", headline, "headline");
  fill("email", email, "email");
  fill("phone", phone, "phone");
  fill("location", location.trim(), "location");
  fill("summary", buckets.summary.filter(Boolean).join(" ").trim(), "summary");

  // Links: append any not already tracked.
  const linksAdded = (() => {
    const seen = new Set(profile.links.map((l) => l.url.toLowerCase()));
    let added = 0;
    for (const l of links) {
      if (seen.has(l.url.toLowerCase())) continue;
      seen.add(l.url.toLowerCase());
      profile.links.push(l);
      added++;
    }
    return added;
  })();
  if (linksAdded) filled.push(`${linksAdded} link${linksAdded > 1 ? "s" : ""}`);

  // Skills: explicit section + curated lexicon detection, deduped.
  const skillsAdded = dedupePush(profile.skills, [
    ...parseSkills(buckets.skills),
    ...lexiconSkills(raw),
  ]);
  if (skillsAdded) filled.push(`${skillsAdded} skills`);

  // Experience: append non-duplicate roles.
  const existingRoles = new Set(
    profile.experience.map((e) =>
      `${e.title}|${e.company}`.toLowerCase().trim(),
    ),
  );
  let rolesAdded = 0;
  for (const role of parseExperience(buckets.experience)) {
    const key = `${role.title}|${role.company}`.toLowerCase().trim();
    if (existingRoles.has(key)) continue;
    existingRoles.add(key);
    profile.experience.push(role);
    rolesAdded++;
  }
  if (rolesAdded) filled.push(`${rolesAdded} role${rolesAdded > 1 ? "s" : ""}`);

  // Education: append non-duplicate entries.
  const existingEdu = new Set(
    profile.education.map((e) => `${e.school}|${e.degree}`.toLowerCase().trim()),
  );
  let eduAdded = 0;
  for (const edu of parseEducation(buckets.education)) {
    const key = `${edu.school}|${edu.degree}`.toLowerCase().trim();
    if (existingEdu.has(key)) continue;
    existingEdu.add(key);
    profile.education.push(edu);
    eduAdded++;
  }
  if (eduAdded) {
    filled.push(`${eduAdded} education ${eduAdded > 1 ? "entries" : "entry"}`);
  }

  return { profile, filled };
}
