const CONTACT_EMAIL = "contact@jatek.app";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactFormInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function parseContactForm(body: unknown): ContactFormInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (
    name.length < 2 || name.length > 100 ||
    !EMAIL_PATTERN.test(email) || email.length > 254 ||
    subject.length < 3 || subject.length > 160 ||
    message.length < 10 || message.length > 5_000
  ) {
    return null;
  }

  return { name, email, subject, message };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendContactEmail(input: ContactFormInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Contact email service is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [CONTACT_EMAIL],
      reply_to: input.email,
      subject: `[Jatek Support] ${input.subject}`,
      text: `Nom : ${input.name}\nEmail : ${input.email}\n\n${input.message}`,
      html: `
        <h2>Nouveau message depuis jatek.app</h2>
        <p><strong>Nom :</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email :</strong> ${escapeHtml(input.email)}</p>
        <p><strong>Sujet :</strong> ${escapeHtml(input.subject)}</p>
        <hr />
        <p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
  }
}