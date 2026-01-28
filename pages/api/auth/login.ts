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
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (isDemoExpiredNow()) return res.status(403).json({ error: "Demo expired" });

    const { email, password } = req.body || {};
    const emailStr = String(email || "").trim().toLowerCase();
    const passStr = String(password || "").trim();

    const demoPass = process.env.DEMO_PASSWORD || "";
    const secret = process.env.DEMO_AUTH_SECRET || "";

    if (!demoPass) return res.status(500).json({ error: "Missing DEMO_PASSWORD" });
    if (!secret || secret.length < 32)
      return res.status(500).json({ error: "Missing/weak DEMO_AUTH_SECRET (>=32 chars)" });

    if (passStr !== demoPass) return res.status(401).json({ error: "Invalid credentials" });
    if (!isEmailAllowed(emailStr)) return res.status(403).json({ error: "Email is not allowlisted" });

    const now = Math.floor(Date.now() / 1000);
    const maxAge = 60 * 60 * 8; // 8 hours
    const token = signSession({ email: emailStr, iat: now, exp: now + maxAge }, secret);

    res.setHeader("Set-Cookie", cookieSerialize(getCookieName(), token, maxAge));

    // ✅ Audit must not break login (Upstash/env issues shouldn't block auth)
    try {
      await Store.appendAudit({
        ts: Date.now(),
        type: "auth.login",
        user: hashEmail(emailStr),
        data: { ok: true },
      });
    } catch (e) {
      console.warn("Store.appendAudit failed (ignored):", e);
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("Login fatal error:", e);
    return res.status(500).json({ error: "Internal Server Error", detail: e?.message || String(e) });
  }
}
