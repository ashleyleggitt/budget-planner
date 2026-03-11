import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Budget Planner",
    short_name: "Budget Planner",
    description: "Track bills, savings goals, and monthly budgets in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d4af37",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}