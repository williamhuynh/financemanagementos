export const runtime = "nodejs";

export function GET() {
  const manifest = {
    name: "FinanceLab",
    short_name: "FinanceLab",
    description: "Family finance and wealth management",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f1115",
    theme_color: "#121417",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate"
    }
  });
}
