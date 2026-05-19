type FetchLike = typeof fetch;

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
};

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const getDefaultEmailFrom = (env: NodeJS.ProcessEnv = process.env) =>
  env.MAGIC_LINK_FROM_EMAIL || env.RESEND_FROM_EMAIL || 'coopHUB BC <onboarding@resend.dev>';

export const getAccessRequestRecipient = (env: NodeJS.ProcessEnv = process.env) =>
  env.ACCESS_REQUEST_EMAIL || 'hello@coophub.ca';

export const sendResendEmail = async (
  input: SendEmailInput,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: FetchLike } = {},
) => {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  if (!fetchImpl) throw new Error('fetch is not available to send email');

  const response = await fetchImpl(RESEND_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from || getDefaultEmailFrom(env),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Resend email failed with status ${response.status}`);
  }
  return data;
};

export const buildMagicLinkEmail = ({
  loginUrl,
  recipientEmail,
}: {
  loginUrl: string;
  recipientEmail: string;
}) => {
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeRecipientEmail = escapeHtml(recipientEmail);
  const subject = 'Your coopHUB secure sign-in link';
  const text = [
    'Use this secure link to sign in to coopHUB:',
    '',
    loginUrl,
    '',
    'This link expires in 15 minutes. If you did not request it, you can ignore this message.',
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#10231f;background:#f5f2ea;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #dbe5e0">
        <div style="font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#1f6f5b;margin-bottom:20px">coopHUB BC</div>
        <h1 style="font-size:30px;line-height:1.05;margin:0 0 16px">Your secure sign-in link</h1>
        <p style="color:#4f625d;margin:0 0 24px">A sign-in link was requested for <strong>${safeRecipientEmail}</strong>. This link expires in 15 minutes.</p>
        <a href="${safeLoginUrl}" style="display:inline-block;background:#1f6f5b;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 18px;font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase">Sign in to coopHUB</a>
        <p style="color:#6d7f7a;font-size:13px;margin-top:28px">If the button does not work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;color:#1f6f5b;font-size:13px">${safeLoginUrl}</p>
      </div>
    </div>
  `;
  return { subject, text, html };
};

export const buildAccessRequestEmail = ({
  firstName,
  lastName,
  email,
  coopName,
  message,
}: {
  firstName?: string;
  lastName?: string;
  email: string;
  coopName?: string;
  message?: string;
}) => {
  const fullName = [firstName, lastName].map(value => value?.trim()).filter(Boolean).join(' ') || email;
  const safeFullName = escapeHtml(fullName);
  const safeEmail = escapeHtml(email);
  const safeCoopName = escapeHtml(coopName || 'Not provided');
  const safeMessage = escapeHtml(message || 'No message provided.').replace(/\n/g, '<br />');
  const subject = `coopHUB access request from ${fullName}`;
  const text = [
    'New coopHUB access request',
    '',
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Co-op / unit: ${coopName || 'Not provided'}`,
    '',
    message || 'No message provided.',
  ].join('\n');
  const html = `
    <h1>New coopHUB access request</h1>
    <p><strong>Name:</strong> ${safeFullName}</p>
    <p><strong>Email:</strong> ${safeEmail}</p>
    <p><strong>Co-op / unit:</strong> ${safeCoopName}</p>
    <p><strong>Message:</strong></p>
    <p>${safeMessage}</p>
  `;
  return { subject, text, html };
};
