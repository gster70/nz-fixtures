const TWILIO_API_URL = (accountSid) => `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

async function sendWhatsAppMessage({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !from) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM is not set');
  }

  const params = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    Body: body,
  });

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
