import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget Planner",
  description: "Track bills, savings, and monthly finances in one simple planner.",
  applicationName: "Budget Planner",
  icons: {
    icon: "/budget-icon-v2.png",
    apple: "/budget-icon-v2.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}