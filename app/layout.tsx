import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MuscleScout · Find your next chapter",
  description:
    "An independent classic car search workspace. Mustangs, Camaros and Corvettes, with honest source coverage and travel estimates.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
