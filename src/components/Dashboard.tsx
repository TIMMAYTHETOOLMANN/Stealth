"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Application, JobPosting } from "@/lib/types";
import AuthGate from "./AuthGate";
import ProfilePanel from "./ProfilePanel";
import JobsPanel from "./JobsPanel";
import ApplicationsPanel from "./ApplicationsPanel";

type Tab = "profile" | "jobs" | "applications";
type User = { id: string; email: string };

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  const refreshJobs = useCallback(async () => {
    const r = await api.listJobs();
    setJobs(r.jobs);
  }, []);

  const refreshApplications = useCallback(async () => {
    const r = await api.listApplications();
    setApplications(r.applications);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    // Async data load on auth; setState runs after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshJobs().catch(() => {});
    refreshApplications().catch(() => {});
  }, [user, refreshJobs, refreshApplications]);

  async function logout() {
    await api.logout();
    setUser(null);
    setJobs([]);
    setApplications([]);
    setTab("profile");
  }

  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="logo-big flicker">STEALTH</div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuth={(u) => setUser(u)} />;
  }

  const avgScore =
    applications.length > 0
      ? Math.round(
          applications.reduce((acc, a) => acc + a.matchScore, 0) /
            applications.length,
        )
      : 0;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="logo">S</div>
          <div>
            <h1 className="flicker">Stealth Agent</h1>
            <div className="sub">Application Tailoring Console</div>
          </div>
        </div>
        <div className="row">
          <span className="muted">{user.email}</span>
          <button className="btn ghost small" type="button" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: "1.25rem" }}>
        <div className="panel" style={{ flex: 1, margin: 0, padding: "0.8rem 1rem" }}>
          <div className="muted uppercase">Targets</div>
          <div style={{ fontSize: "1.4rem", color: "var(--cyan)" }}>
            {jobs.length}
          </div>
        </div>
        <div className="panel" style={{ flex: 1, margin: 0, padding: "0.8rem 1rem" }}>
          <div className="muted uppercase">Applications</div>
          <div style={{ fontSize: "1.4rem", color: "var(--magenta)" }}>
            {applications.length}
          </div>
        </div>
        <div className="panel" style={{ flex: 1, margin: 0, padding: "0.8rem 1rem" }}>
          <div className="muted uppercase">Avg Match</div>
          <div style={{ fontSize: "1.4rem", color: "var(--lime)" }}>
            {avgScore}%
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === "profile" ? "active" : ""}`}
          onClick={() => setTab("profile")}
          type="button"
        >
          Master Profile
        </button>
        <button
          className={`tab ${tab === "jobs" ? "active" : ""}`}
          onClick={() => setTab("jobs")}
          type="button"
        >
          Targets<span className="count">[{jobs.length}]</span>
        </button>
        <button
          className={`tab ${tab === "applications" ? "active" : ""}`}
          onClick={() => setTab("applications")}
          type="button"
        >
          Applications<span className="count">[{applications.length}]</span>
        </button>
      </div>

      {tab === "profile" && <ProfilePanel />}
      {tab === "jobs" && (
        <JobsPanel
          jobs={jobs}
          onJobsChanged={refreshJobs}
          onGenerated={async () => {
            await refreshApplications();
            setTab("applications");
          }}
        />
      )}
      {tab === "applications" && (
        <ApplicationsPanel
          applications={applications}
          onChanged={refreshApplications}
        />
      )}
    </div>
  );
}
