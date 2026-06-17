import { z } from "zod";
import { mutate, newId, query } from "@/lib/store";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { generateTailoredDocuments } from "@/lib/tailor/engine";
import type { Application } from "@/lib/types";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const applications = await query((db) =>
    db.applications
      .filter((a) => a.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  return ok({ applications });
}

const schema = z.object({
  jobId: z.string().min(1, "jobId is required."),
});

/**
 * Generate a tailored application for a saved job. Pulls the user's real
 * profile and the real job description, then runs the tailoring engine.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = await parseJson(request, schema);
  if ("error" in parsed) return parsed.error;
  const { jobId } = parsed.data;

  const { profile, job } = await query((db) => ({
    profile: db.profiles.find((p) => p.userId === user.id) ?? null,
    job: db.jobs.find((j) => j.id === jobId && j.userId === user.id) ?? null,
  }));

  if (!job) return fail("Job not found.", 404);
  if (!profile || (!profile.fullName && profile.skills.length === 0)) {
    return fail(
      "Complete your master profile before generating applications.",
      400,
    );
  }

  const documents = generateTailoredDocuments(profile, job);
  const now = new Date().toISOString();

  const application: Application = {
    id: newId("app"),
    userId: user.id,
    jobId: job.id,
    status: "ready",
    matchScore: documents.match.score,
    jobTitle: job.title,
    company: job.company,
    url: job.url,
    documents,
    createdAt: now,
    updatedAt: now,
  };

  await mutate((db) => db.applications.push(application));
  return ok({ application }, 201);
}
