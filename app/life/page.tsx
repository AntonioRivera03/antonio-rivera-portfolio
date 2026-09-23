import type { Metadata } from "next";
import Link from "next/link";
import { LifeJourney } from "@/components/life-journey";
import { LIFE_TITLE } from "@/lib/room/life";

export const metadata: Metadata = {
  title: LIFE_TITLE,
  description: "Antonio Rivera’s life outside of career.",
};

/** Direct visits and refreshes land here; from the room, the same view opens in place. */
export default function LifePage() {
  return (
    <main className="life-view life-page" data-settled="true" aria-labelledby="life-title">
      <Link className="life-back" href="/" aria-label="Back to the portfolio">← back</Link>
      <LifeJourney />
    </main>
  );
}
