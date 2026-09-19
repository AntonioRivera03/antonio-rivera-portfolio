export interface ResumeEntry {
  title: string;
  detail?: string;
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
// Awaiting Antonio's résumé; no employment or education details are assumed.
export const resume: Resume = {
  name: "antonio rivera",
  role: "software engineer",
  contact: [],
  sections: [],
};
