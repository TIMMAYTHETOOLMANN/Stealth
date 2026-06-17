import { z } from "zod";
import { mutate, query } from "@/lib/store";
import { ok, parseJson, requireUser } from "@/lib/api";
import type { Profile } from "@/lib/types";

function emptyProfile(userId: string, email: string): Profile {
  return {
    userId,
    fullName: "",
    headline: "",
    email,
    phone: "",
    location: "",
    links: [],
    summary: "",
    skills: [],
    experience: [],
    education: [],
    updatedAt: new Date().toISOString(),
  };
}

const profileSchema = z.object({
  fullName: z.string().max(160).default(""),
  headline: z.string().max(200).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  phone: z.string().max(60).default(""),
  location: z.string().max(120).default(""),
  links: z
    .array(z.object({ label: z.string().max(60), url: z.string().max(300) }))
    .default([]),
  summary: z.string().max(4000).default(""),
  skills: z.array(z.string().max(80)).default([]),
  experience: z
    .array(
      z.object({
        id: z.string().optional(),
        company: z.string().max(160).default(""),
        title: z.string().max(160).default(""),
        location: z.string().max(120).optional(),
        startDate: z.string().max(40).optional(),
        endDate: z.string().max(40).optional(),
        bullets: z.array(z.string().max(600)).default([]),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        id: z.string().optional(),
        school: z.string().max(160).default(""),
        degree: z.string().max(160).default(""),
        field: z.string().max(160).optional(),
        graduationDate: z.string().max(40).optional(),
      }),
    )
    .default([]),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const profile = await query(
    (db) => db.profiles.find((p) => p.userId === user.id) ?? null,
  );
  return ok({ profile: profile ?? emptyProfile(user.id, user.email) });
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = await parseJson(request, profileSchema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  const profile: Profile = {
    userId: user.id,
    fullName: input.fullName,
    headline: input.headline,
    email: input.email || user.email,
    phone: input.phone,
    location: input.location,
    links: input.links,
    summary: input.summary,
    skills: input.skills.map((s) => s.trim()).filter(Boolean),
    experience: input.experience.map((e, i) => ({
      id: e.id || `exp_${i}`,
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
    })),
    education: input.education.map((e, i) => ({
      id: e.id || `edu_${i}`,
      school: e.school,
      degree: e.degree,
      field: e.field,
      graduationDate: e.graduationDate,
    })),
    updatedAt: new Date().toISOString(),
  };

  await mutate((db) => {
    const idx = db.profiles.findIndex((p) => p.userId === user.id);
    if (idx >= 0) db.profiles[idx] = profile;
    else db.profiles.push(profile);
  });

  return ok({ profile });
}
