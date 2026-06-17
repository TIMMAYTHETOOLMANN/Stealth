"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { JobPosting } from "@/lib/types";

export default function JobsPanel({
  jobs,
  onJobsChanged,
  onGenerated,
}: {
  jobs: JobPosting[];
  onJobsChanged: () => Promise<void> | void;
  onGenerated: () => Promise<void> | void;
}) {
  const [mode, setMode] = useState<"url" | "paste">("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: string; text: string } | null>(
    null,
  );

  async function ingest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "url") {
        await api.fetchJob({ url, title: title || undefined, company: company || undefined });
        setMessage({
          kind: "success",
          text: "Job retrieved via stealth browser and saved.",
        });
        setUrl("");
      } else {
        await api.addJobManual({
          description,
          title: title || undefined,
          company: company || undefined,
          url: url || undefined,
        });
        setMessage({ kind: "success", text: "Job saved from pasted text." });
        setDescription("");
      }
      setTitle("");
      setCompany("");
      await onJobsChanged();
    } catch (err) {
      setMessage({ kind: "alert", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function generate(jobId: string) {
    setGeneratingId(jobId);
    setMessage(null);
    try {
      await api.createApplication(jobId);
      setMessage({
        kind: "success",
        text: "Tailored application generated. Open the Applications tab.",
      });
      await onGenerated();
    } catch (err) {
      setMessage({ kind: "alert", text: (err as Error).message });
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div>
      {message && (
        <div className={`alert ${message.kind === "alert" ? "" : message.kind}`}>
          {message.text}
        </div>
      )}

      <div className="panel">
        <div className="panel-title">
          <h2>Ingest Target</h2>
          <div className="tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={`tab ${mode === "url" ? "active" : ""}`}
              onClick={() => setMode("url")}
            >
              Stealth Fetch
            </button>
            <button
              type="button"
              className={`tab ${mode === "paste" ? "active" : ""}`}
              onClick={() => setMode("paste")}
            >
              Paste
            </button>
          </div>
        </div>

        <form onSubmit={ingest}>
          {mode === "url" ? (
            <div className="field">
              <label>Job Posting URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://company.com/careers/role"
                required
              />
              <span className="muted">
                Loaded through the mcp-stealth-chrome bridge. If it is offline,
                switch to Paste.
              </span>
            </div>
          ) : (
            <div className="field">
              <label>Job Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the full job description here."
                style={{ minHeight: "160px" }}
                required
              />
            </div>
          )}
          <div className="grid-2">
            <div className="field">
              <label>Title override (optional)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Company override (optional)</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          <button className="btn magenta" type="submit" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "url"
                ? "Fetch With Stealth Browser"
                : "Save Job"}
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Target Queue</h2>
          <span className="muted">{jobs.length} saved</span>
        </div>
        {jobs.length === 0 && (
          <div className="empty">No targets yet. Ingest one above.</div>
        )}
        {jobs.map((job) => (
          <div className="list-item" key={job.id}>
            <div className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{job.title}</h3>
                <div className="muted">
                  {job.company}
                  {job.location ? ` · ${job.location}` : ""} ·{" "}
                  <span style={{ color: "var(--violet)" }}>{job.source}</span>
                </div>
                {job.url && (
                  <a href={job.url} target="_blank" rel="noreferrer" className="muted">
                    {job.url}
                  </a>
                )}
              </div>
              <button
                className="btn small"
                type="button"
                onClick={() => generate(job.id)}
                disabled={generatingId === job.id}
              >
                {generatingId === job.id ? "Tailoring…" : "Tailor & Apply"}
              </button>
            </div>
            <details style={{ marginTop: "0.6rem" }}>
              <summary className="muted" style={{ cursor: "pointer" }}>
                View captured description
              </summary>
              <pre className="doc" style={{ marginTop: "0.5rem" }}>
                {job.description}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
