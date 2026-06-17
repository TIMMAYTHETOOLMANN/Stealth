// Shared domain types for the Stealth Job Application Agent.

export interface User {
  id: string;
  email: string;
  /** scrypt hash in the form `salt:hash` (both hex). Never sent to the client. */
  passwordHash: string;
  createdAt: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  /** Achievement / responsibility bullets. Each is scored & reordered per job. */
  bullets: string[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  field?: string;
  graduationDate?: string;
}

/**
 * The master profile is the single source of truth from which every tailored
 * resume and cover letter is generated. No content is invented by the system;
 * tailoring only selects, reorders and emphasises what the user has provided.
 */
export interface Profile {
  userId: string;
  fullName: string;
  headline: string;
  email: string;
  phone?: string;
  location?: string;
  links: { label: string; url: string }[];
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  updatedAt: string;
}

export interface JobPosting {
  id: string;
  userId: string;
  /** Source URL if fetched via the stealth browser, else empty for pasted text. */
  url: string;
  source: "stealth-browser" | "manual";
  title: string;
  company: string;
  location: string;
  description: string;
  createdAt: string;
}

export interface TailoredDocuments {
  /** Match analysis between the profile and the job description. */
  match: MatchAnalysis;
  resume: TailoredResume;
  coverLetter: string;
}

export interface MatchAnalysis {
  /** 0-100 overall fit score. */
  score: number;
  /** Keywords from the JD that are present in the profile. */
  matchedKeywords: string[];
  /** Keywords from the JD that are missing from the profile (ATS gaps). */
  missingKeywords: string[];
  /** Top JD keywords by weight, for transparency. */
  jobKeywords: { term: string; weight: number }[];
}

export interface TailoredResume {
  fullName: string;
  headline: string;
  contact: string;
  /** Summary rewritten to lead with the most relevant, real skills. */
  summary: string;
  /** Skills reordered so JD-relevant skills appear first. */
  skills: string[];
  /** Experience with bullets reordered by relevance to this job. */
  experience: ExperienceItem[];
  education: EducationItem[];
}

export type ApplicationStatus =
  | "draft"
  | "ready"
  | "submitted"
  | "interview"
  | "offer"
  | "rejected";

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  status: ApplicationStatus;
  matchScore: number;
  jobTitle: string;
  company: string;
  url: string;
  documents: TailoredDocuments;
  createdAt: string;
  updatedAt: string;
}
