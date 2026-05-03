import { Resend } from 'resend';

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || 'https://mydrmeet.netlify.app';
const FROM_EMAIL = 'DrMeet <hello@drmeet.jamesdeguzman.com>';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getBaseTemplate({
  title,
  subtitle,
  bodyHtml,
  ctaLabel = 'Open DrMeet',
  ctaHref = CLIENT_ORIGIN,
}) {
  return `
    <div style="margin:0;padding:0;background:#f0f6ff;font-family:Segoe UI,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        
        <div style="background:#0f4da8;color:#fff;border-radius:14px 14px 0 0;padding:20px 24px;">
          <div style="font-size:14px;letter-spacing:0.06em;opacity:0.9;">DRMEET</div>
          <h1 style="margin:8px 0 6px;font-size:26px;line-height:1.2;">${title}</h1>
          <p style="margin:0;font-size:15px;opacity:0.95;">${subtitle}</p>
        </div>

        <div style="background:#fff;border:1px solid #d4e3ff;border-top:none;border-radius:0 0 14px 14px;padding:24px;">

          <!-- ✅ LOGO FIXED HERE -->
          <div style="text-align:center;margin-bottom:18px;">
            <img 
              src="https://res.cloudinary.com/drmeetapp/image/upload/v1777737258/drmeet-logo_cxza21.webp"
              alt="DrMeet Logo"
              style="height:56px;max-width:180px;object-fit:contain;display:block;margin:0 auto;"
            />
          </div>

          <div style="color:#1d2b48;font-size:15px;line-height:1.6;">
            ${bodyHtml}
          </div>

          <div style="margin-top:24px;">
            <a href="${ctaHref}" style="display:inline-block;background:#1b67d7;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              ${ctaLabel}
            </a>
          </div>

        </div>
      </div>
    </div>
  `;
}

async function sendEmailSafe({ to, subject, html }) {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[EMAIL] RESEND_API_KEY missing. Skipping email send.');
    return { sent: false, error: 'RESEND_API_KEY missing' };
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error(
      '[EMAIL] Failed to send via Resend:',
      error?.message || error,
    );
    return { sent: false, error: error?.message || 'Failed to send email' };
  }
}

export async function sendDoctorWelcomeEmail({
  email,
  title,
  firstName,
  lastName,
}) {
  const normalizedTitle = String(title || 'Dr.')
    .toLowerCase()
    .replace('.', '');

  const resolvedTitle = normalizedTitle === 'dra' ? 'Dra.' : 'Dr.';

  const displayName = [resolvedTitle, firstName, lastName]
    .filter(Boolean)
    .join(' ');
  console.log({ normalizedTitle, resolvedTitle, displayName });
  const html = getBaseTemplate({
    title: `Welcome ${displayName}`,
    subtitle: 'Your DrMeet doctor workspace is now ready.',
    bodyHtml: `
      <p>Hi ${displayName},</p>
      <p>Welcome to DrMeet. Your doctor account is active and you can now manage your profile, appointments, and patient communication.</p>
      <p>You can also add and link receptionists from your Doctors tab to help coordinate your clinic workflow.</p>
    `,
  });
  return sendEmailSafe({
    to: email,
    subject: `Welcome ${displayName} to DrMeet`,
    html,
  });
}

export async function sendPatientWelcomeEmail({ email, firstName }) {
  const html = getBaseTemplate({
    title: 'Welcome to DrMeet',
    subtitle: 'Your patient account is now active.',
    bodyHtml: `
      <p>Hi ${firstName || 'there'},</p>
      <p>Welcome to DrMeet. You can now complete your patient profile, book appointments, and securely message your care team.</p>
      <p>We are glad to have you with us.</p>
    `,
  });
  return sendEmailSafe({
    to: email,
    subject: 'Welcome to DrMeet',
    html,
  });
}

export async function sendReceptionistInviteEmail({
  email,
  doctorName,
  inviteLink,
}) {
  const html = getBaseTemplate({
    title: 'Clinic Staff Invitation',
    subtitle: 'You were invited to join DrMeet as a receptionist.',
    bodyHtml: `
      <p>Hi,</p>
      <p>${doctorName} invited you to join their clinic team on DrMeet as a receptionist.</p>
      <p>Use the button below to sign in or continue account setup.</p>
    `,
    ctaLabel: 'Open DrMeet Login',
    ctaHref: inviteLink || `${CLIENT_ORIGIN}/#login`,
  });
  return sendEmailSafe({
    to: email,
    subject: "You're invited to DrMeet clinic staff",
    html,
  });
}
