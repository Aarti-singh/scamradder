// =============================================
//  ScamRadar — Feed Logic
// =============================================

let feedPage = 1;
let activeTab = 'latest';
let activeTagFilter = null;
let newReportQueue = 0;
let reactionState = {}; // postId -> reaction

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  await renderFeed();
  await renderSidebars();
  startLiveTicker();

  setTimeout(() => showNewReportBanner(2), 18000);
  setTimeout(() => showNewReportBanner(1), 45000);
});

// ---- RENDER FEED ----
async function renderFeed() {
  const container = document.getElementById('feedPosts');
  container.innerHTML = `<div class="searching-anim"><div class="ocr-spinner"></div><span>Loading feed...</span></div>`;

  try {
    let url = `${API_BASE}/feed?tab=${activeTab}&limit=${feedPage * 5}`;
    if (activeTagFilter) url += `&tag=${encodeURIComponent(activeTagFilter)}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (!data.reports || data.reports.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <div style="font-size:3rem;margin-bottom:16px">📭</div>
          <h3>No reports yet</h3>
          <p style="color:var(--muted)">Be the first to report a scam</p>
          <a href="report.html" class="btn-primary" style="display:inline-block;margin-top:16px">Report a Scam →</a>
        </div>`;
      document.getElementById('loadMoreBtn').style.display = 'none';
      return;
    }

    container.innerHTML = data.reports.map(p => renderPostFromAPI(p)).join('');

    document.getElementById('loadMoreBtn').style.display =
      data.reports.length >= data.total ? 'none' : 'block';

  } catch (err) {
    console.error('Feed error:', err);
    // Fallback to mock data
    const posts = getFeedPosts().slice(0, feedPage * 5);
    container.innerHTML = posts.map(p => renderPost(p)).join('');
  }
}
// ---- RENDER POST FROM API ----
function renderPostFromAPI(r) {
  const entity   = r.entities?.[0] || null;
  const hasLoss  = r.amount_lost > 0;
  const riskLevel = r.entity_info?.[0]?.report_count >= 10 ? 'high' :
                    r.entity_info?.[0]?.report_count >= 3  ? 'medium' : 'low';

  const reactions  = r.reactions || {};
  const total      = Object.values(reactions).reduce((s, v) => s + v, 0);
  const myReaction = reactionState[r._id];
  const story      = r.description || '';
  const anon       = `${ANON_NAMES[Math.floor(Math.random() * ANON_NAMES.length)]}#${Math.floor(1000 + Math.random() * 9000)}`;
  const city       = CITIES[Math.floor(Math.random() * CITIES.length)];

  return `
    <div class="feed-post" id="post-${r._id}">
      <div class="post-header">
        <div class="post-avatar">🕵️</div>
        <div class="post-meta">
          <div class="post-anon">${anon}</div>
          <div class="post-submeta">
            <span class="post-time">🕐 ${r.time_ago || 'recently'}</span>
            <span class="post-dot">·</span>
            <span class="post-city">📍 ${city}</span>
            <span class="post-dot">·</span>
            <span class="post-platform">via ${r.platform}</span>
          </div>
        </div>
        <div class="post-risk-badge">${riskBadge(riskLevel)}</div>
      </div>

      <div class="post-type-row">
        <span class="post-type-pill">${r.scam_type}</span>
        ${hasLoss ? `<span class="post-loss-pill">💸 Lost ${formatAmount(r.amount_lost)}</span>` : '<span class="post-safe-pill">✅ No loss</span>'}
      </div>

      <div class="post-title">${r.scam_type} report — ${r.platform}</div>

      <div class="post-story" id="story-${r._id}">
        <div class="story-text ${story.length > 240 ? 'truncated' : ''}" id="storyText-${r._id}">
          ${story}
        </div>
        ${story.length > 240 ? `<button class="read-more-btn" id="rmBtn-${r._id}" onclick="toggleStory('${r._id}')">Read more</button>` : ''}
      </div>

      ${entity ? `
        <div class="post-entity-row">
          <span class="post-entity-label">Reported entity:</span>
          <a href="search.html?q=${encodeURIComponent(entity.value)}" class="post-entity-chip">
            ${entityIcon(entity.type)} ${entity.value}
            <span class="entity-check-label">→ Check risk</span>
          </a>
        </div>` : ''}

      <div class="post-tags">
        ${(r.tags || []).map(t => `<span class="post-tag" onclick="filterByTag('${t}')">#${t.replace(/\s+/g,'')}</span>`).join('')}
      </div>

      <div class="post-actions">
        <div class="reaction-bar">
          ${['🙏','😡','⚠️','👍','😰'].map(emoji => `
            <button class="reaction-btn ${myReaction === emoji ? 'reacted' : ''}"
              onclick="reactToPost('${r._id}', '${emoji}')">
              ${emoji} <span class="reaction-count">${reactions[emoji] || 0}</span>
            </button>`).join('')}
          <span class="total-reactions">${total} reactions</span>
        </div>
        <div class="post-action-btns">
          <button class="action-btn" onclick="openComments('${r._id}')">
            💬 ${r.comment_count || 0} Comments
          </button>
          <button class="action-btn" onclick="sharePost('${r._id}')">
            🔗 Share
          </button>
        </div>
      </div>
    </div>`;
}

function totalReactions(p) {
  return Object.values(p.reactions || {}).reduce((s,v) => s+v, 0);
}

// ---- RENDER SINGLE POST ----
function renderPost(p) {
  const total = totalReactions(p);
  const myReaction = reactionState[p.id];
  const hasLoss = p.amountLost > 0;

  return `
    <div class="feed-post ${p.isNew ? 'feed-post-new' : ''}" id="post-${p.id}">

      <!-- POST HEADER -->
      <div class="post-header">
        <div class="post-avatar">${p.avatar}</div>
        <div class="post-meta">
          <div class="post-anon">${p.anon}</div>
          <div class="post-submeta">
            <span class="post-time">🕐 ${p.time}</span>
            <span class="post-dot">·</span>
            <span class="post-city">📍 ${p.city}</span>
            <span class="post-dot">·</span>
            <span class="post-platform">via ${p.platform}</span>
          </div>
        </div>
        <div class="post-risk-badge">${riskBadge(p.riskLevel)}</div>
      </div>

      <!-- SCAM TYPE PILL -->
      <div class="post-type-row">
        <span class="post-type-pill">${p.scamType}</span>
        ${hasLoss ? `<span class="post-loss-pill">💸 Lost ${formatAmount(p.amountLost)}</span>` : '<span class="post-safe-pill">✅ No loss</span>'}
      </div>

      <!-- TITLE -->
      <div class="post-title">${p.title}</div>

      <!-- STORY -->
      <div class="post-story" id="story-${p.id}">
        <div class="story-text ${p.story.length > 240 ? 'truncated' : ''}" id="storyText-${p.id}">
          ${p.story}
        </div>
        ${p.story.length > 240 ? `<button class="read-more-btn" id="rmBtn-${p.id}" onclick="toggleStory('${p.id}')">Read more</button>` : ''}
      </div>

      <!-- ENTITY CHIP -->
      ${p.entity ? `
        <div class="post-entity-row">
          <span class="post-entity-label">Reported entity:</span>
          <a href="search.html?q=${encodeURIComponent(p.entity.value)}" class="post-entity-chip">
            ${entityIcon(p.entity.type)} ${p.entity.value}
            <span class="entity-check-label">→ Check risk</span>
          </a>
        </div>` : ''}

      <!-- TAGS -->
      <div class="post-tags">
        ${p.tags.map(t => `<span class="post-tag" onclick="filterByTag('${t}')">#${t.replace(/\s+/g,'')}</span>`).join('')}
      </div>

      <!-- REACTIONS -->
      <div class="post-actions">
        <div class="reaction-bar">
          ${REACTIONS.map(r => `
            <button class="reaction-btn ${myReaction === r ? 'reacted' : ''}"
              onclick="react('${p.id}', '${r}', this)">
              ${r} <span class="reaction-count">${(p.reactions[r] || 0) + (myReaction === r ? 1 : 0)}</span>
            </button>
          `).join('')}
        </div>
        <div class="post-action-right">
          <button class="action-btn" onclick="sharePost('${p.id}')">↗ Share <span class="action-count">${p.shares}</span></button>
          <button class="action-btn" onclick="toggleComments('${p.id}')">💬 <span class="action-count">${p.comments}</span></button>
        </div>
      </div>

      <!-- TOTAL REACTIONS LINE -->
      ${total > 0 ? `<div class="post-reaction-summary">${total} people reacted</div>` : ''}

      <!-- COMMENTS PANEL -->
      <div class="comments-panel" id="comments-${p.id}" style="display:none">
        ${renderComments(p.id)}
        <div class="comment-input-row">
          <div class="comment-avatar">🕵️</div>
          <input type="text" class="comment-input" placeholder="Add a comment anonymously..."
            onkeydown="if(event.key==='Enter') submitComment('${p.id}', this)" />
        </div>
      </div>

    </div>
  `;
}

let userComments = {};

async function renderComments(postId) {
  try {
    const res  = await fetch(`${API_BASE}/feed/${postId}/comments`);
    const data = await res.json();
    const all  = [...(data.comments || []), ...(userComments[postId] || [])];

    if (all.length === 0) return '<div class="no-comments">No comments yet. Be the first.</div>';

    return `<div class="comments-list">${all.map(c => `
      <div class="comment">
        <div class="comment-avatar-sm">💬</div>
        <div class="comment-body">
          <div class="comment-anon">${c.anon}</div>
          <div class="comment-text">${c.text}</div>
          <div class="comment-time">${c.time || c.created_at || 'recently'}</div>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    // Fallback to user comments only
    const all = userComments[postId] || [];
    if (all.length === 0) return '<div class="no-comments">No comments yet. Be the first.</div>';
    return `<div class="comments-list">${all.map(c => `
      <div class="comment">
        <div class="comment-avatar-sm">💬</div>
        <div class="comment-body">
          <div class="comment-anon">${c.anon}</div>
          <div class="comment-text">${c.text}</div>
          <div class="comment-time">${c.time}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }
}

function submitComment(postId, input) {
  const text = input.value.trim();
  if (!text) return;
  if (!userComments[postId]) userComments[postId] = [];
  const names = ['MidnightUser', 'IndiaSafe', 'CautiousTiger', 'BraveHeart'];
  userComments[postId].push({
    anon: names[Math.floor(Math.random()*names.length)] + '#' + Math.floor(1000+Math.random()*9000),
    avatar: '🕵️',
    text,
    time: 'Just now',
  });
  input.value = '';
  // Re-render comments panel
  const panel = document.getElementById(`comments-${postId}`);
  if (panel) {
    const inputRow = panel.querySelector('.comment-input-row');
    panel.innerHTML = renderComments(postId);
    panel.appendChild(inputRow || (() => {
      const d = document.createElement('div');
      d.className = 'comment-input-row';
      d.innerHTML = `<div class="comment-avatar">🕵️</div><input type="text" class="comment-input" placeholder="Add a comment anonymously..." onkeydown="if(event.key==='Enter') submitComment('${postId}', this)" />`;
      return d;
    })());
  }
}

// ---- TOGGLE STORY ----
function toggleStory(id) {
  const el = document.getElementById(`storyText-${id}`);
  const btn = document.getElementById(`rmBtn-${id}`);
  if (el.classList.contains('truncated')) {
    el.classList.remove('truncated');
    btn.textContent = 'Show less';
  } else {
    el.classList.add('truncated');
    btn.textContent = 'Read more';
  }
}

// ---- TOGGLE COMMENTS ----
function toggleComments(id) {
  const panel = document.getElementById(`comments-${id}`);
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ---- REACT ----
function react(postId, emoji, btn) {
  const prev = reactionState[postId];
  if (prev === emoji) {
    reactionState[postId] = null;
    btn.classList.remove('reacted');
  } else {
    reactionState[postId] = emoji;
    // Remove reacted class from siblings
    const post = document.getElementById(`post-${postId}`);
    post?.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('reacted'));
    btn.classList.add('reacted');
  }
  // Quick count update
  const countEl = btn.querySelector('.reaction-count');
  const post = FEED_POSTS.find(p => p.id === postId);
  if (post && countEl) {
    const base = post.reactions[emoji] || 0;
    countEl.textContent = base + (reactionState[postId] === emoji ? 1 : 0);
  }
}

// ---- SHARE ----
function sharePost(id) {
  const url = window.location.origin + window.location.pathname + '#post-' + id;
  if (navigator.share) {
    navigator.share({ title: 'ScamRadar Report', url });
  } else {
    navigator.clipboard?.writeText(url);
    showToast('Link copied to clipboard!');
  }
}

// ---- TABS ----
function switchTab(tab, btn) {
  activeTab = tab;
  feedPage = 1;
  document.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed();
}

// ---- TAG FILTER ----
function filterByTag(tag) {
  activeTagFilter = activeTagFilter === tag ? null : tag;
  feedPage = 1;
  // Update sidebar tag buttons
  document.querySelectorAll('.tag-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tag === activeTagFilter);
  });
  renderFeed();
}

// ---- LOAD MORE ----
async function loadMore() {
  feedPage++;
  await renderFeed();
  const posts = document.querySelectorAll('.feed-post');
  if (posts.length > 0) {
    posts[posts.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---- NEW REPORT BANNER ----
function showNewReportBanner(count) {
  newReportQueue += count;
  const banner = document.getElementById('newReportBanner');
  const label = document.getElementById('newReportCount');
  if (banner && label) {
    label.textContent = `${newReportQueue} new report${newReportQueue > 1 ? 's' : ''}`;
    banner.style.display = 'flex';
  }
}

function loadNewReports() {
  document.getElementById('newReportBanner').style.display = 'none';
  newReportQueue = 0;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Add a fake "just posted" item
  showToast('Feed refreshed!');
}

// ---- LIVE TICKER ----
function startLiveTicker() {
  // Update today's stat
  let todayCount = 7;
  document.getElementById('statToday').textContent = todayCount;
  setInterval(() => {
    if (Math.random() > 0.7) {
      todayCount++;
      const el = document.getElementById('statToday');
      if (el) { el.textContent = todayCount; el.classList.add('stat-bump'); setTimeout(() => el.classList.remove('stat-bump'), 600); }
    }
  }, 12000);
}

// ---- TOAST ----
function showToast(msg) {
  let t = document.getElementById('toastEl');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toastEl';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ---- SIDEBARS ----
async function renderSidebars() {
  renderTagFilters();
  renderCityList();
  await renderMostWanted();
  renderTrendMini();
}

function renderTagFilters() {
  const c = document.getElementById('tagFilters');
  if (!c) return;
  c.innerHTML = TAG_FILTER_LIST.map(t => `
    <button class="tag-filter-btn" data-tag="${t.key}" onclick="filterByTag('${t.key}', this)">${t.label}</button>
  `).join('');
}

function renderCityList() {
  const c = document.getElementById('cityList');
  if (!c) return;
  const max = CITY_STATS[0].count;
  c.innerHTML = CITY_STATS.map(s => `
    <div class="city-row">
      <span class="city-name">${s.city}</span>
      <div class="city-bar-wrap"><div class="city-bar" style="width:${(s.count/max)*100}%"></div></div>
      <span class="city-count">${s.count}</span>
    </div>
  `).join('');
}

async function renderMostWanted() {
  const c = document.getElementById('mostWanted');
  if (!c) return;

  try {
    const res  = await fetch(`${API_BASE}/popular?limit=5`);
    const data = await res.json();

    if (!data.entities || data.entities.length === 0) {
      c.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">No flagged entities yet.</p>`;
      return;
    }

    c.innerHTML = data.entities.map((e, i) => `
      <div class="mw-row" onclick="window.location.href='search.html?q=${encodeURIComponent(e.value)}'">
        <span class="mw-rank">${i + 1}</span>
        <div class="mw-info">
          <div class="mw-value">${entityIcon(e.type)} ${e.value}</div>
          <div class="mw-sub">${e.report_count} reports · Score ${e.display_score}</div>
        </div>
        <div class="mw-badge" style="background:rgba(255,77,77,0.1);color:#ff4d4d;border:1px solid rgba(255,77,77,0.2);padding:3px 8px;border-radius:6px;font-size:0.7rem;font-weight:700">${e.display_score}</div>
      </div>`).join('');
  } catch (err) {
    // Fallback to mock data
    c.innerHTML = MOST_WANTED.map((e, i) => `
      <div class="mw-row" onclick="window.location.href='search.html?q=${encodeURIComponent(e.value)}'">
        <span class="mw-rank">${i + 1}</span>
        <div class="mw-info">
          <div class="mw-value">${entityIcon(e.type)} ${e.value}</div>
          <div class="mw-sub">${e.reports} reports · Score ${e.riskScore}</div>
        </div>
        <div class="mw-badge" style="background:rgba(255,77,77,0.1);color:#ff4d4d;border:1px solid rgba(255,77,77,0.2);padding:3px 8px;border-radius:6px;font-size:0.7rem;font-weight:700">${e.riskScore}</div>
      </div>`).join('');
  }
}

function renderTrendMini() {
  const c = document.getElementById('trendMini');
  if (!c) return;
  c.innerHTML = TREND_DATA.map(t => `
    <div class="trend-row">
      <div class="trend-left">
        <div class="trend-type">${t.type}</div>
        <div class="trend-bar-wrap"><div class="trend-bar" style="width:${t.pct}%"></div></div>
      </div>
      <span class="trend-delta ${t.delta.startsWith('+') ? 'up' : 'down'}">${t.delta}</span>
    </div>
  `).join('');
}
