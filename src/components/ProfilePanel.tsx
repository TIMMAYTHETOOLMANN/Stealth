"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { EducationItem, ExperienceItem, Profile } from "@/lib/types";

function newExperience(): ExperienceItem {
  return {
    id: `exp_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    company: "",
    title: "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: [""],
  };
}

function newEducation(): EducationItem {
  return {
    id: `edu_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    school: "",
    degree: "",
    field: "",
    graduationDate: "",
  };
}

export default function ProfilePanel({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    api
      .getProfile()
      .then((r) => setProfile(r.profile))
      .catch((e) => setMessage({ kind: "alert", text: (e as Error).message }));
  }, []);

  if (!profile) {
    return <div className="panel">Loading profile…</div>;
  }

  const update = (patch: Partial<Profile>) =>
    setProfile({ ...profile, ...patch });

  function addSkill() {
    const value = skillInput.trim();
    if (!value || !profile) return;
    if (profile.skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillInput("");
      return;
    }
    update({ skills: [...profile.skills, value] });
    setSkillInput("");
  }

  function updateExperience(id: string, patch: Partial<ExperienceItem>) {
    if (!profile) return;
    update({
      experience: profile.experience.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  }

  function updateEducation(id: string, patch: Partial<EducationItem>) {
    if (!profile) return;
    update({
      education: profile.education.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.saveProfile(profile);
      setProfile(res.profile);
      setMessage({ kind: "success", text: "Master profile saved." });
      onSaved?.();
    } catch (err) {
      setMessage({ kind: "alert", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && <div className={`alert ${message.kind === "success" ? "success" : message.kind === "info" ? "info" : ""}`}>{message.text}</div>}

      <div className="panel">
        <div className="panel-title">
          <h2>Identity</h2>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Full Name</label>
            <input
              value={profile.fullName}
              onChange={(e) => update({ fullName: e.target.value })}
              placeholder="Jordan Vega"
            />
          </div>
          <div className="field">
            <label>Headline</label>
            <input
              value={profile.headline}
              onChange={(e) => update({ headline: e.target.value })}
              placeholder="Senior Full-Stack Engineer"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              value={profile.email}
              onChange={(e) => update({ email: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Phone</label>
            <input
              value={profile.phone ?? ""}
              onChange={(e) => update({ phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              value={profile.location ?? ""}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="Remote · Berlin"
            />
          </div>
        </div>
        <div className="field">
          <label>Professional Summary</label>
          <textarea
            value={profile.summary}
            onChange={(e) => update({ summary: e.target.value })}
            placeholder="A short summary describing your real experience and focus."
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Skills</h2>
          <span className="muted">{profile.skills.length} tracked</span>
        </div>
        <div className="row" style={{ marginBottom: "0.8rem" }}>
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Add a skill and press Enter"
            style={{ flex: 1 }}
          />
          <button className="btn ghost small" type="button" onClick={addSkill}>
            Add
          </button>
        </div>
        <div className="chips">
          {profile.skills.map((skill) => (
            <span className="chip" key={skill}>
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                onClick={() =>
                  update({
                    skills: profile.skills.filter((s) => s !== skill),
                  })
                }
              >
                ✕
              </button>
            </span>
          ))}
          {profile.skills.length === 0 && (
            <span className="muted">No skills yet.</span>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Experience</h2>
          <button
            className="btn ghost small"
            type="button"
            onClick={() =>
              update({ experience: [...profile.experience, newExperience()] })
            }
          >
            + Role
          </button>
        </div>
        {profile.experience.length === 0 && (
          <div className="empty">Add the roles that make up your real history.</div>
        )}
        {profile.experience.map((exp) => (
          <div className="list-item" key={exp.id}>
            <div className="grid-2">
              <div className="field">
                <label>Title</label>
                <input
                  value={exp.title}
                  onChange={(e) =>
                    updateExperience(exp.id, { title: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Company</label>
                <input
                  value={exp.company}
                  onChange={(e) =>
                    updateExperience(exp.id, { company: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Start</label>
                <input
                  value={exp.startDate ?? ""}
                  onChange={(e) =>
                    updateExperience(exp.id, { startDate: e.target.value })
                  }
                  placeholder="2021"
                />
              </div>
              <div className="field">
                <label>End</label>
                <input
                  value={exp.endDate ?? ""}
                  onChange={(e) =>
                    updateExperience(exp.id, { endDate: e.target.value })
                  }
                  placeholder="Present"
                />
              </div>
            </div>
            <label>Achievement bullets</label>
            {exp.bullets.map((bullet, idx) => (
              <div className="row" key={idx} style={{ marginBottom: "0.4rem" }}>
                <textarea
                  value={bullet}
                  onChange={(e) => {
                    const bullets = [...exp.bullets];
                    bullets[idx] = e.target.value;
                    updateExperience(exp.id, { bullets });
                  }}
                  style={{ minHeight: "48px" }}
                  placeholder="Quantified, real accomplishment."
                />
                <button
                  className="btn danger small"
                  type="button"
                  onClick={() =>
                    updateExperience(exp.id, {
                      bullets: exp.bullets.filter((_, i) => i !== idx),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="row">
              <button
                className="btn ghost small"
                type="button"
                onClick={() =>
                  updateExperience(exp.id, { bullets: [...exp.bullets, ""] })
                }
              >
                + Bullet
              </button>
              <div className="spacer" />
              <button
                className="btn danger small"
                type="button"
                onClick={() =>
                  update({
                    experience: profile.experience.filter(
                      (e) => e.id !== exp.id,
                    ),
                  })
                }
              >
                Remove Role
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Education</h2>
          <button
            className="btn ghost small"
            type="button"
            onClick={() =>
              update({ education: [...profile.education, newEducation()] })
            }
          >
            + Entry
          </button>
        </div>
        {profile.education.map((edu) => (
          <div className="list-item" key={edu.id}>
            <div className="grid-2">
              <div className="field">
                <label>School</label>
                <input
                  value={edu.school}
                  onChange={(e) =>
                    updateEducation(edu.id, { school: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Degree</label>
                <input
                  value={edu.degree}
                  onChange={(e) =>
                    updateEducation(edu.id, { degree: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Field</label>
                <input
                  value={edu.field ?? ""}
                  onChange={(e) =>
                    updateEducation(edu.id, { field: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Graduated</label>
                <input
                  value={edu.graduationDate ?? ""}
                  onChange={(e) =>
                    updateEducation(edu.id, { graduationDate: e.target.value })
                  }
                />
              </div>
            </div>
            <button
              className="btn danger small"
              type="button"
              onClick={() =>
                update({
                  education: profile.education.filter((e) => e.id !== edu.id),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="row">
        <button className="btn" type="button" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save Master Profile"}
        </button>
      </div>
    </div>
  );
}
