export interface SkillGroup {
  title: string;
  /** Daily tools, shown larger and brighter. */
  core: readonly string[];
  more: readonly string[];
}

export const skillGroups: readonly SkillGroup[] = [
  { title: "languages", core: ["C#", "Java", "Python", "TypeScript", "SQL", "PHP"], more: ["Go", "Rust", "JavaScript", "Kotlin", "Dart", "Shell", "HTML", "CSS"] },
  { title: "ai", core: ["Agentic Workflows", "AI Integrations"], more: ["MCP (Model Context Protocol)", "RAG (Retrieval-Augmented Generation)", "Vector Databases (Qdrant)", "Hybrid Search Retrieval", "OCR (RapidOCR)"] },
  { title: "data", core: ["NeonDB (PostgreSQL)"], more: ["SQLite", "MongoDB", "NoSQL", "Supabase", "Pandas", "JDBC", "Database Design"] },
  { title: "domains", core: [], more: ["Government Compliance", "Payroll Systems"] },
  { title: "frameworks", core: [".NET", "React"], more: ["Next.js", "Express", "FastAPI", "Flask", "Django", "Laminas", "Prisma", "Three.js", "Tailwind CSS", "shadcn", "Vite"] },
  { title: "infrastructure", core: ["Docker", "Kubernetes"], more: ["Docker Compose", "AWS", "Google Cloud (GCP)", "Cloudflare", "Vercel", "Linux", "CI/CD", "Git", "GitHub"] },
  { title: "practice", core: [], more: ["REST APIs", "API Design", "Microservices", "Unit Testing", "PHPUnit", "Selenium", "Frontend Test Automation", "Web Scraping", "Responsive Design"] },
  { title: "native", core: [], more: ["GTK4", "ratatui", "Poppler", "Cairo"] },
];

export const skills = skillGroups.flatMap((group) => [...group.core, ...group.more]);

/** Core items render at roughly twice the height of the rest. */
const weight = (group: SkillGroup) => 1.4 + group.core.length * 2 + group.more.length;

/** Keep whole groups together and balance the two crawling columns by rendered height. */
export function splitSkillColumns(groups: readonly SkillGroup[]): [SkillGroup[], SkillGroup[]] {
  const total = groups.reduce((sum, group) => sum + weight(group), 0);
  let best: [SkillGroup[], SkillGroup[]] = [[...groups], []];
  let bestGap = Infinity;
  for (let split = 1; split < groups.length; split++) {
    const left = groups.slice(0, split);
    const gap = Math.abs(total - 2 * left.reduce((sum, group) => sum + weight(group), 0));
    if (gap < bestGap) { bestGap = gap; best = [left, groups.slice(split)]; }
  }
  return best;
}

export const skillColumns = splitSkillColumns(skillGroups);
