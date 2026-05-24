import type { MetadataRoute } from "next";

/** Web app manifest — generated route (correct MIME type) for installability. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Waryt CRM",
    short_name: "Waryt",
    description: "Waryt Furniture — showroom & field sales, pipeline, and teams.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#c45c2e",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/warretlogo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/warretlogo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
