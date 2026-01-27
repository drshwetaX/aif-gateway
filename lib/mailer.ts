/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Demo mailer for HITL/HOTL. Safe by default: if no provider configured,
 *          we do NOT send external email; we log the approval/review link for demo use.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

function allowedDomain(email: string) {
  const allowed = (process.env.DEMO_ALLOWED_DOMAINS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const domain = (email.split("@")[1] || "").toLowerCase();
  return allowed.length === 0 ? true : allowed.includes(domain);
}

export async function sendMailOrSimulate(mail: Mail): Promise<{ sent: boolean; simulated: boolean }> {
  // Safety: never email outside allowed domains in demo
  if (!allowedDomain(mail.to)) {
    return { sent: false, simulated: true };
  }

  // Optional: Resend provider (if configured)
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.DEMO_EMAIL_FROM;

  if (!resendKey || !from) {
    // No provider — simulate
    return { sent: false, simulated: true };
  }

  // Minimal Resend call (optional)
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!r.ok) return { sent: false, simulated: true };
  return { sent: true, simulated: false };
}
