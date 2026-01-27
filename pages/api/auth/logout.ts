/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Logout by clearing session cookie.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { clearCookieHeader, getCookieName } from "../../../lib/demoAuth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Set-Cookie", clearCookieHeader(getCookieName()));
  return res.status(200).json({ ok: true });
}
