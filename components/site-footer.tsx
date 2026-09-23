"use client";

import { RETURN, travelTo } from "@/lib/story-scroll";
import { profile } from "@/lib/profile";

const LAYERS = ["sky", "far", "mid", "near"] as const;

export function SiteFooter() {
  return (
    <footer id="contact" className="site-footer">
      <div className="footer-text">
        <div>
          <p className="footer-name">antonio rivera</p>
          <p className="footer-role">software engineer · {profile.location.toLowerCase()}</p>
        </div>
        <ul className="footer-links">
          <li><a href={profile.linkedin} target="_blank" rel="noreferrer">linkedin</a></li>
          <li><a href={profile.github} target="_blank" rel="noreferrer">github</a></li>
          <li><a href={`mailto:${profile.email}`}>email</a></li>
          <li><a href={profile.resumePdf} download>résumé</a></li>
        </ul>
        <button className="footer-top" type="button" onClick={() => travelTo(0, { pace: RETURN })}>back to the top ↑</button>
      </div>
      <div className="footer-drawing" aria-hidden="true">
        {LAYERS.map((layer) => <div key={layer} className={`footer-layer footer-${layer}`} />)}
      </div>
    </footer>
  );
}
