import { z } from "zod";
import { authenticate, publicUser, startSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";

const schema = z.object({
  email: z.string().email("A valid email is required."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if ("error" in parsed) return parsed.error;
  const { email, password } = parsed.data;

  const user = await authenticate(email, password);
  if (!user) return fail("Invalid email or password.", 401);

  await startSession(user.id);
  return ok({ user: publicUser(user) });
}
