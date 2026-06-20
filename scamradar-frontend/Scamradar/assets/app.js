// =============================================
//  ScamRadar — App Logic (with Safety Layers)
// =============================================

// ---- UTILS ----
function riskBadge(level, count) {
  // count = optional report count to show factual label
  const map = {
    high:   `<span class="risk-badge risk-high">🔴 Reported ${count ? count + 'x' : 'multiple times'}</span>`,
    medium: `<span class="risk-badge risk-medium">🟡 Reported ${count ? count + 'x' : 'a few times'}</span>`,
    low:    `<span class="risk-badge risk-low">🟢 No reports found</span>`,
  };
  return map[level] || map.low;
}
function riskBarColor(level) {
  return level === 'high' ? '#ff4d4d' : level === 'medium' ? '#ff8c42' : '#22d17a';
}
function entityIcon(type) {
  return type === 'phone' ? '📱' : type === 'upi' ? '💳' : '📧';
}
function timeAgo(dateStr) {
  if (!dateStr) return 'N/A';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day ago';
  if (diff < 30)  return `${diff} days ago`;
  if (diff < 365) return `${Math.floor(diff/30)} months ago`;
  return `${Math.floor(diff/365)} years ago`;
}
function formatAmount(n) {
  if (!n) return null;
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n}`;
}
function toggleMobileMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
}
// ---- DECAY HELPERS ----
function getDisplayScore(e) {
  return computeDecayedScore(e.riskScore, e.lastSeen);
}
function getDisplayLevel(e) {
  return getDecayedLevel(getDisplayScore(e));
}
function isDecayed(e) {
  if (!e.lastSeen) return false;
  const days = Math.floor((new Date() - new Date(e.lastSeen)) / 86400000);
  return days >= 90;
}
// ---- SEARCH ----
async function performSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  document.getElementById('defaultState') && (document.getElementById('defaultState').style.display = 'none');

  const url = new URL(window.location.href);
  url.searchParams.set('q', q);
  window.history.replaceState({}, '', url);

  const container = document.getElementById('searchResults');
  container.innerHTML = `<div class="searching-anim"><div class="ocr-spinner"></div><span>Searching database...</span></div>`;

  try {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <div style="font-size:3rem;margin-bottom:16px">✅</div>
          <h3>No reports found for "${q}"</h3>
          <p style="color:var(--muted);margin-bottom:20px">This entity has not been reported by the community.</p>
          <a href="report.html" class="btn-primary" style="display:inline-block">Report this entity →</a>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="results-header">
        <span class="results-count">${data.total} result${data.total > 1 ? 's' : ''} for "<strong>${q}</strong>"</span>
      </div>
      ${data.results.map(e => renderEntityCardFromAPI(e)).join('')}
    `;
  } catch (err) {
    container.innerHTML = `<div class="no-results"><p>⚠️ Could not connect to server. Please try again.</p></div>`;
  }
}
// ---- ENTITY CARD (with all 4 safety layers) ----
function renderEntityCardFromAPI(e) {
  // Map API response fields to what renderEntityCard expects
  const mapped = {
    id: e.id,
    value: e.value,
    type: e.type,
    reportCount: e.report_count,
    riskScore: e.display_score,
    lastSeen: e.last_seen,
    tags: e.tags || [],
    description: e.description,
    disputed: e.disputed,
    disputeNote: e.dispute_note,
  };

  const displayScore = e.display_score;
  const displayLevel = e.display_level;
  const decayed      = e.is_decayed;
  const belowThreshold = e.below_threshold;
  const linkedReports  = e.linked_reports || [];

  const thresholdBanner = belowThreshold ? `
    <div class="safety-banner safety-threshold">
      <span>🔒</span>
      <div><strong>Low-confidence result</strong> — Only ${e.report_count} report${e.report_count > 1 ? 's' : ''} submitted.
      Minimum ${REPORT_THRESHOLD} independent reports required.</div>
    </div>` : '';

  const disputeBanner = e.disputed ? `
    <div class="safety-banner safety-disputed">
      <span>⚖️</span>
      <div><strong>Under Dispute</strong> — ${e.dispute_note}</div>
    </div>` : '';

  const decayBanner = decayed ? `
    <div class="safety-banner safety-decay">
      <span>⏳</span>
      <div><strong>Reduced confidence</strong> — Last report was ${timeAgo(e.last_seen)}.
      Risk score reduced due to inactivity.</div>
    </div>` : '';

  const disclaimer = `
    <div class="search-disclaimer">
      ℹ️ <strong>Community data only.</strong> Not independently verified by ScamRadar.
      <a href="dispute.html?entity=${encodeURIComponent(e.value)}" class="dispute-link">Dispute this report →</a>
    </div>`;

  return `
    <div class="entity-card ${belowThreshold ? 'entity-card-dim' : ''} ${e.disputed ? 'entity-card-disputed' : ''}">
      ${thresholdBanner}${disputeBanner}${decayBanner}
      <div class="entity-card-header">
        <div>
          <div class="entity-value-big">${entityIcon(e.type)} ${e.value}</div>
          <div class="entity-type-label">${e.type.toUpperCase()}</div>
        </div>
        <div style="text-align:right">
          ${riskBadge(displayLevel, e.report_count)}
          <div class="risk-score-num">${displayScore}/100 confidence${decayed ? ' (decayed)' : ''}</div>
        </div>
      </div>
      <div class="risk-bar-wrap" style="margin:14px 0 6px">
        <div class="risk-bar-fill" style="width:${displayScore}%;background:${riskBarColor(displayLevel)}"></div>
      </div>
      <p style="color:var(--muted);font-size:0.87rem;margin-bottom:14px">${e.description}</p>
      <div class="entity-meta-row">
        <div class="meta-chip">📋 ${e.report_count} report${e.report_count !== 1 ? 's' : ''}</div>
        <div class="meta-chip">🕐 Last reported ${timeAgo(e.last_seen)}</div>
        ${e.tags.map(t => `<div class="meta-chip tag-chip">${t}</div>`).join('')}
      </div>
      ${linkedReports.length > 0 ? `
        <div class="linked-reports">
          <div class="linked-reports-title">📄 Community Reports (${linkedReports.length})</div>
          ${linkedReports.slice(0,2).map(r => `
            <div class="linked-report-item">
              <div class="lr-type">${r.scam_type}</div>
              <div class="lr-desc">${r.description?.substring(0,110)}...</div>
              <div class="lr-meta">${r.platform} · ${timeAgo(r.created_at)} ${r.amount_lost ? '· Loss: ' + formatAmount(r.amount_lost) : ''}</div>
            </div>`).join('')}
        </div>` : ''}
      ${disclaimer}
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <a href="report.html" class="btn-secondary" style="font-size:0.82rem;padding:8px 16px">+ Report this entity</a>
        <a href="dispute.html?entity=${encodeURIComponent(e.value)}" class="btn-ghost" style="font-size:0.82rem;padding:8px 16px">⚖️ Dispute</a>
      </div>
    </div>`;
}
// ---- HOME RECENT REPORTS ----
function renderRecentReports() {
  console.log("renderRecentReports called");
  const container = document.getElementById('recentReports');
  console.log("renderRecentReports called");
  if (!container) return;
  container.innerHTML = getAllReports().slice(0, 6).map(r => renderReportCard(r)).join('');
}

function renderReportCard(r) {
  const entity = r.entities?.[0] || null;
  const level   = entity ? getDisplayLevel(entity) : 'medium';
  return `
    <div class="report-card">
      <div class="report-card-top">
        <span class="report-type-badge">${r.scamType}</span>
        ${riskBadge(level)}
      </div>
      <p class="report-desc">${r.description.substring(0, 110)}...</p>
      <div class="report-meta">
        <span>📱 ${r.platform}</span>
        ${r.amountLost ? `<span>💸 Reported loss: ${formatAmount(r.amountLost)}</span>` : ''}
        <span>🕐 ${timeAgo(r.date)}</span>
      </div>
      ${entity ? `<div class="report-entity">${entityIcon(entity.type)} <a href="search.html?q=${encodeURIComponent(entity.value)}" class="entity-link">${entity.value}</a></div>` : ''}
    </div>`;
}
// ---- POPULAR LIST ----
async function renderPopular() {
  const container = document.getElementById('popularList');
  if (!container) return;

  try {
    const res  = await fetch(`${API_BASE}/popular?limit=6`);
    const data = await res.json();

    if (!data.entities || data.entities.length === 0) {
      container.innerHTML = `<p style="color:var(--muted)">No flagged entities yet.</p>`;
      return;
    }

    container.innerHTML = `<div class="popular-list">` +
      data.entities.map(e => `
        <div class="popular-item" onclick="document.getElementById('searchInput').value='${e.value}'; performSearch();">
          <div class="popular-left">
            <span class="popular-icon">${entityIcon(e.type)}</span>
            <div>
              <div class="popular-value">${e.value}</div>
              <div class="popular-type">${e.type} · ${e.report_count} reports</div>
            </div>
          </div>
          ${riskBadge(e.display_level, e.report_count)}
        </div>`).join('') + `</div>`;
  } catch (err) {
    console.error('Popular error:', err);
  }
}
// ---- DASHBOARD ----
let currentFilter = { type: 'all', risk: null };
async function renderDashboard() {
  await renderDashStats();
  await renderTopFlagged();
  await renderAllReports();
  renderScamTypeChart();
}

async function renderDashboard() { 
  await renderDashStats(); 
  renderTopFlagged(); 
  renderAllReports(); 
  renderScamTypeChart(); 
}

async function renderDashStats() {
  const c = document.getElementById('dashStats');
  if (!c) return;

  try {
    const res  = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    c.innerHTML = `
      <div class="dash-stat"><div class="dash-stat-icon">📋</div><div class="dash-stat-num">${data.total_reports}</div><div class="dash-stat-label">Total Reports</div></div>
      <div class="dash-stat"><div class="dash-stat-icon">🚨</div><div class="dash-stat-num">${data.high_risk_entities}</div><div class="dash-stat-label">High Risk Entities</div></div>
      <div class="dash-stat"><div class="dash-stat-icon">🏷️</div><div class="dash-stat-num">${data.total_entities}</div><div class="dash-stat-label">Flagged Entities</div></div>
      <div class="dash-stat"><div class="dash-stat-icon">📋</div><div class="dash-stat-num">${data.reports_with_complaint}</div><div class="dash-stat-label">With Police Complaint</div></div>
    `;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function renderTopFlagged() {
  const c = document.getElementById('topFlagged');
  if (!c) return;

  try {
    const res  = await fetch(`${API_BASE}/popular?limit=5`);
    const data = await res.json();

    if (!data.entities || data.entities.length === 0) {
      c.innerHTML = `<p style="color:var(--muted)">No flagged entities yet.</p>`;
      return;
    }

    c.innerHTML = data.entities.map(e => {
      const score = e.display_score;
      const level = e.display_level;
      return `
        <div class="top-entity-row" onclick="window.location.href='search.html?q=${encodeURIComponent(e.value)}'">
          <div class="top-entity-left">
            <span style="font-size:1.2rem">${entityIcon(e.type)}</span>
            <div>
              <div class="top-entity-value">${e.value}</div>
              <div class="top-entity-sub">${e.type} · ${e.report_count} reports · ${e.tags.slice(0,2).join(', ')}${e.disputed ? ' · ⚖️ Disputed' : ''}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="risk-score-pill" style="background:${riskBarColor(level)}22;color:${riskBarColor(level)};border:1px solid ${riskBarColor(level)}44">${score}</div>
            ${riskBadge(level)}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Top flagged error:', err);
  }
}

async function renderAllReports() {
  const c = document.getElementById('allReports');
  if (!c) return;

  try {
    let url = `${API_BASE}/reports?limit=20`;
    if (currentFilter.type !== 'all') url += `&scam_type=${currentFilter.type}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (!data.reports || data.reports.length === 0) {
      c.innerHTML = `<div class="no-results"><p>No reports match this filter.</p></div>`;
      return;
    }

    c.innerHTML = `<div class="all-reports-list">
      ${data.reports.map(r => renderReportCardFromAPI(r)).join('')}
    </div>`;
  } catch (err) {
    console.error('All reports error:', err);
  }
}

function filterReports(type, btn) {
  currentFilter.type = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAllReports(); // async but no need to await here
}
function filterRisk(risk, btn) {
  if (currentFilter.risk === risk) { currentFilter.risk = null; btn.classList.remove('active'); }
  else {
    currentFilter.risk = risk;
    document.querySelectorAll('.filter-btn').forEach(b => {
      if (['high','medium','low'].some(r => b.textContent.toLowerCase().includes(r))) b.classList.remove('active');
    });
    btn.classList.add('active');
  }
  renderAllReports();
}

function renderScamTypeChart() {
  const c = document.getElementById('scamTypeChart');
  if (!c) return;
  const max = Math.max(...SCAM_TYPE_STATS.map(s => s.count));
  c.innerHTML = `<div class="bar-chart">` +
    SCAM_TYPE_STATS.sort((a,b) => b.count - a.count).map(s => `
      <div class="bar-row">
        <div class="bar-label">${s.type}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(s.count/max)*100}%;background:${s.color}"></div></div>
        <div class="bar-count">${s.count}</div>
      </div>`).join('') + `</div>`;
}

// ---- REPORT FORM ----
let currentStep = 1;
let formData    = { entities:[], scamType:'', platform:'', description:'', amountLost:0, screenshot:null };
let selectedTags = {};

function goToStep(step) {
  // ── Validate Step 1 → Step 2 ──
  if (step === 2) {
    // Screenshot or manual entity required — optional, just proceed
  }
  
  // ── Validate Step 2 → Step 3 ──
  if (step === 3) {
    const desc = document.getElementById('descInput');
    if (!desc || !desc.value.trim()) {
      showFieldError('descInput', '⚠️ Please describe the scam');
      desc?.focus();
      return;
    }
    if (desc.value.trim().length < 20) {
      showFieldError('descInput', '⚠️ Description too short — ${wordCount}/20 words minimum`');
      desc?.focus();
      return;
    }
    if (!selectedTags.scamType) {
      showToast('⚠️ Please select a scam type');
      document.getElementById('scamTypeSelect')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!selectedTags.platform) {
      showToast('⚠️ Please select a platform');
      document.getElementById('platformSelect')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Check entity inputs
    let hasEntity = false;
    document.querySelectorAll('.entity-value-input').forEach(input => {
      if (input.value.trim()) hasEntity = true;
    });
    if (!hasEntity) {
      showToast('⚠️ Please add at least one reported entity (phone/email/UPI)');
      return;
    }

    // Validate entity values
    let entityError = false;
    document.querySelectorAll('.entity-input-row').forEach(row => {
      const entityType  = row.querySelector('.entity-type-select')?.value;
      const val   = row.querySelector('.entity-value-input')?.value.trim();
      if (!val) return;

      if (entityType === 'phone' && !/^[6-9]\d{9}$/.test(val)) {
        showToast('⚠️ Invalid phone number — must be 10 digits starting with 6-9');
        row.querySelector('.entity-value-input').style.borderColor = 'rgba(255,77,77,0.6)';
        setTimeout(() => row.querySelector('.entity-value-input').style.borderColor = '', 3000);
        entityError = true;
      }
      if (entityType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        showToast('⚠️ Invalid email address');
        row.querySelector('.entity-value-input').style.borderColor = 'rgba(255,77,77,0.6)';
        setTimeout(() => row.querySelector('.entity-value-input').style.borderColor = '', 3000);
        entityError = true;
      }
      if (entityType === 'upi' && !val.includes('@')) {
        showToast('⚠️ Invalid UPI ID — must contain @');
        row.querySelector('.entity-value-input').style.borderColor = 'rgba(255,77,77,0.6)';
        setTimeout(() => row.querySelector('.entity-value-input').style.borderColor = '', 3000);
        entityError = true;
      }
    });
    if (entityError) return;

    // All good — build formData
    formData.description = desc.value.trim();
    formData.scamType    = selectedTags.scamType || '';
    formData.platform    = selectedTags.platform || '';
    formData.amountLost  = parseInt(document.getElementById('amountInput')?.value) || 0;
    formData.entities    = [];
    document.querySelectorAll('.entity-input-row').forEach(row => {
      const type = row.querySelector('.entity-type-select')?.value;
      const val  = row.querySelector('.entity-value-input')?.value.trim();
      if (val) formData.entities.push({ type, value: val });
    });
    renderPreview();
  }

  // ── Switch steps ──
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`)?.classList.add('active');
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot${i}`);
    if (dot) {
      dot.classList.remove('active', 'done');
      if (i < step) dot.classList.add('done');
      if (i === step) dot.classList.add('active');
    }
  }
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function validateComplaintNumber(input) {
  const val = input.value.trim().toUpperCase();
  const display = document.getElementById('complaintNumStatus');

  if (!val) {
    if (display) display.innerHTML = '';
    input.style.borderColor = '';
    return;
  }

  // Strict valid formats:
  const patterns = [
    /^1930\d{10}$/,              // 1930 + exactly 10 digits
    /^CC\/20\d{2}\/\d{6,10}$/,  // CC/2025/123456
    /^FIR\/20\d{2}\/\d{6,10}$/, // FIR/2025/123456
    /^CYB\d{8,15}$/,             // CYB + digits
    /^\d{12,16}$/,               // Pure 12-16 digit number
  ];

  const isValid = patterns.some(p => p.test(val));

  if (!display) return;

  if (val.length < 6) {
    display.innerHTML = `<span style="color:var(--muted);font-size:0.78rem">Keep typing...</span>`;
    input.style.borderColor = '';
  } else if (isValid) {
    display.innerHTML = `<span style="color:var(--green);font-size:0.78rem">✅ Valid complaint number</span>`;
    input.style.borderColor = 'rgba(34,209,122,0.4)';
  } else {
    display.innerHTML = `<span style="color:var(--accent);font-size:0.78rem">⚠️ Invalid format — use: 1930XXXXXXXXXX, CC/2025/XXXXXX, FIR/2025/XXXXXX or 12-16 digit number</span>`;
    input.style.borderColor = 'rgba(255,77,77,0.4)';
  }
}

function skipToStep2() { goToStep(2); }

function selectTag(el, group) {
  document.querySelectorAll(`#${group}Select .tag-option`).forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  selectedTags[group] = el.textContent.replace(/^[^\w]+/, '').trim();
}

function addEntityRow() {
  const c = document.getElementById('entityInputs');
  const row = document.createElement('div');
  row.className = 'entity-input-row';
  row.innerHTML = `
    <select class="entity-type-select" onchange="updateEntityPlaceholder(this)">
      <option value="phone">📱 Phone</option>
      <option value="upi">💳 UPI ID</option>
      <option value="email">📧 Email</option>
    </select>
    <input type="text" class="entity-value-input" 
      placeholder="e.g. 9876543210" 
      maxlength="10"
      oninput="enforceEntityLimit(this)" />
    <button class="remove-entity-btn" onclick="removeEntityRow(this)">✕</button>`;
  c.appendChild(row);
}
function removeEntityRow(btn) {
  if (document.querySelectorAll('.entity-input-row').length > 1) btn.closest('.entity-input-row').remove();
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async e => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('uploadPreview').style.display = 'block';
    document.getElementById('uploadZone').style.display = 'none';
    document.getElementById('ocrProcessing').style.display = 'flex';
    document.getElementById('ocrResults').style.display = 'none';
    formData.screenshot = file; // Store actual file not base64

    // Call real OCR API
    try {
      const fd = new FormData();
      fd.append('screenshot', file);
      fd.append('description', 'ocr_preview');
      fd.append('scam_type', 'Other');
      fd.append('platform', 'Other');

      const res  = await fetch(`${API_BASE}/ocr/preview`, { method: 'POST', body: fd });
      const data = await res.json();

      document.getElementById('ocrProcessing').style.display = 'none';
      document.getElementById('ocrResults').style.display = 'block';

      // Show extracted entities
      renderOCRResults(data);
      document.getElementById('step1Next').style.display = 'inline-block';

    } catch (err) {
      console.error('OCR error:', err);
      document.getElementById('ocrProcessing').style.display = 'none';
      document.getElementById('ocrResults').style.display = 'block';
      document.getElementById('step1Next').style.display = 'inline-block';
    }
  };
  reader.readAsDataURL(file);
}

function updateEntityPlaceholder(select) {
  const input = select.closest('.entity-input-row').querySelector('.entity-value-input');
  if (select.value === 'phone') {
    input.placeholder = 'e.g. 9876543210';
    input.maxLength = 10;
  } else if (select.value === 'upi') {
    input.placeholder = 'e.g. name@okaxis';
    input.maxLength = 50;
  } else if (select.value === 'email') {
    input.placeholder = 'e.g. scammer@gmail.com';
    input.maxLength = 100;
  }
}

function enforceEntityLimit(input) {
  const row = input.closest('.entity-input-row');
  const type = row.querySelector('.entity-type-select')?.value;
  if (type === 'phone') {
    // Only allow digits
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
  }
}

function renderOCRResults(data) {
  const container = document.getElementById('extractedEntities');
  const entityContainer = document.getElementById('entityInputs');

  const entities = [
    ...(data?.phones || []).map(v => ({ type: 'phone', value: v })),
    ...(data?.upis   || []).map(v => ({ type: 'upi',   value: v })),
    ...(data?.emails || []).map(v => ({ type: 'email', value: v })),
  ];

  if (entityContainer) {
    entityContainer.innerHTML = '';
    if (entities.length === 0) {
      // No entities found — show empty input row
      addEntityRow();
    } else {
      entities.forEach(r => {
        const row = document.createElement('div');
        row.className = 'entity-input-row';
        row.innerHTML = `
          <select class="entity-type-select">
            <option value="phone" ${r.type==='phone'?'selected':''}>📱 Phone</option>
            <option value="upi"   ${r.type==='upi'  ?'selected':''}>💳 UPI ID</option>
            <option value="email" ${r.type==='email'?'selected':''}>📧 Email</option>
          </select>
          <input type="text" class="entity-value-input" value="${r.value}" />
          <button class="remove-entity-btn" onclick="removeEntityRow(this)">✕</button>`;
        entityContainer.appendChild(row);
      });
    }
  }

  if (container) {
    if (entities.length === 0) {
      container.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">No entities detected. Add them manually below.</p>`;
    } else {
      container.innerHTML = entities.map(r => `
        <div class="ocr-entity-chip">${entityIcon(r.type)} <strong>${r.value}</strong> 
        <span class="ocr-entity-type">${r.type}</span></div>`).join('');
    }
  }
}
function performSearch() {
  const q = document.getElementById('searchInput')?.value.trim() || 
            document.getElementById('heroSearch')?.value.trim() || '';
  
  if (!q) {
    showToast('⚠️ Please enter a phone number, email or UPI ID to search');
    return;
  }
  if (q.length < 3) {
    showToast('⚠️ Search query too short — enter at least 3 characters');
    return;
  }
  // ... rest of performSearch
}

function renderOCRResults() {
  const container = document.getElementById('extractedEntities');
  const entityContainer = document.getElementById('entityInputs');
  if (entityContainer) {
    entityContainer.innerHTML = '';
    OCR_FAKE_RESULTS.forEach(r => {
      const row = document.createElement('div');
      row.className = 'entity-input-row';
      row.innerHTML = `
        <select class="entity-type-select">
          <option value="phone" ${r.type==='phone'?'selected':''}>📱 Phone</option>
          <option value="upi"   ${r.type==='upi'  ?'selected':''}>💳 UPI ID</option>
          <option value="email" ${r.type==='email'?'selected':''}>📧 Email</option>
        </select>
        <input type="text" class="entity-value-input" value="${r.value}" />
        <button class="remove-entity-btn" onclick="removeEntityRow(this)">✕</button>`;
      entityContainer.appendChild(row);
    });
  }
  if (container) {
    container.innerHTML = OCR_FAKE_RESULTS.map(r => `
      <div class="ocr-entity-chip">${entityIcon(r.type)} <strong>${r.value}</strong> <span class="ocr-entity-type">${r.type}</span></div>`).join('');
  }
}

function removeUpload() {
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('step1Next').style.display = 'none';
  document.getElementById('fileInput').value = '';
  formData.screenshot = null;
}

function renderPreview() {
  const c = document.getElementById('previewContent');
  if (!c) return;
  c.innerHTML = `
    <div class="preview-grid">
      <div class="preview-item"><div class="preview-label">Scam Type</div><div class="preview-value">${formData.scamType||'—'}</div></div>
      <div class="preview-item"><div class="preview-label">Platform</div><div class="preview-value">${formData.platform||'—'}</div></div>
      ${formData.amountLost ? `<div class="preview-item"><div class="preview-label">Reported Loss</div><div class="preview-value" style="color:var(--accent)">${formatAmount(formData.amountLost)}</div></div>` : ''}
    </div>
    <div class="preview-item" style="margin-top:16px"><div class="preview-label">Description</div><div class="preview-value" style="font-size:0.9rem;color:var(--muted)">${formData.description}</div></div>
    ${formData.entities.length ? `
      <div style="margin-top:16px"><div class="preview-label">Reported Entities</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${formData.entities.map(e => `<div class="ocr-entity-chip">${entityIcon(e.type)} ${e.value}</div>`).join('')}
        </div>
      </div>` : ''}`;
}

function resetForm() {
  formData = { entities:[], scamType:'', platform:'', description:'', amountLost:0, screenshot:null };
  selectedTags = {};
}

// ---- VALIDATION HELPERS ----
function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.borderColor = 'rgba(255,77,77,0.6)';
  el.style.boxShadow = '0 0 0 3px rgba(255,77,77,0.1)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  }, 3000);
  showToast(message);
}

function showToast(message, type = 'error') {
  let t = document.getElementById('toastEl');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toastEl';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.style.background = type === 'error' ? 'rgba(255,77,77,0.15)' : 'rgba(34,209,122,0.15)';
  t.style.borderColor = type === 'error' ? 'rgba(255,77,77,0.3)' : 'rgba(34,209,122,0.3)';
  t.style.color = type === 'error' ? '#ff4d4d' : '#22d17a';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
