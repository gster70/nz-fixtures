const fs = require('fs');
const path = require('path');

const SENT_PATH = path.join(__dirname, '..', 'data', 'sentReminders.json');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // keep entries around for a week, then let them fall off

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
  for (const [id, sentAt] of Object.entries(sent)) {
    if (new Date(sentAt).getTime() >= cutoff) pruned[id] = sentAt;
  }
  return pruned;
}

// Marks a fixture as reminded and writes to disk immediately, so a crash
// mid-batch can't cause the same reminder to be sent twice on restart.
function markSent(id) {
  const sent = prune(load());
  sent[id] = new Date().toISOString();
  save(sent);
}

module.exports = { load, markSent };
