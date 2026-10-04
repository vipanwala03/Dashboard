import type { MetadataRoute } from "next";

// Makes the dashboard installable ("Add to Home Screen"): opens full-screen
// on the dashboard with the app's dark theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Dashboard",
    short_name: "Dashboard",
    description: "Personal calendar, to-do, and notes dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#070b14",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
