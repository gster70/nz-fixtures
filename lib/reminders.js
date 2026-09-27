const { readCache } = require('./cache');
const { hasSent, markSent } = require('./sentReminders');
const { sendEmail } = require('./resend');
const { sendWhatsAppMessage } = require('./twilio');

const TEAM_NAMES = { rugby: 'All Blacks', cricket: 'BLACKCAPS' };
const SPORT_LABEL = { rugby: 'All Blacks', cricket: 'Black Caps' };
const NZ_TZ = 'Pacific/Auckland';

// A match becomes "due" once it's 45-60 minutes out. Paired with the
// 15-minute cron cadence, each fixture should land in this window on
// exactly one check under normal conditions.
const WINDOW_MIN_MS = 45 * 60 * 1000;
const WINDOW_MAX_MS = 60 * 60 * 1000;

const nzDateTimeFmt = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: NZ_TZ,
  timeZoneName: 'short',
});

function getOpponent(fixture) {
  const team = TEAM_NAMES[fixture.sport];
  return fixture.homeTeam === team ? fixture.awayTeam : fixture.homeTeam;
}

function findDueFixtures() {
  const cache = readCache() || {};
  const now = Date.now();
  const all = [
    ...(cache.rugby?.fixtures || []),
    ...(cache.cricket?.fixtures || []),
  ];
  return all.filter((f) => {
    const diff = new Date(f.kickoffUtc).getTime() - now;
    return diff >= WINDOW_MIN_MS && diff < WINDOW_MAX_MS;
  });
}

function reminderFields(fixture) {
  const opponent = getOpponent(fixture);
  const label = SPORT_LABEL[fixture.sport];
  const kickoffNZ = nzDateTimeFmt.format(new Date(fixture.kickoffUtc));
  const appUrl = process.env.APP_URL || 'https://nz-fixtures-production.up.railway.app';
  return { opponent, label, kickoffNZ, appUrl };
}

function buildEmail(fixture) {
  const { opponent, label, kickoffNZ, appUrl } = reminderFields(fixture);
  const subject = `${label} v ${opponent} kicks off in about an hour`;
  const html = `
    <p>${label} play <strong>${escapeHtml(opponent)}</strong> in about an hour.</p>
    <p><strong>Competition:</strong> ${escapeHtml(fixture.competition)}</p>
    <p><strong>Kickoff:</strong> ${kickoffNZ}</p>
    <p><a href="${appUrl}">${appUrl}</a></p>
  `.trim();
  return { subject, html };
}

function buildWhatsAppMessage(fixture) {
  const { opponent, label, kickoffNZ, appUrl } = reminderFields(fixture);
  return [
    `*${label} v ${opponent}* kicks off in about an hour`,
    `Competition: ${fixture.competition}`,
    `Kickoff: ${kickoffNZ}`,
    appUrl,
  ].join('\n');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sendEmailReminder(fixture) {
  const to = process.env.REMINDER_TO_EMAIL;
  if (!to || !process.env.RESEND_API_KEY) return;
  if (hasSent(fixture.id, 'email')) return;

  try {
    const { subject, html } = buildEmail(fixture);
    await sendEmail({ to, subject, html });
    markSent(fixture.id, 'email');
    console.log(`[reminder] email sent for ${fixture.id}: ${subject}`);
  } catch (err) {
    console.error(`[reminder] email failed for ${fixture.id}:`, err.message);
  }
}

async function sendWhatsAppReminder(fixture) {
  const to = process.env.REMINDER_WHATSAPP_TO;
  if (!to || !process.env.TWILIO_ACCOUNT_SID) return;
  if (hasSent(fixture.id, 'whatsapp')) return;

  try {
    const body = buildWhatsAppMessage(fixture);
    await sendWhatsAppMessage({ to, body });
    markSent(fixture.id, 'whatsapp');
    console.log(`[reminder] whatsapp sent for ${fixture.id}`);
  } catch (err) {
    console.error(`[reminder] whatsapp failed for ${fixture.id}:`, err.message);
  }
}

async function checkAndSendReminders() {
  const due = findDueFixtures();
  for (const fixture of due) {
    await sendEmailReminder(fixture);
    await sendWhatsAppReminder(fixture);
  }
}

module.exports = { checkAndSendReminders, findDueFixtures, buildEmail, buildWhatsAppMessage, getOpponent };
