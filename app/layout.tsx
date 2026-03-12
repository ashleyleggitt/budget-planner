import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget365",
  description: "Track bills, savings, and monthly finances in one simple planner.",
  applicationName: "Budget365",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}