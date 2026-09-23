import type { Ref } from "react";

/** The life page's opening, shared by the room's expanding view and the /life page. */
export function LifeIntro({ titleRef }: { titleRef?: Ref<HTMLHeadingElement> }) {
  return (
    <header className="life-intro">
      <h1 ref={titleRef} id="life-title">life outside of career</h1>
      <p className="life-motto role">engineering is a passion, not my life</p>
    </header>
  );
}
