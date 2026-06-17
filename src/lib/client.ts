"use client";

import type {
  Application,
  ApplicationStatus,
  JobPosting,
  Profile,
} from "./types";

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status}).`);
  }
  return body as T;
}

export const api = {
  me: () => request<{ user: { id: string; email: string } | null }>("/api/auth/me"),
  register: (email: string, password: string) =>
    request<{ user: { id: string; email: string } }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  getProfile: () => request<{ profile: Profile }>("/api/profile"),
  saveProfile: (profile: Profile) =>
    request<{ profile: Profile }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),

  listJobs: () => request<{ jobs: JobPosting[] }>("/api/jobs"),
  addJobManual: (input: {
    description: string;
    title?: string;
    company?: string;
    url?: string;
  }) =>
    request<{ job: JobPosting }>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  fetchJob: (input: { url: string; title?: string; company?: string }) =>
    request<{ job: JobPosting }>("/api/jobs/fetch", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listApplications: () =>
    request<{ applications: Application[] }>("/api/applications"),
  createApplication: (jobId: string) =>
    request<{ application: Application }>("/api/applications", {
      method: "POST",
      body: JSON.stringify({ jobId }),
    }),
  setApplicationStatus: (id: string, status: ApplicationStatus) =>
    request<{ application: Application }>(`/api/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteApplication: (id: string) =>
    request<{ ok: boolean }>(`/api/applications/${id}`, { method: "DELETE" }),
};
