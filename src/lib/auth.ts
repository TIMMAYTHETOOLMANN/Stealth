import crypto from "node:crypto";
import { cookies } from "next/headers";
import { mutate, newId, query } from "./store";
import type { User } from "./types";

/**
 * Local account system.
 *
 * "Self-generated account" here means the application's OWN user account that
 * the agent operates under — created and owned by the user running this tool.
 * Credentials are hashed with scrypt; sessions are stateless HMAC-signed tokens
 * stored in an httpOnly cookie. No third-party credentials are fabricated.
 */

const SESSION_COOKIE = "stealth_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    // Fail loudly rather than silently using a weak/default secret.
    throw new Error(
      "AUTH_SECRET is not set or too short. Set a long random value in .env.local.",
    );
  }
  return secret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, derived);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("hex");
}

function createToken(userId: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, mac] = parts;
  const payload = `${userId}.${expires}`;
  const expected = sign(payload);
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  if (Number(expires) < Date.now()) return null;
  return userId;
}

export async function registerUser(
  email: string,
  password: string,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  return mutate((db) => {
    if (db.users.some((u) => u.email === normalized)) {
      throw new Error("An account with this email already exists.");
    }
    const user: User = {
      id: newId("usr"),
      email: normalized,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return user;
  });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const user = await query((db) =>
    db.users.find((u) => u.email === normalized),
  );
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Returns the currently authenticated user, or null. */
export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = parseToken(token);
  if (!userId) return null;
  return query((db) => db.users.find((u) => u.id === userId) ?? null);
}

/** Strip secrets before sending a user to the client. */
export function publicUser(user: User): { id: string; email: string } {
  return { id: user.id, email: user.email };
}
