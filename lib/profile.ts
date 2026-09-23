export const profile = {
  location: "Austin, Texas",
  email: "antonio7rivera03@gmail.com",
  linkedin: "https://www.linkedin.com/in/antonio-rivera-094438272/",
  github: "https://github.com/AntonioRivera03",
  resumePdf: "/antonio-rivera-resume.pdf",
} as const;

export const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
