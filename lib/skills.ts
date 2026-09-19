export const skills = [
  "PHP", "Java", "TypeScript", "JavaScript", "Python", "SQL", "C#", "Go", "Rust", "Dart",
  "Shell", "Kotlin", "HTML", "CSS", ".NET", "React", "Next.js", "Three.js", "Tailwind CSS",
  "FastAPI", "Flask", "Django", "Laminas", "Express", "Prisma", "Pandas", "PHPUnit", "GTK4",
  "ratatui", "shadcn", "Agentic Workflows", "AI Integrations", "MCP (Model Context Protocol)",
  "RAG (Retrieval-Augmented Generation)", "Vector Databases (Qdrant)", "Hybrid Search Retrieval",
  "OCR (RapidOCR)", "Docker", "Kubernetes", "Docker Compose", "AWS", "Google Cloud (GCP)",
  "Cloudflare", "Supabase", "Vercel", "Vite", "Linux", "CI/CD", "Git", "GitHub", "NoSQL",
  "MongoDB", "NeonDB (PostgreSQL)", "SQLite", "JDBC", "Poppler", "Cairo", "Microservices",
  "REST APIs", "API Design", "Database Design", "Responsive Design", "Web Scraping",
  "Unit Testing", "Frontend Test Automation", "Selenium", "Government Compliance", "Payroll Systems",
] as const;

export const skillColumns = [skills.slice(0, 34), skills.slice(34)] as const;
