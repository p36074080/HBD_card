/* ─────────────────────────────────────────
   Girlfriend Black Card  ·  data.js
   Shared data + helpers (loaded by both
   index.html / app.js and admin.html / admin.js)
───────────────────────────────────────── */

// ── Backend API (Google Apps Script) ─────
const API_URL = 'https://script.google.com/macros/s/AKfycbz_eg_Wn3pbWtMIZgbU2LTd4PHOkuDE47nZA9qUUSPlE1Ij61CC-rHLatNUCsyQL_y3bw/exec';

// 讀取整包狀態 { ok, card, benefits:{id:{total,remaining}}, transactions }
async function apiFetchState() {
  const res = await fetch(API_URL, { redirect: 'follow' });
  return res.json();
}

// 寫入動作（body 用純字串、不加 Content-Type，避免 CORS 預檢）→ 回傳更新後整包狀態
async function apiCall(payload) {
  const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
  return res.json();
}

// 按鈕 loading：執行期間禁用並顯示旋轉圖示，避免重複點、讓用戶知道系統在跑
async function runWithLoading(btn, fn) {
  if (btn && btn.dataset && btn.dataset.loading === '1') return;
  let orig;
  if (btn) {
    orig = btn.innerHTML;
    btn.dataset.loading = '1';
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('is-loading');
    btn.innerHTML = '<span class="btn-spinner"></span>';
  }
  try {
    return await fn();
  } catch (e) {
    if (typeof showToast === 'function') showToast('連線失敗，請稍後再試', 'error');
  } finally {
    if (btn && document.body.contains(btn)) {   // 若已導頁/重繪則不還原
      btn.dataset.loading = '0';
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-loading');
      btn.innerHTML = orig;
    }
  }
}
window.runWithLoading = runWithLoading;

// 把 server 的 {id:{total,remaining}} 蓋進程式內的權益目錄（圖示/文案/分類留在 data.js）
function mergeBenefitsFromServer(serverBenefits) {
  const cat = cloneBenefits();
  if (serverBenefits) {
    Object.keys(cat).forEach(k => cat[k].items.forEach(it => {
      const s = serverBenefits[it.id];
      if (s) {
        it.remaining = s.remaining;
        it.total = s.total;
        if ('fav' in s) it.fav = !!s.fav;
        if ('favOrder' in s) it.favOrder = s.favOrder || 0;
      }
    }));
  }
  return cat;
}

// ── 經常兌換（首頁快捷）helpers ──
// 可被加入常用的項目 = 兌換中心的 count 類（票券 / 專屬禮遇 / 升艙）
function favoritableItems(benefits) {
  const out = [];
  BENEFIT_ORDER.forEach(k => {
    if (k === 'gift') return;                 // 禮物卡為一次性特別項，不放常用
    const cat = benefits[k];
    if (!cat) return;
    cat.items.forEach(it => { if (it.kind === 'count') out.push({ key: k, item: it }); });
  });
  return out;
}

function findBenefitAny(benefits, id) {
  for (const k of BENEFIT_ORDER) {
    const cat = benefits[k];
    if (!cat) continue;
    const it = cat.items.find(i => i.id === id);
    if (it) return { key: k, item: it };
  }
  return null;
}

// 首頁要顯示的常用清單：fav 為真、依 favOrder 由小到大、最多 5 個
function favoriteList(benefits) {
  return favoritableItems(benefits)
    .filter(x => x.item.fav)
    .sort((a, b) => (a.item.favOrder || 99) - (b.item.favOrder || 99))
    .slice(0, 5);
}

// ── 卡面樣式（女友可自選）────────────────
// 圖檔放在 card/ 資料夾：c00.png ~ c09.png；Card sheet 用 face 欄位記錄目前選擇
const CARD_FACES = ['c00', 'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09'];
const DEFAULT_FACE = 'c00';                          // 初始化 / 開卡預設卡面
function cardFaceId(card) {
  const f = card && card.face;
  return CARD_FACES.indexOf(f) >= 0 ? f : DEFAULT_FACE;   // 預設 c00
}

// ── Material Symbols helper ───────────────
// Renders a Google Material Symbols (Outlined) glyph.
// Size/color are inherited from the parent container.
function icon(name, cls) {
  return `<span class="material-symbols-outlined${cls ? ' ' + cls : ''}">${name}</span>`;
}

// ── Benefits / Privileges data ────────────
// kind:
//   'money'     — 刷卡金，可分次扣抵金額（remaining / total 為金額）
//   'count'     — 票券、禮遇，可使用並遞減次數（remaining / total 為次數）
//   'unlimited' — 無限次數，僅展示
//   'always'    — 常駐權益，僅展示
const BENEFITS_DEFAULT = {
  cashback: {
    label: '刷卡金',
    sublabel: 'Spending Credit',
    icon: 'paid',
    items: [
      { id: 'cb_medical', title: '美麗升級金', icon: 'health_and_beauty', kind: 'money', total: 3000, remaining: 3000 },
      { id: 'cb_outfit',  title: '造型治裝金', icon: 'checkroom',         kind: 'money', total: 3000, remaining: 3000 },
      { id: 'cb_sport',   title: '健康運動金', icon: 'fitness_center',    kind: 'money', total: 3000, remaining: 3000 },
      { id: 'cb_travel',  title: '旅行加值金', icon: 'flight',            kind: 'money', total: 3000, remaining: 3000 }
    ]
  },
  vouchers: {
    label: '票券',
    sublabel: 'Vouchers',
    icon: 'confirmation_number',
    items: [
      { id: 'v_massage',   title: '15 分鐘按摩券',  icon: 'spa',            kind: 'count', unit: '張', total: 6,  remaining: 6  },
      { id: 'v_wash',      title: '洗頭服務',        icon: 'shower',         kind: 'count', unit: '張', total: 6,  remaining: 6  },
      { id: 'v_dessert',   title: '甜品下午茶兌換券', icon: 'cake',          kind: 'count', unit: '張', total: 6,  remaining: 6, fav: true, favOrder: 1 },
      { id: 'v_drink',     title: '手搖兌換券',      icon: 'local_cafe',     kind: 'count', unit: '張', total: 12, remaining: 12, fav: true, favOrder: 2 },
      { id: 'v_blowdry',   title: '吹頭服務券',      icon: 'dry',            kind: 'count', unit: '張', total: 12, remaining: 12 },
      { id: 'v_bouquet',   title: '花束券',          icon: 'local_florist',  kind: 'count', unit: '張', total: 2,  remaining: 2  },
      { id: 'v_breakfast', title: '早餐送到床邊券',   icon: 'free_breakfast', kind: 'count', unit: '張', total: 6,  remaining: 6  },
      { id: 'v_soymilk',   title: '豆漿兌換券',      icon: 'local_drink',    kind: 'count', unit: '張', total: 6,  remaining: 6  },
      { id: 'v_bobo',      title: '波波飲養品券',    icon: 'local_bar',      kind: 'count', unit: '張', total: 4,  remaining: 4  }
    ]
  },
  privileges: {
    label: '專屬禮遇',
    sublabel: 'Exclusive Privileges',
    icon: 'workspace_premium',
    items: [
      { id: 'pr_pickup',   title: '上下班專屬接送', icon: 'directions_car',     kind: 'count', unit: '次/年', total: 6, remaining: 6, fav: true, favOrder: 3 },
      { id: 'pr_chores',   title: '一週家事代理',   icon: 'cleaning_services',  kind: 'count', unit: '次/年', total: 6, remaining: 6, fav: true, favOrder: 4 },
      { id: 'pr_aroma',    title: '專屬芳療體驗',   icon: 'spa',                kind: 'count', unit: '次/年', total: 2, remaining: 2 },
      { id: 'pr_intimacy', title: '專屬情慾體驗',   icon: 'favorite',           kind: 'count', unit: '次/年', total: 4, remaining: 4 },
      { id: 'pr_date',     title: '專屬約會企劃',   icon: 'celebration',        kind: 'count', unit: '次/年', total: 1, remaining: 1 },
      { id: 'pr_photo',    title: '專屬拍照企劃',   icon: 'photo_camera',       kind: 'count', unit: '次/年', total: 4, remaining: 4 }
    ]
  },
  travel: {
    label: '旅遊禮遇',
    sublabel: 'Travel Privileges',
    icon: 'flight_takeoff',
    items: [
      { id: 'tr_coffee',   title: '登機前咖啡禮遇', icon: 'coffee',                     kind: 'unlimited', desc: '每趟飛行前一杯機場咖啡或飲料' },
      { id: 'tr_luggage',  title: '行李整理協助服務', icon: 'luggage',                   kind: 'unlimited', desc: '去程協助整理、回程協助整理戰利品 · 限獨旅或與熊熊同遊' },
      { id: 'tr_room',     title: '夢幻住宿升等服務', icon: 'hotel',                     kind: 'unlimited', desc: '熊熊幫你出差額升級住宿 · 限獨旅或與熊熊同遊' },
      { id: 'tr_cabin',    title: '舒適飛行升艙服務', icon: 'airline_seat_recline_extra', kind: 'count', unit: '次/年', total: 4, remaining: 4, fav: true, favOrder: 5, desc: '熊熊幫你出差額升級商務艙（限員購票）· 限獨旅或與熊熊同遊' }
    ]
  },
  discounts: {
    label: '折扣優惠',
    sublabel: 'Discounts',
    icon: 'sell',
    items: [
      { id: 'dc_channel',   title: '指定通路消費 9 折', icon: 'storefront',         kind: 'always', desc: '結帳時熊熊再幫你出 10%' },
      { id: 'dc_insurance', title: '旅遊保險 9 折',     icon: 'health_and_safety',  kind: 'always', desc: '結帳時熊熊再幫你出 10%（限獨旅或與熊熊同遊）' }
    ]
  },
  basic: {
    label: '基本權益',
    sublabel: 'Member Benefits',
    icon: 'loyalty',
    items: [
      { id: 'bs_fee',     title: '永久免年費',        icon: 'verified',       kind: 'always' },
      { id: 'bs_support', title: '24 小時男友客服',   icon: 'support_agent',  kind: 'always' },
      { id: 'bs_plan',    title: '行程規劃服務',      icon: 'map',            kind: 'always' },
      { id: 'bs_booking', title: '餐廳訂位服務',      icon: 'restaurant',     kind: 'always' },
      { id: 'bs_photo',   title: '拍照服務',          icon: 'photo_camera',   kind: 'always' },
      { id: 'bs_carry',   title: '旅行時協助拿行李',   icon: 'luggage',        kind: 'always' },
      { id: 'bs_rain',    title: '雨天優先接送評估',   icon: 'umbrella',       kind: 'always' },
      { id: 'bs_hug',     title: '睡前抱抱與安撫服務', icon: 'bedtime',        kind: 'always' },
      { id: 'bs_kiss',    title: '所有消費享有親吻回饋', icon: 'favorite',     kind: 'always' }
    ]
  },
  gift: {
    label: '禮物',
    sublabel: 'Gift',
    icon: 'card_giftcard',
    items: [
      { id: 'gift_bag', title: '夢幻包款兌換券', icon: 'shopping_bag', kind: 'count', unit: '個', total: 1, remaining: 1, desc: '兌換一顆妳的夢幻包款' }
    ]
  }
};

const BENEFIT_ORDER = ['cashback', 'vouchers', 'privileges', 'travel', 'discounts', 'basic', 'gift'];

function cloneBenefits() {
  return JSON.parse(JSON.stringify(BENEFITS_DEFAULT));
}

// ── Benefit display helpers ───────────────

function benefitStatusText(item) {
  if (item.kind === 'money')     return `NT$ ${item.remaining.toLocaleString()} / ${item.total.toLocaleString()}`;
  if (item.kind === 'count')     return `剩 ${item.remaining} / ${item.total} ${item.unit || '次'}`;
  if (item.kind === 'unlimited') return '無限次數';
  if (item.kind === 'always')    return '常駐專屬權益';
  return '';
}

// actionFor(catKey, item) → returns right-side HTML (a button or a badge).
// This lets holder ("使用") and admin ("管理") share the same layout.
function renderBenefitSections(benefits, actionFor, onlyKeys) {
  const keys = (onlyKeys && onlyKeys.length) ? onlyKeys : BENEFIT_ORDER;
  return keys.map(key => {
    const cat = benefits[key];
    if (!cat) return '';
    return `
      <div class="benefit-section">
        <div class="benefit-sec-head">
          <span class="bs-ico">${icon(cat.icon)}</span>
          <div>
            <div class="benefit-sec-title">${cat.label}</div>
            <div class="benefit-sec-sub">${cat.sublabel || ''}</div>
          </div>
        </div>
        <div class="benefit-list">
          ${cat.items.map(it => renderBenefitRow(key, it, actionFor)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderBenefitRow(key, item, actionFor) {
  const usedUp = (item.kind === 'money' || item.kind === 'count') && item.remaining <= 0;
  const sub = item.desc ? `${benefitStatusText(item)} · ${item.desc}` : benefitStatusText(item);
  return `
    <div class="benefit-row ${usedUp ? 'used-up' : ''}">
      <div class="benefit-ico">${icon(item.icon)}</div>
      <div class="benefit-main">
        <div class="benefit-title">${item.title}</div>
        <div class="benefit-status">${sub}</div>
      </div>
      <div class="benefit-action">${actionFor(key, item)}</div>
    </div>
  `;
}

// ── Cashback helpers (the 4 spending-credit pools) ──

function cashbackTotal(benefits) {
  return benefits.cashback.items.reduce((s, i) => s + i.remaining, 0);
}

// ── Transactions ──────────────────────────
// Two kinds of records:
//   金額紀錄 — 刷卡金的 topup(儲值,+) / charge(扣款,-)，顯示金額
//   兌換紀錄 — redeem(票券/禮遇)，只顯示用了什麼、剩餘多少，不顯示金額
//   (legacy 'benefit' 一律視為兌換)

// 最新在前（與 server 回傳順序一致）
const DEFAULT_TRANSACTIONS = [
  { id: 't_002', title: '兌換 手搖兌換券',    type: 'redeem', createdBy: 'holder', createdAt: '今天 22:13', note: '剩餘 11 張' },
  { id: 't_001', title: '美麗升級金 · 儲值', amount: 3000,  type: 'topup',  createdBy: 'admin',  createdAt: '今天 22:00', note: '開卡禮金' },
  { id: 't_003', title: '造型治裝金 · 扣款',  amount: -800,  type: 'charge', createdBy: 'admin',  createdAt: '昨天 19:30', note: '造型治裝金' }
];

const TX_FILTERS = [['all', '全部'], ['topup', '儲值'], ['charge', '扣款'], ['redeem', '兌換']];

function txnMatchesFilter(t, f) {
  if (f === 'all') return true;
  if (f === 'redeem') return t.type === 'redeem' || t.type === 'benefit';
  return t.type === f;
}

function renderTransactionItem(txn) {
  const iconMap  = { topup: 'savings', charge: 'payments', redeem: 'redeem', benefit: 'redeem' };
  const isMoney  = txn.type === 'topup' || txn.type === 'charge';
  let right;
  if (isMoney) {
    const isPos = txn.amount > 0;
    const amtStr = isPos ? `+NT$ ${Math.abs(txn.amount).toLocaleString()}` : `-NT$ ${Math.abs(txn.amount).toLocaleString()}`;
    right = `
      <div class="amount ${isPos ? 'positive' : 'negative'}">${amtStr}</div>
      <div><span class="txn-type-tag tag-${txn.type}">${txn.type === 'topup' ? '儲值' : '扣款'}</span></div>`;
  } else {
    right = `<div><span class="txn-type-tag tag-redeem">兌換</span></div>`;
  }
  return `
    <div class="txn-item">
      <div class="txn-icon ${txn.type}">${icon(iconMap[txn.type] || 'circle')}</div>
      <div class="txn-info">
        <div class="txn-title">${txn.title}</div>
        <div class="txn-time">${txn.createdAt}${txn.note ? ' · ' + txn.note : ''}</div>
      </div>
      <div class="txn-amount">${right}</div>
    </div>
  `;
}

// ── NFC tap animation (示意) ──────────────
function renderNfcAnim(centerIcon) {
  return `
    <div class="nfc-anim">
      <div class="nfc-ring"></div>
      <div class="nfc-ring"></div>
      <div class="nfc-ring"></div>
      <div class="nfc-center">${icon(centerIcon || 'contactless')}</div>
    </div>
  `;
}
