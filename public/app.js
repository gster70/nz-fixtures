const NZ_TZ = 'Pacific/Auckland';
const VN_TZ = 'Asia/Ho_Chi_Minh';

const dateFmt = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: NZ_TZ,
});

const timeFmt = new Intl.DateTimeFormat('en-NZ', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: NZ_TZ,
  timeZoneName: 'short',
});

const vnTimeFmt = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: VN_TZ,
  timeZoneName: 'short',
});

function formatKickoff(iso) {
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

function formatVnTime(iso) {
  return vnTimeFmt.format(new Date(iso));
}

function fixtureCard(f, isNext) {
  const el = document.createElement('div');
  el.className = 'fixture-card' + (isNext ? ' next' : '');
  el.dataset.sport = f.sport;

  const badge = isNext ? '<span class="next-badge">Next match</span>' : '';
  const matchType = f.matchType ? `${f.matchType} · ` : '';

  el.innerHTML = `
    ${badge}
    <div class="fixture-teams">${escapeHtml(f.homeTeam)} v ${escapeHtml(f.awayTeam)}</div>
    <div class="fixture-meta">
      <span class="fixture-datetime">${formatKickoff(f.kickoffUtc)}</span>
      <span class="fixture-datetime-vn">${formatVnTime(f.kickoffUtc)} Vietnam</span>
      <span>${escapeHtml(f.venue)}</span>
    </div>
    <div class="fixture-competition">${matchType}${escapeHtml(f.competition)}</div>
  `;
  return el;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderSection(listEl, section) {
  listEl.innerHTML = '';

  if (section.fixtures.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'status-message';
    msg.textContent = section.error
      ? `Couldn't load fixtures right now (${section.error}).`
      : 'No upcoming fixtures found.';
    listEl.appendChild(msg);
    return;
  }

  section.fixtures.forEach((f, i) => {
    listEl.appendChild(fixtureCard(f, i === 0));
  });
}

async function loadFixtures() {
  const rugbyList = document.getElementById('rugby-list');
  const cricketList = document.getElementById('cricket-list');
  const footer = document.getElementById('footer-note');

  try {
    const resp = await fetch('/api/fixtures');
    const data = await resp.json();

    renderSection(rugbyList, data.rugby);
    renderSection(cricketList, data.cricket);

    const times = [data.rugby.updatedAt, data.cricket.updatedAt].filter(Boolean).map((t) => new Date(t));
    if (times.length) {
      const latest = new Date(Math.max(...times));
      footer.textContent = `Data last refreshed ${formatKickoff(latest.toISOString())}`;
    } else {
      footer.textContent = '';
    }
  } catch (err) {
    rugbyList.innerHTML = '<p class="status-message">Failed to load fixtures.</p>';
    cricketList.innerHTML = '<p class="status-message">Failed to load fixtures.</p>';
  }
}

loadFixtures();
