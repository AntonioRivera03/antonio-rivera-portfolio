export interface ResumeEntry {
  title: string;
  detail?: string;
  /** Where the detail line points in the accessible résumé. */
  link?: string;
  date?: string;
  paragraphs?: string[];
}

export interface ResumeSection {
  title: string;
  entries: ResumeEntry[];
}

export interface Resume {
  name: string;
  role: string;
  contact: string[];
  sections: ResumeSection[];
}

// Content stays in one place for both the CRT document and its accessible view.
export const resume: Resume = {
  name: "antonio rivera",
  role: "software engineer",
  contact: [],
  sections: [{
    title: "Experience",
    entries: [
      {
        title: "Charles Schwab [Associate .NET Engineer]",
        date: "June 2026 – Present",
        paragraphs: ["Build agentic workflows that automate tasks. Develop applications that offer more efficient alternatives to existing tools."],
      },
      {
        title: "Paycom [Full-Stack Software Developer II]",
        date: "November 2024 – February 2026",
        paragraphs: ["Built and modernized applications for government document management, workforce analytics, and employee performance tracking. Improved application and database performance, reducing page load times by 50% and query execution from approximately 8 seconds to 12 milliseconds. Delivered features through production with automated testing and resolved client-impacting issues."],
      },
      {
        title: "CGI [Backend Software Developer]",
        date: "June 2023 – October 2024",
        paragraphs: ["Built backend services and modernized payroll, finance, and timesheet workflows using Java, Python, and SQL. Created an automation tool that migrated 12,000 legacy Java files containing over 160,000 lines of code, completing the migration six months ahead of schedule. Partnered with system architects to deliver time-critical payroll enhancements ahead of schedule."],
      },
    ],
  }, {
    title: "Passion Projects",
    entries: [
      {
        title: "LivedMatch [Research Startup]",
        detail: "livedmatch.com",
        link: "https://www.livedmatch.com/",
        paragraphs: ["Built a patient-trial matching platform with researchers in Canada, using compatibility scoring to support more objective participant selection. Added role-based access, automated outreach, and a deployment pipeline for testing new features."],
      },
      {
        title: "Aycorn [Integrations]",
        detail: "github.com/AntonioRivera03/AIcorn",
        link: "https://github.com/AntonioRivera03/AIcorn",
        paragraphs: ["Integrated AI agents into Aycorn to plan tasks, implement changes, and review code. Added isolated development workspaces and Kubernetes previews for testing application versions before merging changes."],
      },
      {
        title: "Magnolia",
        detail: "github.com/AntonioRivera03/JournalAssistant",
        link: "https://github.com/AntonioRivera03/JournalAssistant",
        paragraphs: ["Built a PDF reader that connects highlighted passages to saved AI conversations. Added local OCR, semantic search, and source citations to help readers explore documents and return to the relevant pages."],
      },
      {
        title: "DocViewer",
        detail: "github.com/AntonioRivera03/DocViewer",
        link: "https://github.com/AntonioRivera03/DocViewer",
        paragraphs: ["Built a native Linux application for reading PDFs and editing text and Markdown documents. Added folder navigation, continuous PDF scrolling, and Markdown previews in a lightweight desktop interface."],
      },
    ],
  }, {
    title: "Education",
    entries: [
      {
        title: "Texas A&M University–Central Texas",
        date: "December 2023",
        detail: "B.S. Computer Information Systems",
      },
    ],
  }],
};
