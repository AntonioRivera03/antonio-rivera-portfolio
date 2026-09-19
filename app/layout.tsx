import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "antonio rivera — software engineer",
  description: "antonio rivera. software engineer.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
