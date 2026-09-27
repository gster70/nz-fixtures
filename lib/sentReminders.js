const fs = require('fs');
const path = require('path');

const SENT_PATH = path.join(__dirname, '..', 'data', 'sentReminders.json');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // keep entries around for a week, then let them fall off

// Shape: { [fixtureId]: { [channel]: isoTimestamp } }
// Tracked per channel (not just per fixture) so if e.g. the email send
// succeeds but the WhatsApp send fails, the next check only retries the
// channel that actually failed instead of re-sending both or neither.

function load() {
  try {
    return JSON.parse(fs.readFileSync(SENT_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(sent) {
  fs.mkdirSync(path.dirname(SENT_PATH), { recursive: true });
  fs.writeFileSync(SENT_PATH, JSON.stringify(sent, null, 2));
}

function prune(sent) {
  const cutoff = Date.now() - MAX_AGE_MS;
  const pruned = {};
  for (const [id, channels] of Object.entries(sent)) {
    const latest = Math.max(...Object.values(channels).map((t) => new Date(t).getTime()));
    if (latest >= cutoff) pruned[id] = channels;
  }
  return pruned;
}

function hasSent(id, channel) {
  const sent = load();
  return Boolean(sent[id]?.[channel]);
}

// Marks a fixture+channel as reminded and writes to disk immediately, so a
// crash mid-batch can't cause the same reminder to be sent twice on restart.
function markSent(id, channel) {
  const sent = prune(load());
  sent[id] = { ...sent[id], [channel]: new Date().toISOString() };
  save(sent);
}

module.exports = { hasSent, markSent };
