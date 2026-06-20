// =============================================
//  ScamRadar — Mock Data (with Safety Layers)
// =============================================

// ---- API CONFIG ----
const API_BASE = "https://scamradar-yeuu.onrender.com/api/v1"; // Change to Render URL when deployed

// ---- SAFETY CONSTANTS ----
const REPORT_THRESHOLD = 3;   // Min independent reports before entity is publicly visible
const DECAY_DAYS = 180;       // Score decays after this many days of inactivity

function computeDecayedScore(rawScore, lastSeen) {
  if (!lastSeen) return rawScore;
  const daysSince = Math.floor((new Date() - new Date(lastSeen)) / 86400000);
  if (daysSince < 30)  return rawScore;
  if (daysSince < 90)  return Math.round(rawScore * 0.90);
  if (daysSince < 180) return Math.round(rawScore * 0.75);
  if (daysSince < 365) return Math.round(rawScore * 0.50);
  return Math.round(rawScore * 0.25);
}

function getDecayedLevel(score) {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// visibleThresholdMet = reportCount >= REPORT_THRESHOLD
// disputed = true if entity owner raised a dispute
const MOCK_ENTITIES = [
  { id: 'e1',  value: '00011122233',           type: 'phone', reportCount: 34, riskScore: 87, riskLevel: 'high',
    tags: ['Fake Job', 'WhatsApp'],   firstSeen: '2024-10-12', lastSeen: '2025-03-18',
    description: 'Reported by 34 community members for fake job offers demanding upfront registration fees.',
    disputed: false, disputeNote: null },

  { id: 'e2',  value: 'suspect001@upi',           type: 'upi',   reportCount: 19, riskScore: 78, riskLevel: 'high',
    tags: ['OLX Fraud', 'Advance Payment'], firstSeen: '2024-11-05', lastSeen: '2025-03-15',
    description: 'Reported by 19 community members as a fake OLX product seller demanding advance UPI payment.',
    disputed: false, disputeNote: null },

  { id: 'e3',  value: 'fraud@fake.com',         type: 'email', reportCount: 12, riskScore: 72, riskLevel: 'high',
    tags: ['Phishing', 'KYC Fraud'],  firstSeen: '2024-09-20', lastSeen: '2025-02-28',
    description: 'Reported by 12 community members for sending phishing emails impersonating a major private bank.',
    disputed: false, disputeNote: null },

  { id: 'e4',  value: '00077788899',             type: 'phone', reportCount: 7,  riskScore: 52, riskLevel: 'medium',
    tags: ['Dating Scam'],           firstSeen: '2025-01-10', lastSeen: '2025-03-10',
    description: 'Reported by 7 community members in connection with dating scam incidents on dating apps.',
    disputed: true,
    disputeNote: 'The owner of this number has disputed these reports and claims they are false. ScamRadar is reviewing. This is unverified community data — exercise independent caution.' },

  { id: 'e5',  value: 'seller2024@upi',         type: 'upi',   reportCount: 5,  riskScore: 44, riskLevel: 'medium',
    tags: ['Delivery Fraud'],         firstSeen: '2025-02-01', lastSeen: '2025-03-05',
    description: 'Reported by 5 community members for collecting fake delivery charges posing as courier partners.',
    disputed: false, disputeNote: null },

  { id: 'e6',  value: 'prize.winner@gmail.com', type: 'email', reportCount: 9,  riskScore: 68, riskLevel: 'high',
    tags: ['Lottery Scam'],           firstSeen: '2024-12-01', lastSeen: '2025-03-12',
    description: 'Reported by 9 community members for lottery prize scam demanding processing fees.',
    disputed: false, disputeNote: null },

  { id: 'e7',  value: '00033344455',             type: 'phone', reportCount: 3,  riskScore: 30, riskLevel: 'medium',
    tags: ['Investment Scam'],        firstSeen: '2025-02-15', lastSeen: '2025-03-01',
    description: 'Reported by 3 community members for promoting fake cryptocurrency investment schemes.',
    disputed: false, disputeNote: null },

  { id: 'e8',  value: 'legit@okaxis',           type: 'upi',   reportCount: 0,  riskScore: 5,  riskLevel: 'low',
    tags: [], firstSeen: null, lastSeen: null,
    description: 'No community reports found for this entity.',
    disputed: false, disputeNote: null },

  { id: 'e9',  value: 'trustedseller@upi',      type: 'upi',   reportCount: 0,  riskScore: 2,  riskLevel: 'low',
    tags: [], firstSeen: null, lastSeen: null,
    description: 'No community reports found for this entity.',
    disputed: false, disputeNote: null },

  { id: 'e10', value: '00044455566',             type: 'phone', reportCount: 22, riskScore: 81, riskLevel: 'high',
    tags: ['KYC/Banking', 'Impersonation'], firstSeen: '2024-08-10', lastSeen: '2025-03-17',
    description: 'Reported by 22 community members for impersonating a nationalised bank bank officials and requesting OTPs.',
    disputed: false, disputeNote: null },

  { id: 'e11', value: 'fake.jobs.india@gmail.com', type: 'email', reportCount: 16, riskScore: 76, riskLevel: 'high',
    tags: ['Fake Job', 'Advance Fee'], firstSeen: '2024-11-20', lastSeen: '2025-03-14',
    description: 'Reported by 16 community members for sending fake job offers demanding security deposits.',
    disputed: false, disputeNote: null },

  { id: 'e12', value: '00066677788',             type: 'phone', reportCount: 2,  riskScore: 18, riskLevel: 'low',
    tags: ['Spam'],                   firstSeen: '2025-03-01', lastSeen: '2025-03-02',
    description: 'Only 2 reports submitted — below the 3-report visibility threshold. Shown with low confidence.',
    disputed: false, disputeNote: null },
];

const MOCK_REPORTS = [
  { id: 'r1',  entityIds: ['e1'],  scamType: 'Fake Job',          platform: 'WhatsApp',    description: 'Got a WhatsApp message offering a data entry job with ₹15,000/month salary. Asked for ₹2,000 registration fee. After payment, they blocked me.', amountLost: 2000,  date: '2025-03-18', tags: ['Fake Job', 'WhatsApp'] },
  { id: 'r2',  entityIds: ['e2'],  scamType: 'OLX/an online marketplace Fraud',  platform: 'OLX',         description: 'Listed a fake iPhone on OLX at very low price. Asked for advance payment via UPI. Never delivered anything.', amountLost: 8500,  date: '2025-03-15', tags: ['OLX Fraud', 'Advance Payment'] },
  { id: 'r3',  entityIds: ['e3'],  scamType: 'KYC/Banking',       platform: 'Email',       description: 'Received a phishing email claiming my a major private bank account will be blocked. Link led to a fake a major private bank login page.', amountLost: 0,     date: '2025-02-28', tags: ['Phishing', 'KYC Fraud'] },
  { id: 'r4',  entityIds: ['e4'],  scamType: 'Dating Scam',      platform: 'Dating App',  description: 'Met on a dating app, chatted for 3 weeks. Then claimed medical emergency and asked for ₹5,000. Profile deleted after payment.', amountLost: 5000,  date: '2025-03-10', tags: ['Dating Scam'] },
  { id: 'r5',  entityIds: ['e10'], scamType: 'KYC/Banking',       platform: 'Phone Call',  description: 'Received a call from someone impersonating a nationalised bank. Asked for OTP to "verify account". Lost ₹22,000 after sharing OTP.', amountLost: 22000, date: '2025-03-17', tags: ['KYC/Banking', 'Impersonation'] },
  { id: 'r6',  entityIds: ['e6'],  scamType: 'Lottery/Prize',     platform: 'Email',       description: 'Email claiming I won ₹50 lakh in a lucky draw. Asked for ₹3,500 as GST processing fee to release prize.', amountLost: 3500,  date: '2025-03-12', tags: ['Lottery Scam'] },
  { id: 'r7',  entityIds: ['e11'], scamType: 'Fake Job',          platform: 'Email',       description: 'Fake TechCorp India job offer email. Asked for ₹5,000 as training material fee. Company confirmed they never sent such emails.', amountLost: 5000,  date: '2025-03-14', tags: ['Fake Job', 'Advance Fee'] },
  { id: 'r8',  entityIds: ['e5'],  scamType: 'Delivery Fraud',    platform: 'WhatsApp',    description: 'WhatsApp message saying an e-commerce platform parcel is on hold. Asked to pay ₹49 customs fee via UPI.', amountLost: 49,    date: '2025-03-05', tags: ['Delivery Fraud'] },
  { id: 'r9',  entityIds: ['e7'],  scamType: 'Investment Scam',   platform: 'Telegram',    description: 'Telegram group promising 300% returns on crypto in 30 days. Deposited ₹10,000. Group was deleted overnight.', amountLost: 10000, date: '2025-03-01', tags: ['Investment Scam', 'Crypto'] },
  { id: 'r10', entityIds: ['e1'],  scamType: 'Fake Job',          platform: 'SMS',         description: 'SMS for a work-from-home job. Asked for ₹1,500 to get ID card. Total scam.', amountLost: 1500,  date: '2025-03-08', tags: ['Fake Job'] },
];

const SCAM_TYPE_STATS = [
  { type: 'Fake Job',         count: 38, color: '#ff4d4d' },
  { type: 'OLX/an online marketplace Fraud',count: 24, color: '#ff8c42' },
  { type: 'KYC/Banking',     count: 31, color: '#ffd166' },
  { type: 'Dating Scam',    count: 17, color: '#e040fb' },
  { type: 'Phishing',        count: 22, color: '#40c4ff' },
  { type: 'Investment Scam', count: 14, color: '#69f0ae' },
  { type: 'Lottery/Prize',   count: 19, color: '#ff6e40' },
  { type: 'Delivery Fraud',  count: 11, color: '#b2ff59' },
];

const OCR_FAKE_RESULTS = [
  { type: 'phone', value: '00011122233' },
  { type: 'upi',   value: 'suspect001@upi' },
  { type: 'email', value: 'fraud@fake.com' },
];

function getSavedReports() {
  try { return JSON.parse(sessionStorage.getItem('userReports') || '[]'); } catch(e) { return []; }
}
function saveReport(report) {
  const reports = getSavedReports();
  reports.unshift(report);
  sessionStorage.setItem('userReports', JSON.stringify(reports));
}
function getAllReports() {
  return [...getSavedReports(), ...MOCK_REPORTS];
}
