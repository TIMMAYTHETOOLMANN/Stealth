import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from "zod";
import { currentUser } from "./auth";
import type { User } from "./types";

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Parse + validate a JSON request body against a Zod schema. */
export async function parseJson<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ data: ZodInfer<S> } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: fail("Invalid JSON body.") };
  }
  try {
    return { data: schema.parse(body) };
  } catch (err) {
    if (err instanceof ZodError) {
      const msg = err.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return { error: fail(msg, 422) };
    }
    return { error: fail("Validation failed.", 422) };
  }
}

/** Require an authenticated user or return a 401 response. */
export async function requireUser(): Promise<
  { user: User } | { error: NextResponse }
> {
  const user = await currentUser();
  if (!user) return { error: fail("Authentication required.", 401) };
  return { user };
}
