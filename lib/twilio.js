const TWILIO_API_URL = (accountSid) => `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

// Outside the 24-hour session window, WhatsApp only allows sending an
// approved template (see TWILIO_WHATSAPP_TEMPLATE_SID in the README), not a
// free-form Body. Pass `body` for free-form (Sandbox/session-window testing)
// or `templateVariables` for the approved-template path — reminders.js
// builds both and picks whichever this function ends up needing.
async function sendWhatsAppMessage({ to, body, templateVariables }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
  if (!accountSid || !authToken || !from) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM is not set');
  }

  const params = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
  });

  if (templateSid) {
    params.set('ContentSid', templateSid);
    params.set('ContentVariables', JSON.stringify(templateVariables));
  } else {
    params.set('Body', body);
  }

  const resp = await fetch(TWILIO_API_URL(accountSid), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '');
    throw new Error(`Twilio API responded ${resp.status}: ${bodyText}`);
  }

  return resp.json();
}

module.exports = { sendWhatsAppMessage };
