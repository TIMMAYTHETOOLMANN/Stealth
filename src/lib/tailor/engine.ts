/**
 * Tailoring engine.
 *
 * Given a user's REAL master profile and a REAL job description, it produces:
 *   1. A match analysis (score + matched/missing ATS keywords).
 *   2. A resume whose skills and experience bullets are reordered to lead with
 *      the content most relevant to this specific job.
 *   3. A cover letter assembled from the profile's real achievements, addressed
 *      to the specific company/role and echoing the job's own keywords.
 *
 * The engine never invents experience, skills, or accomplishments. It only
 * selects, reorders and emphasises what the user already provided — maximising
 * ATS/keyword alignment honestly.
 */

import type {
  ExperienceItem,
  JobPosting,
  MatchAnalysis,
  Profile,
  TailoredDocuments,
  TailoredResume,
} from "../types";
import {
  extractKeywords,
  profileKeywordSet,
  relevanceOf,
  type WeightedTerm,
} from "./keywords";

function analyzeMatch(profile: Profile, job: JobPosting): MatchAnalysis {
  const jobKeywords = extractKeywords(job.description, 40);
  const profileSet = profileKeywordSet([
    profile.summary,
    profile.headline,
    profile.skills.join(" "),
    profile.experience
      .map((e) => `${e.title} ${e.company} ${e.bullets.join(" ")}`)
      .join(" "),
    profile.education.map((e) => `${e.degree} ${e.field} ${e.school}`).join(" "),
  ]);

  const matched: string[] = [];
  const missing: string[] = [];
  let gained = 0;
  let total = 0;

  for (const { term, weight } of jobKeywords) {
    total += weight;
    const present = term
      .split(" ")
      .every((part) => profileSet.has(part)) || profileSet.has(term);
    if (present) {
      matched.push(term);
      gained += weight;
    } else {
      missing.push(term);
    }
  }

  const score = total === 0 ? 0 : Math.round((gained / total) * 100);

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    jobKeywords,
  };
}

function reorderBullets(
  bullets: string[],
  terms: WeightedTerm[],
): string[] {
  return [...bullets]
    .map((b, i) => ({ b, i, score: relevanceOf(b, terms) }))
    // Stable: keep original order when relevance ties.
    .sort((a, z) => z.score - a.score || a.i - z.i)
    .map((x) => x.b);
}

function tailorResume(
  profile: Profile,
  job: JobPosting,
  terms: WeightedTerm[],
): TailoredResume {
  // Skills: relevant-first, preserving the rest.
  const skills = [...profile.skills].sort((a, b) => {
    const ra = relevanceOf(a, terms);
    const rb = relevanceOf(b, terms);
    return rb - ra;
  });

  // Experience: reorder bullets within each role by relevance; order roles by
  // their best matching bullet, but never drop anything.
  const experience: ExperienceItem[] = profile.experience
    .map((role) => ({
      ...role,
      bullets: reorderBullets(role.bullets, terms),
    }))
    .map((role) => ({
      role,
      score: role.bullets.reduce(
        (acc, b) => Math.max(acc, relevanceOf(b, terms)),
        0,
      ),
    }))
    .sort((a, z) => z.score - a.score)
    .map((x) => x.role);

  const contactParts = [profile.email, profile.phone, profile.location].filter(
    Boolean,
  ) as string[];

  // Summary: lead with the role headline keywords the user genuinely has.
  const leadSkills = skills.slice(0, 5).join(", ");
  const summary = profile.summary
    ? `${profile.summary}${
        leadSkills ? ` Core strengths relevant to ${job.title}: ${leadSkills}.` : ""
      }`
    : leadSkills
      ? `${profile.headline}. Core strengths relevant to ${job.title}: ${leadSkills}.`
      : profile.headline;

  return {
    fullName: profile.fullName,
    headline: profile.headline,
    contact: contactParts.join(" · "),
    summary,
    skills,
    experience,
    education: profile.education,
  };
}

function topAchievements(
  profile: Profile,
  terms: WeightedTerm[],
  count: number,
): string[] {
  const all = profile.experience.flatMap((e) =>
    e.bullets.map((b) => ({ text: b, company: e.company })),
  );
  return all
    .map((x) => ({ ...x, score: relevanceOf(x.text, terms) }))
    .sort((a, z) => z.score - a.score)
    .slice(0, count)
    .filter((x) => x.score > 0)
    .map((x) => x.text.replace(/^[•\-\s]+/, "").trim());
}

function buildCoverLetter(
  profile: Profile,
  job: JobPosting,
  match: MatchAnalysis,
  terms: WeightedTerm[],
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Present matched skills using the user's own casing where possible, rather
  // than the lower-cased JD keyword, so the letter reads naturally.
  const matchedSkills = match.matchedKeywords
    .map((kw) => {
      const own = profile.skills.find(
        (s) => s.toLowerCase() === kw || s.toLowerCase().includes(kw),
      );
      if (own) return own;
      return kw.replace(/\b\w/g, (c) => c.toUpperCase());
    })
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 6);

  const achievements = topAchievements(profile, terms, 3);
  const achievementBlock =
    achievements.length > 0
      ? achievements.map((a) => `• ${a}`).join("\n")
      : profile.experience[0]?.bullets
          .slice(0, 3)
          .map((b) => `• ${b.replace(/^[•\-\s]+/, "")}`)
          .join("\n") ?? "";

  const skillsSentence =
    matchedSkills.length > 0
      ? `My background maps directly onto what you are looking for, with hands-on experience in ${matchedSkills
          .slice(0, 5)
          .join(", ")}.`
      : `My background aligns closely with the responsibilities outlined in this role.`;

  const company = job.company && job.company !== "Unknown company" ? job.company : "your team";

  return [
    `${profile.fullName}`,
    `${[profile.email, profile.phone, profile.location].filter(Boolean).join(" · ")}`,
    ``,
    `${date}`,
    ``,
    `Dear Hiring Team at ${company},`,
    ``,
    `I am writing to apply for the ${job.title} position${
      job.company && job.company !== "Unknown company" ? ` at ${job.company}` : ""
    }. ${skillsSentence}`,
    ``,
    `A few results from my experience that are directly relevant to this role:`,
    achievementBlock,
    ``,
    `${
      profile.summary
        ? profile.summary
        : `As ${profile.headline}, I focus on delivering measurable outcomes.`
    } I am confident I can bring the same impact to ${company}, and I am excited by the opportunity to contribute to ${job.title}.`,
    ``,
    `Thank you for your time and consideration. I would welcome the chance to discuss how my experience fits your needs.`,
    ``,
    `Sincerely,`,
    `${profile.fullName}`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function generateTailoredDocuments(
  profile: Profile,
  job: JobPosting,
): TailoredDocuments {
  const match = analyzeMatch(profile, job);
  const resume = tailorResume(profile, job, match.jobKeywords);
  const coverLetter = buildCoverLetter(profile, job, match, match.jobKeywords);
  return { match, resume, coverLetter };
}
