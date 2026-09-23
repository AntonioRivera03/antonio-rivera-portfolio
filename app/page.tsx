import { CrtResume } from "@/components/crt-resume";
import { LandingIntro } from "@/components/landing-intro";
import { SiteFooter } from "@/components/site-footer";
import { StoryNav } from "@/components/story-nav";

export default function Home() {
  return (
    <>
      <StoryNav />
      <LandingIntro>
        <CrtResume />
      </LandingIntro>
      <SiteFooter />
    </>
  );
}
