import { AppleAscii } from "@/components/apple-ascii";

export default function Home() {
  return (
    <main className="landing">
      <div className="composition">
        <AppleAscii />
        <section className="identity" aria-label="Introduction">
          <h1>antonio rivera</h1>
          <p className="role">software engineer</p>
        </section>
      </div>
    </main>
  );
}
