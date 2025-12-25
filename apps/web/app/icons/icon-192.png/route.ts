import { icon192Png } from "../../pwa-icon-data";

export const runtime = "nodejs";

export function GET() {
  const body = Buffer.from(icon192Png, "base64");
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
