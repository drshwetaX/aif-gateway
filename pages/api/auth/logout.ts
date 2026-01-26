import type { NextApiRequest, NextApiResponse } from "next";

function clearCookie(name: string) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${name}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookieName = process.env.DEMO_COOKIE_NAME || "aif_demo_auth";
  res.setHeader("Set-Cookie", clearCookie(cookieName));
  res.status(200).json({ ok: true });
}
