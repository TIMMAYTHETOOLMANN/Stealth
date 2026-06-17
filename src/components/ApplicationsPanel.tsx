"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { Application, ApplicationStatus } from "@/lib/types";

const STATUSES: ApplicationStatus[] = [
  "draft",
  "ready",
  "submitted",
  "interview",
  "offer",
  "rejected",
];

function resumeToText(app: Application): string {
  const r = app.documents.resume;
  const lines: string[] = [];
  lines.push(r.fullName.toUpperCase());
  if (r.headline) lines.push(r.headline);
  if (r.contact) lines.push(r.contact);
  lines.push("");
  if (r.summary) {
    lines.push("SUMMARY");
    lines.push(r.summary, "");
  }
  if (r.skills.length) {
    lines.push("SKILLS");
    lines.push(r.skills.join(" · "), "");
  }
  if (r.experience.length) {
    lines.push("EXPERIENCE");
    for (const e of r.experience) {
      const period = [e.startDate, e.endDate].filter(Boolean).join(" – ");
      lines.push(`${e.title} — ${e.company}${period ? ` (${period})` : ""}`);
      for (const b of e.bullets) lines.push(`  • ${b.replace(/^[•\-\s]+/, "")}`);
      lines.push("");
    }
  }
  if (r.education.length) {
    lines.push("EDUCATION");
    for (const e of r.education) {
      lines.push(
        `${e.degree}${e.field ? `, ${e.field}` : ""} — ${e.school}${
          e.graduationDate ? ` (${e.graduationDate})` : ""
        }`,
      );
    }
  }
  return lines.join("\n").trim();
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ApplicationCard({
  app,
  onChanged,
}: {
  app: Application;
  onChanged: () => Promise<void> | void;
}) {
  const [view, setView] = useState<"resume" | "cover" | "analysis">("analysis");
  const [busy, setBusy] = useState(false);
  const resumeText = resumeToText(app);

  async function setStatus(status: ApplicationStatus) {
    setBusy(true);
    try {
      await api.setApplicationStatus(app.id, status);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteApplication(app.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const slug = `${app.company}-${app.jobTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div className="panel">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{app.jobTitle}</h3>
          <div className="muted">{app.company}</div>
          <div className="row" style={{ marginTop: "0.5rem" }}>
            <span className={`status ${app.status}`}>{app.status}</span>
            {app.url && (
              <a href={app.url} target="_blank" rel="noreferrer" className="muted">
                source ↗
              </a>
            )}
          </div>
        </div>
        <div
          className="score-ring"
          style={{ ["--val" as string]: String(app.matchScore) }}
          title="Profile ↔ job match score"
        >
          {app.matchScore}
        </div>
      </div>

      <div className="tabs" style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
        <button
          className={`tab ${view === "analysis" ? "active" : ""}`}
          onClick={() => setView("analysis")}
          type="button"
        >
          Match
        </button>
        <button
          className={`tab ${view === "resume" ? "active" : ""}`}
          onClick={() => setView("resume")}
          type="button"
        >
          Resume
        </button>
        <button
          className={`tab ${view === "cover" ? "active" : ""}`}
          onClick={() => setView("cover")}
          type="button"
        >
          Cover Letter
        </button>
      </div>

      {view === "analysis" && (
        <div>
          <div className="field">
            <label>Matched keywords ({app.documents.match.matchedKeywords.length})</label>
            <div className="chips">
              {app.documents.match.matchedKeywords.map((k) => (
                <span className="chip matched" key={k}>
                  {k}
                </span>
              ))}
              {app.documents.match.matchedKeywords.length === 0 && (
                <span className="muted">None matched.</span>
              )}
            </div>
          </div>
          <div className="field">
            <label>
              ATS gaps — missing keywords (
              {app.documents.match.missingKeywords.length})
            </label>
            <div className="chips">
              {app.documents.match.missingKeywords.map((k) => (
                <span className="chip missing" key={k}>
                  {k}
                </span>
              ))}
              {app.documents.match.missingKeywords.length === 0 && (
                <span className="muted">No gaps detected.</span>
              )}
            </div>
            <span className="muted">
              Consider adding any of these that you genuinely have to your master
              profile, then regenerate.
            </span>
          </div>
        </div>
      )}

      {view === "resume" && (
        <div>
          <pre className="doc">{resumeText}</pre>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <button
              className="btn ghost small"
              type="button"
              onClick={() => navigator.clipboard.writeText(resumeText)}
            >
              Copy
            </button>
            <button
              className="btn ghost small"
              type="button"
              onClick={() => download(`${slug}-resume.txt`, resumeText)}
            >
              Download
            </button>
          </div>
        </div>
      )}

      {view === "cover" && (
        <div>
          <pre className="doc">{app.documents.coverLetter}</pre>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <button
              className="btn ghost small"
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(app.documents.coverLetter)
              }
            >
              Copy
            </button>
            <button
              className="btn ghost small"
              type="button"
              onClick={() =>
                download(`${slug}-cover-letter.txt`, app.documents.coverLetter)
              }
            >
              Download
            </button>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: "1rem" }}>
        <label style={{ margin: 0 }}>Status</label>
        <select
          value={app.status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
          disabled={busy}
          style={{ width: "auto" }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button
          className="btn danger small"
          type="button"
          onClick={remove}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ApplicationsPanel({
  applications,
  onChanged,
}: {
  applications: Application[];
  onChanged: () => Promise<void> | void;
}) {
  if (applications.length === 0) {
    return (
      <div className="empty">
        No applications yet. Tailor one from the Targets tab.
      </div>
    );
  }
  return (
    <div>
      {applications.map((app) => (
        <ApplicationCard key={app.id} app={app} onChanged={onChanged} />
      ))}
    </div>
  );
}
