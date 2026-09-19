import { AppleAscii } from "@/components/apple-ascii";
import { CrtResume } from "@/components/crt-resume";

export default function Home() {
  return (
    <main>
      <section className="landing">
        <div className="composition">
          <AppleAscii />
          <section className="identity" aria-label="Introduction">
            <h1>antonio rivera</h1>
            <p className="role">software engineer</p>
          </section>
        </div>
      </section>
      <CrtResume />
    </main>
  );
}
