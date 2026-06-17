import { z } from "zod";
import { mutate, newId, query } from "@/lib/store";
import { ok, parseJson, requireUser } from "@/lib/api";
import { parseJobContent } from "@/lib/tailor/parse";
import type { JobPosting } from "@/lib/types";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const jobs = await query((db) =>
    db.jobs
      .filter((j) => j.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  return ok({ jobs });
}

const manualSchema = z.object({
  description: z.string().min(20, "Paste the full job description."),
  title: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
  url: z.string().url().optional().or(z.literal("")),
});

/** Add a job from pasted text (real user input, no fetching). */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = await parseJson(request, manualSchema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  const result = parseJobContent(input.description, {
    url: input.url || undefined,
    titleHint: input.title,
    companyHint: input.company,
  });

  const job: JobPosting = {
    id: newId("job"),
    userId: user.id,
    url: input.url || "",
    source: "manual",
    title: result.title,
    company: result.company,
    location: result.location,
    description: result.description,
    createdAt: new Date().toISOString(),
  };

  await mutate((db) => db.jobs.push(job));
  return ok({ job }, 201);
}
