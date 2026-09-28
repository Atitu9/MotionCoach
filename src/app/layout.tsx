import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotionCoach — AI Fitness Challenge",
  description:
    "Your camera becomes your personal movement coach. Three rounds, real-time form feedback, no controller.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
