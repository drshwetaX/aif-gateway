import type { NextApiRequest, NextApiResponse } from "next";

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const configured = process.env.DEMO_PASSWORD;
  if (!configured) return res.status(500).json({ ok: false, error: "DEMO_PASSWORD not set" });

  const { password } = req.body ?? {};
  if (typeof password !== "string") return res.status(400).json({ ok: false, error: "Missing password" });

  if (password !== configured) return res.status(401).json({ ok: false, error: "Invalid password" });

  const cookieName = process.env.DEMO_COOKIE_NAME || "aif_demo_auth";

  // Simple session marker (not a JWT): just a fixed value
  res.setHeader("Set-Cookie", serializeCookie(cookieName, "1", 60 * 60 * 12)); // 12 hours
  return res.status(200).json({ ok: true });
}
