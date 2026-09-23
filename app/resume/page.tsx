import type { Metadata } from "next";
import { resume } from "@/lib/crt/resume";
import { skillGroups } from "@/lib/skills";
import { displayUrl, profile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "antonio rivera — résumé",
  description: "Antonio Rivera’s résumé: software engineer in Austin, Texas.",
};

export default function ResumePage() {
  return (
    <main className="resume-page">
      <header>
        <h1>{resume.name}</h1>
        <p className="resume-meta">
          {resume.role} · {profile.location.toLowerCase()} · <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <br />
          <a href={profile.linkedin}>{displayUrl(profile.linkedin)}</a> · <a href={profile.github}>{displayUrl(profile.github)}</a>
        </p>
      </header>
      {resume.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.entries.map((entry) => (
            <div className="resume-entry" key={entry.title}>
              <div className="resume-entry-heading">
                <h3>{entry.title}</h3>
                {entry.date && <p className="resume-date">{entry.date}</p>}
              </div>
              {entry.detail && <p>{entry.link ? <a href={entry.link}>{entry.detail}</a> : entry.detail}</p>}
              {entry.paragraphs?.map((text) => <p key={text}>{text}</p>)}
            </div>
          ))}
        </section>
      ))}
      <section>
        <h2>Skills</h2>
        <ul className="resume-skills">
          {skillGroups.map((group) => <li key={group.title}><span>{group.title}</span>{[...group.core, ...group.more].join(", ")}</li>)}
        </ul>
      </section>
    </main>
  );
}
