import { z } from "zod";
import { authenticate, publicUser, registerUser, startSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";

const schema = z.object({
  email: z.string().email("A valid email is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if ("error" in parsed) return parsed.error;
  const { email, password } = parsed.data;

  try {
    const user = await registerUser(email, password);
    await startSession(user.id);
    return ok({ user: publicUser(user) }, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("already exists")) {
      return fail(message, 409);
    }
    if (message.includes("AUTH_SECRET")) return fail(message, 500);
    return fail("Could not create account.", 400);
  }
}
