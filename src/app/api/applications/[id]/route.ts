import { z } from "zod";
import { mutate, query } from "@/lib/store";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/types";

const STATUSES: ApplicationStatus[] = [
  "draft",
  "ready",
  "submitted",
  "interview",
  "offer",
  "rejected",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const application = await query(
    (db) =>
      db.applications.find((a) => a.id === id && a.userId === user.id) ?? null,
  );
  if (!application) return fail("Application not found.", 404);
  return ok({ application });
}

const patchSchema = z.object({
  status: z.enum(STATUSES as [ApplicationStatus, ...ApplicationStatus[]]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const parsed = await parseJson(request, patchSchema);
  if ("error" in parsed) return parsed.error;

  const updated = await mutate((db) => {
    const app = db.applications.find(
      (a) => a.id === id && a.userId === user.id,
    );
    if (!app) return null;
    app.status = parsed.data.status;
    app.updatedAt = new Date().toISOString();
    return app;
  });

  if (!updated) return fail("Application not found.", 404);
  return ok({ application: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const removed = await mutate((db) => {
    const idx = db.applications.findIndex(
      (a) => a.id === id && a.userId === user.id,
    );
    if (idx < 0) return false;
    db.applications.splice(idx, 1);
    return true;
  });

  if (!removed) return fail("Application not found.", 404);
  return ok({ ok: true });
}
