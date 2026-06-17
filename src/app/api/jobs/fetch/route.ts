import { z } from "zod";
import { mutate, newId } from "@/lib/store";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { fetchPageViaStealth } from "@/lib/mcp";
import { parseJobContent } from "@/lib/tailor/parse";
import type { JobPosting } from "@/lib/types";

const schema = z.object({
  url: z.string().url("A valid job posting URL is required."),
  title: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
});

/**
 * Drive the configured stealth-chrome browser to load a real job posting and
 * persist the extracted content. Returns a descriptive error (not fake data)
 * when the MCP bridge is unavailable, so the UI can prompt for manual paste.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = await parseJson(request, schema);
  if ("error" in parsed) return parsed.error;
  const { url, title, company } = parsed.data;

  let page;
  try {
    page = await fetchPageViaStealth(url);
  } catch (err) {
    return fail((err as Error).message, 502);
  }

  if (!page.content || page.content.trim().length < 20) {
    return fail(
      "The stealth browser loaded the page but returned no readable job text. Try pasting the description manually.",
      502,
    );
  }

  const result = parseJobContent(page.content, {
    url,
    titleHint: title,
    companyHint: company,
  });

  const job: JobPosting = {
    id: newId("job"),
    userId: user.id,
    url,
    source: "stealth-browser",
    title: result.title,
    company: result.company,
    location: result.location,
    description: result.description,
    createdAt: new Date().toISOString(),
  };

  await mutate((db) => db.jobs.push(job));
  return ok({ job }, 201);
}
