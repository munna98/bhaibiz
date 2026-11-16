interface SendActivationEmailParams {
  to: string;
  name?: string;
  confirmUrl: string;
}

export async function sendActivationEmail({ to, name, confirmUrl }: SendActivationEmailParams) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const fromEmail = process.env["RESEND_FROM_EMAIL"] || "BhaiBiz <noreply@noreplay.bhaibiz.com>";
  const displayName = name ? name.trim() : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your BhaiBiz account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 16px; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="padding: 28px 32px; background: #ffffff;">
      <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">BhaiBiz</h1>
      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #334155;">
        ${displayName ? `Hi ${displayName},` : "Hello,"}
      </p>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #475569;">
        Thank you for creating an account with BhaiBiz. Please confirm your email address to activate your account and start managing your company.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${confirmUrl}" style="background-color: #0f172a; color: #ffffff; padding: 13px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
          Confirm my account
        </a>
      </div>
      <p style="margin: 24px 0 8px; font-size: 13px; line-height: 20px; color: #64748b;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin: 0 0 24px; font-size: 12px; line-height: 18px; word-break: break-all; color: #2563eb;">
        <a href="${confirmUrl}" style="color: #2563eb; text-decoration: underline;">${confirmUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
        If you didn't create a BhaiBiz account, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `${displayName ? `Hi ${displayName},\n\n` : "Hello,\n\n"}Thank you for creating an account with BhaiBiz. Please confirm your email address to activate your account by clicking the link below:\n\n${confirmUrl}\n\nIf you didn't create a BhaiBiz account, you can safely ignore this email.\n\n— BhaiBiz Team`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "Confirm your BhaiBiz account",
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Resend] Failed to send activation email:", response.status, errorText);
    throw new Error(`Failed to send activation email: ${errorText}`);
  }

  return await response.json();
}
