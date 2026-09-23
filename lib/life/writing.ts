export type Kind = "article" | "post" | "document";

/** Something written, found from the life page's search. Each result flies in as a bird. */
export interface Writing {
  title: string;
  kind: Kind;
  /** Where it opens. Without one, the bird still shows its title but leads nowhere. */
  href?: string;
  /** Words a search should also find it by. */
  about: string[];
  /** A species id from lib/life/birds.ts; otherwise one is dealt out in list order. */
  bird?: string;
}

export interface Entry extends Writing {
  id: string;
  bird: string;
  /** Lowercase, accent-free title and subjects, for search. */
  terms: string;
  titleTerms: string;
}

// Examples until the real pieces are written: titles and subjects only, no links yet.
export const writing: Writing[] = [
  { title: "Why wa and ga stopped confusing me", kind: "post", about: ["japanese", "grammar", "particles", "は", "が"] },
  { title: "Kanji by radicals, not by rote", kind: "article", about: ["japanese", "writing", "漢字", "memory"] },
  { title: "Six months of shadowing NHK Easy News", kind: "post", about: ["japanese", "listening", "immersion", "speaking"] },
  { title: "Pitch accent for people who hate pitch accent", kind: "article", about: ["japanese", "speaking", "pronunciation"] },
  { title: "My Anki settings", kind: "document", about: ["japanese", "flashcards", "spaced repetition", "memory"] },
  { title: "Keigo, in the order you actually need it", kind: "article", about: ["japanese", "politeness", "敬語", "grammar"] },
  { title: "Evals before prompts", kind: "article", about: ["llms", "ai", "evals", "testing", "prompting"] },
  { title: "What a KV cache actually saves", kind: "post", about: ["llms", "ai", "inference", "performance"] },
  { title: "Chunking is the whole retrieval game", kind: "post", about: ["llms", "ai", "retrieval", "rag", "embeddings"] },
  { title: "Tool use, schemas, and when to say no", kind: "article", about: ["llms", "ai", "agents", "tools", "mcp"] },
  { title: "A small golden set beats a big vibe check", kind: "post", about: ["llms", "ai", "evals", "testing"] },
  { title: "Reading list: making inference cheap", kind: "document", about: ["llms", "ai", "inference", "quantization", "papers"] },
  { title: "Fine-tuning with LoRA on one GPU", kind: "article", about: ["llms", "ai", "training", "fine-tuning"] },
  { title: "Dashi from scratch, and from a packet", kind: "post", about: ["cooking", "japanese", "stock", "kombu", "katsuobushi"] },
  { title: "Sourdough hydration, charted", kind: "document", about: ["cooking", "bread", "baking", "starter"] },
  { title: "The brisket stall, and waiting it out", kind: "post", about: ["cooking", "bbq", "smoke", "texas"] },
  { title: "Kimchi, week by week", kind: "post", about: ["cooking", "fermentation", "korean"] },
  { title: "Onigiri for the road", kind: "post", about: ["cooking", "japanese", "rice"] },
  { title: "Knife skills I practice every week", kind: "article", about: ["cooking", "technique", "knives"] },
];

export const normalize = (text: string) => text.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const slug = (text: string) => normalize(text).replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "writing";

/**
 * Gives each piece a stable id, and a bird: its own, or one of `species` dealt out in list order
 * with a stride, so neighbors (which tend to share a subject, and so a search) differ.
 */
export function indexWriting(items: Writing[], species: string[]): Entry[] {
  const seen = new Map<string, number>();
  return items.map((item, index) => {
    const base = slug(item.title);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    return {
      ...item,
      id,
      bird: item.bird ?? species[(index * 7) % species.length],
      titleTerms: normalize(item.title),
      terms: normalize([item.title, item.kind, ...item.about].join(" ")),
    };
  });
}

/** Entries matching every word, titles that begin a word with it first, then in list order. */
export function searchWriting(entries: Entry[], query: string): Entry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const startsWord = (text: string, word: string) => text.startsWith(word) || text.includes(` ${word}`);
  return entries
    .map((entry, order) => {
      if (!words.every((word) => entry.terms.includes(word))) return null;
      const score = words.reduce((sum, word) => sum + (startsWord(entry.titleTerms, word) ? 3 : entry.titleTerms.includes(word) ? 2 : 1), 0);
      return { entry, score, order };
    })
    .filter((hit) => hit !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((hit) => hit.entry);
}
