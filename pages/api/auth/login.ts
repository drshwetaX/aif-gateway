/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Email+password login with allowlist enforcement and signed cookie session.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  cookieSerialize,
  getCookieName,
  isDemoExpiredNow,
  isEmailAllowed,
  signSession,
} from "../../../lib/demoAuth";
import { Store } from "../../../lib/store";
import { hashEmail } from "../../../lib/safeLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (isDemoExpiredNow()) return res.status(403).json({ error: "Demo expired" });

  const { email, password } = req.body || {};
  const emailStr = String(email || "").trim().toLowerCase();
  const passStr = String(password || "");

  const demoPass = process.env.DEMO_PASSWORD || "";
  const secret = process.env.DEMO_AUTH_SECRET || "";

  if (!secret || secret.length < 32) return res.status(500).json({ error: "Missing/weak DEMO_AUTH_SECRET" });
  if (passStr !== demoPass) return res.status(401).json({ error: "Invalid credentials" });
  if (!isEmailAllowed(emailStr)) return res.status(403).json({ error: "Email is not allowlisted" });

  const now = Math.floor(Date.now() / 1000);
  const maxAge = 60 * 60 * 8; // 8 hours
  const token = signSession({ email: emailStr, iat: now, exp: now + maxAge }, secret);

  res.setHeader("Set-Cookie", cookieSerialize(getCookieName(), token, maxAge));
  await Store.appendAudit({ ts: Date.now(), type: "auth.login", user: hashEmail(emailStr), data: { ok: true } });
  return res.status(200).json({ ok: true });
}
