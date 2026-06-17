import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STEALTH // Job Application Agent",
  description:
    "Autonomous, per-application resume and cover-letter tailoring wired to the mcp-stealth-chrome stack.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="scanline" aria-hidden />
        {children}
      </body>
    </html>
  );
}
