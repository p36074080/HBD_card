/* ─────────────────────────────────────────
   Girlfriend Black Card  ·  app.js
   Holder app — pure frontend mock
   (data.js must be loaded before this file)
───────────────────────────────────────── */

// ── Mock Data ────────────────────────────

const mockCard = {
  cardToken: "c_demo_05201314",
  displayCardNumber: "0520 1314 0001",
  holderName: "Ariel",
  status: "active",
  balance: 5200,
  monthlyLimit: 13140,
  activatedAt: "2026-06-15",
  validThru: "FOREVER"
};

const PRAISES = [
  "今天的妳，是世界上最美的存在。",
  "妳的笑容，是我最想看見的風景。",
  "和妳在一起的每一天，都是禮物。",
  "妳值得世界上所有的溫柔。",
  "謝謝妳願意讓我愛妳。",
  "妳不需要努力就已經很完美了。",
  "妳讓我的世界變得更有顏色。",
  "今天也辛苦了，妳是最棒的。"
];

// ── App State ─────────────────────────────

let appState = {
  isActivated: false,
  currentUser: "holder",
  card: { ...mockCard },
  transactions: [...DEFAULT_TRANSACTIONS],
  benefits: cloneBenefits(),
  lastAction: null,
  dailyClaimed: false
};

// localStorage 當快取：首屏即時顯示 + 離線備援（API 為主資料源）
function loadCache() {
  try {
    const s = JSON.parse(localStorage.getItem('gfc_cache'));
    if (s) {
      if (s.card) appState.card = Object.assign({}, appState.card, s.card);
      if (s.transactions) appState.transactions = s.transactions;
      if (s.benefits) appState.benefits = s.benefits;
      appState.isActivated = !!s.isActivated;
    }
  } catch (e) {}
}

function saveCache() {
  try {
    localStorage.setItem('gfc_cache', JSON.stringify({
      card: appState.card,
      transactions: appState.transactions,
      benefits: appState.benefits,
      isActivated: appState.isActivated
    }));
  } catch (e) {}
}

function applyServerState(st) {
  if (!st || !st.ok) return false;
  if (st.card) {
    appState.card = Object.assign({}, appState.card, st.card);
    appState.isActivated = st.card.status === 'active';
  }
  if (st.transactions) appState.transactions = st.transactions;
  appState.benefits = mergeBenefitsFromServer(st.benefits);
  appState.pending = st.pending || null;   // 待感應完成的動作
  saveCache();
  return true;
}

// 把 server 回傳的 committed 轉成 success 頁要顯示的內容
function committedToAction(c) {
  if (!c) return null;
  if (c.action === 'redeem') return { type: 'benefit', title: c.title, detail: `剩餘 ${c.remaining} ${c.unit || '次'}` };
  if (c.action === 'charge') return { type: 'chargeDone', title: c.title, amount: c.amount, remaining: c.remaining };
  return null;
}

function stateSig() {
  return JSON.stringify({
    c: appState.card, a: appState.isActivated,
    t: appState.transactions, b: appState.benefits
  });
}

// reRender：只有在資料真的有變動時才重繪，避免無謂的閃動
async function refreshFromServer(reRender) {
  try {
    const before = stateSig();
    const st = await apiFetchState();
    if (applyServerState(st) && reRender && stateSig() !== before) handleRoute();
    return st;
  } catch (e) { return null; }
}

// 手動 reload（兌換 / 紀錄頁右上角按鈕）
window.reloadData = async function(btn) {
  if (btn) btn.classList.add('spinning');
  await refreshFromServer(false);
  handleRoute();
};

// 點底部導覽：切頁（先用快取即時顯示）後，向 Sheet 同步一次（內容有變才重繪）
window.navTo = function(hash) {
  navigate(hash);
  refreshFromServer(true);
};

// ── Router ────────────────────────────────

const routes = {
  'welcome':      renderWelcome,
  'tap':          renderTap,
  'activate':     renderActivate,
  'app':          renderApp,
  'products':     renderProducts,
  'benefits':     renderBenefits,
  'transactions': renderTransactions,
  'card':         renderCardInfo,
  'daily':        renderDaily,
  'pwa-guide':    renderPwaGuide,
  'success':      renderSuccess
};

const holderNavPages = ['app', 'products', 'benefits', 'transactions', 'card', 'daily'];

function navigate(hash) {
  window.location.hash = hash;
}

function currentRoute() {
  return window.location.hash.replace('#', '') || 'welcome';
}

function handleRoute() {
  const route = currentRoute();
  const fn = routes[route] || renderWelcome;
  const container = document.getElementById('page-container');
  const nav = document.getElementById('bottom-nav');

  const div = document.createElement('div');
  div.className = 'page';
  container.innerHTML = '';
  container.appendChild(div);
  fn(div);

  if (holderNavPages.includes(route)) {
    nav.classList.remove('hidden');
    renderBottomNav(nav, route);
  } else {
    nav.classList.add('hidden');
  }

  container.scrollTop = 0;
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  loadCache();
  // NFC 感應進來會帶 ?card=...，記住卡號並走感應入口
  const cardParam = new URLSearchParams(location.search).get('card');
  if (cardParam) { try { localStorage.setItem('gfc_card_token', cardParam); } catch (e) {} }
  const goTap = !location.hash && !!cardParam;

  if (!location.hash) {
    // 設定 hash 會觸發 hashchange → handleRoute
    location.hash = goTap ? 'tap' : (appState.isActivated ? 'app' : 'welcome');
  } else {
    handleRoute();
  }
  if (!goTap) refreshFromServer(true);  // 走 tap 時由 renderTap 自己抓

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// ── Bottom Nav ────────────────────────────

function renderBottomNav(el, active) {
  const items = [
    { icon: 'home',         label: '首頁', hash: 'app' },
    { icon: 'redeem',       label: '兌換', hash: 'products' },
    { icon: 'receipt_long', label: '紀錄', hash: 'transactions' },
    { icon: 'credit_card',  label: '卡片', hash: 'card' }
  ];
  el.innerHTML = items.map(item => `
    <div class="nav-item ${item.hash === active ? 'active' : ''}" onclick="navTo('${item.hash}')">
      <span class="nav-icon">${icon(item.icon)}</span>
      <span class="nav-label">${item.label}</span>
    </div>
  `).join('');
}

// ── Black Card Component ──────────────────

function renderBlackCard(card, size = 'full', balanceTotal = null) {
  const nfcSvg = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8"/>
      <path d="M16 12a4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4"/>
      <circle cx="12" cy="12" r="1"/>
    </svg>`;

  // Balance variant — total 可用餘額 on the card face + expand chevron + 專屬權益 pill
  if (balanceTotal !== null) {
    return `
      <div class="black-card static">
        <div class="card-brand">♠</div>
        <div class="card-logo">Girlfriend Black Card</div>
        <div class="card-chip"></div>
        <div class="card-nfc">${nfcSvg}</div>
        <div class="card-balance">
          <div class="card-balance-label">可用餘額 · 刷卡金</div>
          <div class="card-balance-amount">
            <span class="cb-curr">NT$</span>${balanceTotal.toLocaleString()}
            <span class="card-balance-chevron" id="cb-chevron" onclick="toggleCashback()">${icon('expand_more')}</span>
          </div>
        </div>
        <div class="card-number">${card.displayCardNumber}</div>
        <div class="card-footer">
          <div>
            <div class="card-holder-label">Card Holder</div>
            <div class="card-holder-name">${card.holderName}</div>
          </div>
          <div class="card-benefits-pill" onclick="navigate('benefits')">
            ${icon('workspace_premium')} 專屬權益 ${icon('chevron_right')}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="black-card" style="${size === 'small' ? 'max-width:280px;' : ''}">
      <div class="card-brand">♠</div>
      <div class="card-logo">Girlfriend Black Card</div>
      <div class="card-chip"></div>
      <div class="card-nfc">${nfcSvg}</div>
      <div class="card-number">${card.displayCardNumber}</div>
      <div class="card-footer">
        <div>
          <div class="card-holder-label">Card Holder</div>
          <div class="card-holder-name">${card.holderName}</div>
        </div>
        <div class="card-valid">
          <div class="card-valid-label">Valid Thru</div>
          <div class="card-valid-date">${card.validThru}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Modal ─────────────────────────────────

function showModal(html, onClose) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = `<div class="modal-handle"></div>` + html;
  overlay.classList.remove('hidden');
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
  if (onClose) overlay._onClose = onClose;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

window.closeModal = closeModal;

// ── Toast ─────────────────────────────────

function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  el.innerHTML = `<span>${icon(ic)}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

window.showToast = showToast;

// ── Page: Welcome ─────────────────────────

function renderWelcome(el) {
  el.innerHTML = `
    <div class="welcome-page">
      <div>
        <div class="welcome-eyebrow">For You · Only You</div>
        <h1 class="welcome-title">這不是一張<br/>普通的卡片</h1>
        <p class="welcome-desc">
          這是一張只屬於妳的<br/>
          <span class="gold-text">Girlfriend Black Card</span>
        </p>
      </div>

      ${renderBlackCard(appState.card)}

      <div>
        <p style="font-size:14px;color:var(--text-secondary);line-height:1.7;text-align:center;margin-bottom:20px;">
          從今天開始，妳擁有一張專屬黑卡。<br/>
          它可以兌換寵愛、驚喜、約會、禮物，<br/>
          還有一些我只想留給妳的特權。
        </p>
        <div class="welcome-tap-hint" style="margin-bottom:20px;">
          <div class="nfc-pulse">${icon('contactless')}</div>
          <span>請拿起卡片，靠近 iPhone 頂部完成開卡</span>
        </div>
        <button class="btn btn-primary" onclick="navigate('tap')">${icon('auto_awesome')} 我準備好開卡了</button>
        <button class="btn btn-ghost" style="margin-top:10px;" onclick="window.location.href='admin.html'">管理端入口</button>
      </div>
    </div>
  `;
}

// ── Page: Tap ─────────────────────────────

function renderTap(el) {
  el.innerHTML = `
    <div class="tap-page">
      <div>
        <p style="font-size:11px;letter-spacing:0.2em;color:var(--gold-dim);text-transform:uppercase;margin-bottom:12px;text-align:center;">NFC Reading</p>
        <h2 style="font-size:22px;font-weight:700;text-align:center;letter-spacing:-0.02em;">正在讀取<br/>Girlfriend Black Card</h2>
        <p style="font-size:13px;color:var(--text-secondary);text-align:center;margin-top:10px;">請稍候，正在確認卡片狀態</p>
      </div>

      <div class="tap-nfc-anim">
        <div class="tap-nfc-ring"></div>
        <div class="tap-nfc-ring"></div>
        <div class="tap-nfc-ring"></div>
        <div class="tap-card-icon">${icon('contactless')}</div>
      </div>

      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  // 感應進來：抓最新 server 狀態
  (async () => {
    const minWait = new Promise(r => setTimeout(r, 1400));
    await refreshFromServer(false);
    // 若 server 有待處理動作（兌換/扣款）→ 感應即執行並顯示完成
    if (appState.pending) {
      const st = await apiCall({ action: 'commitPending' });
      applyServerState(st);
      await minWait;
      if (st && st.committed) {
        appState.lastAction = committedToAction(st.committed);
        navigate('success');
        return;
      }
    }
    await minWait;
    navigate(appState.isActivated ? 'app' : 'activate');
  })();
}

// ── Page: Activate ────────────────────────

function renderActivate(el) {
  el.innerHTML = `
    <div class="activate-page">
      <div class="activate-header">
        <p style="font-size:11px;letter-spacing:0.2em;color:var(--gold);text-transform:uppercase;margin-bottom:12px;">First Time Setup</p>
        <h1>歡迎開通<br/>Girlfriend Black Card</h1>
        <p>這張卡將綁定妳的專屬權益、每日福利與交易紀錄。</p>
      </div>

      <div style="display:flex;justify-content:center;">
        ${renderBlackCard(appState.card, 'small')}
      </div>

      <div class="form-section">
        <div class="form-row">
          <label class="input-label">持卡人顯示名稱</label>
          <input id="activate-name" class="input-field" type="text" value="${appState.card.holderName}" placeholder="妳的名字" />
        </div>
        <div class="form-row">
          <label class="input-label">專屬暗號（可選）</label>
          <input id="activate-code" class="input-field" type="text" placeholder="只有妳和我知道的暗語" />
        </div>
      </div>

      <button class="btn btn-primary" onclick="doActivate()" style="margin-top:auto;">${icon('credit_card')} 開通我的黑卡</button>
    </div>
  `;
}

window.doActivate = async function() {
  const name = document.getElementById('activate-name').value.trim() || 'Ariel';
  const btn = document.querySelector('.activate-page .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '開通中…'; }
  const st = await apiCall({ action: 'activate', holderName: name });
  if (applyServerState(st)) {
    appState.lastAction = { type: 'activate', holderName: appState.card.holderName };
    navigate('success');
  } else {
    showToast((st && st.error) ? st.error : '開卡失敗，請檢查連線', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('credit_card')} 開通我的黑卡`; }
  }
};

// ── Page: App Home ────────────────────────

function renderApp(el) {
  const recent = appState.transactions.slice(0, 3);  // server 已是最新在前
  const cashback = appState.benefits.cashback.items;
  const total = cashback.reduce((s, i) => s + i.remaining, 0);
  el.innerHTML = `
    <div class="app-page">
      <div class="app-header">
        <div class="greeting-sub">GIRLFRIEND BLACK CARD</div>
        <div class="greeting-name">Hi, ${appState.card.holderName}</div>
        <div class="greeting-desc">妳的黑卡今天也準備好被寵愛了。</div>
      </div>

      <div class="wallet-hero">
        ${renderBlackCard(appState.card, 'full', total)}
        <div class="cashback-panel" id="cashback-panel">
          <div class="cashback-inner">
            <div class="cashback-head">各項刷卡金餘額</div>
            ${cashback.map(i => `
              <div class="cashback-row">
                <span class="cb-ico">${icon(i.icon)}</span>
                <span class="cb-name">${i.title}</span>
                <span class="cb-amt">NT$ ${i.remaining.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="section-header">
          <div class="section-title">最近交易</div>
          <div class="section-more" onclick="navigate('transactions')">查看全部</div>
        </div>
        <div class="card">
          ${recent.map(renderTransactionItem).join('')}
          ${recent.length === 0 ? '<p style="color:var(--text-dim);font-size:14px;text-align:center;padding:16px 0;">尚無交易紀錄</p>' : ''}
        </div>
      </div>
    </div>
  `;
}

window.toggleCashback = function() {
  const p = document.getElementById('cashback-panel');
  const c = document.getElementById('cb-chevron');
  if (p) p.classList.toggle('open');
  if (c) c.classList.toggle('open');
};

// ── Page: Products ────────────────────────

function renderProducts(el) {
  const b = appState.benefits;
  const cabin = b.travel.items.filter(i => i.kind === 'count');  // 舒適飛行升艙服務

  // 兌換 action — countable items get a 兌換 CTA, used-up shows a badge.
  const redeemAction = (key, item) => {
    if (item.remaining <= 0) return `<span class="benefit-badge dim">已兌換完</span>`;
    return `<button class="btn btn-primary btn-sm" onclick="confirmUseBenefit('${key}','${item.id}')">兌換</button>`;
  };

  const section = (label, sublabel, iconName, key, items) => `
    <div class="benefit-section">
      <div class="benefit-sec-head">
        <span class="bs-ico">${icon(iconName)}</span>
        <div>
          <div class="benefit-sec-title">${label}</div>
          <div class="benefit-sec-sub">${sublabel}</div>
        </div>
      </div>
      <div class="benefit-list">
        ${items.map(it => renderBenefitRow(key, it, redeemAction)).join('')}
      </div>
    </div>
  `;

  el.innerHTML = `
    <div class="products-page">
      <div class="page-head">
        <div>
          <h1>兌換中心</h1>
          <p class="subtitle">選擇妳今天想要的寵愛，點「兌換」核銷</p>
        </div>
        <button class="reload-btn" onclick="reloadData(this)" aria-label="重新整理">${icon('refresh')}</button>
      </div>
      ${section('票券', 'Vouchers', 'confirmation_number', 'vouchers', b.vouchers.items)}
      ${section('專屬禮遇', 'Exclusive Privileges', 'workspace_premium', 'privileges', b.privileges.items)}
      ${section('升艙禮遇', 'Cabin Upgrade', 'airline_seat_recline_extra', 'travel', cabin)}
    </div>
  `;
}

// ── Page: Benefits (full catalog with category tabs) ──

let benefitsFilter = 'all';

function renderBenefits(el) {
  el.innerHTML = `
    <div class="benefits-page">
      <div class="back-btn" onclick="navigate('app')">${icon('chevron_left')} 回首頁</div>
      <h1>專屬權益</h1>
      <p class="subtitle">妳的黑卡專屬寵愛清單</p>
      <div id="benefits-body">${renderBenefitsBody(benefitsFilter)}</div>
    </div>
  `;
}

function renderBenefitsBody(filter) {
  const cats = [
    ['all', '全部'], ['cashback', '刷卡金'], ['vouchers', '票券'],
    ['privileges', '專屬禮遇'], ['travel', '旅遊禮遇'], ['discounts', '折扣'], ['basic', '基本權益']
  ];
  const displayAction = (key, item) => {
    if (item.kind === 'money')     return `<span class="benefit-badge always">NT$ ${item.remaining.toLocaleString()}</span>`;
    if (item.kind === 'count')     return `<span class="benefit-badge ${item.remaining <= 0 ? 'dim' : ''}">剩 ${item.remaining} ${item.unit || ''}</span>`;
    if (item.kind === 'unlimited') return `<span class="benefit-badge">無限</span>`;
    return `<span class="benefit-badge always">專屬</span>`;
  };
  const onlyKeys = filter === 'all' ? null : [filter];
  return `
    <div class="filter-tabs">
      ${cats.map(([k, l]) => `
        <div class="filter-tab ${filter === k ? 'active' : ''}" onclick="setBenefitsFilter('${k}')">${l}</div>
      `).join('')}
    </div>
    ${renderBenefitSections(appState.benefits, displayAction, onlyKeys)}
  `;
}

window.setBenefitsFilter = function(f) {
  benefitsFilter = f;
  const body = document.getElementById('benefits-body');
  if (body) body.innerHTML = renderBenefitsBody(f);
};

// ── Page: Transactions ────────────────────

function renderTransactions(el) {
  el.innerHTML = `
    <div class="transactions-page">
      <div class="page-head">
        <h1>交易紀錄</h1>
        <button class="reload-btn" onclick="reloadData(this)" aria-label="重新整理">${icon('refresh')}</button>
      </div>
      <div id="txn-list">
        ${renderTxnList('all')}
      </div>
    </div>
  `;
}

function renderTxnList(filter) {
  const filtered = appState.transactions.filter(t => txnMatchesFilter(t, filter));
  return `
    <div class="filter-tabs">
      ${TX_FILTERS.map(([f, label]) => `
        <div class="filter-tab ${filter === f ? 'active' : ''}" onclick="setTxnFilter('${f}')">${label}</div>
      `).join('')}
    </div>
    <div class="card">
      ${filtered.length === 0
        ? '<p style="color:var(--text-dim);font-size:14px;text-align:center;padding:20px 0;">尚無此類型交易</p>'
        : filtered.map(renderTransactionItem).join('')
      }
    </div>
  `;
}

window.setTxnFilter = function(filter) {
  const list = document.getElementById('txn-list');
  if (list) list.innerHTML = renderTxnList(filter);
};

// ── Page: Card Info + Benefits ────────────

function renderCardInfo(el) {
  const card = appState.card;
  el.innerHTML = `
    <div class="card-page">
      <div>
        <h1>卡片資訊</h1>
      </div>
      ${renderBlackCard(card)}
      <div class="card">
        <div class="info-list">
          <div class="info-row">
            <span class="info-row-label">卡片狀態</span>
            <span class="info-row-value status-active">● Active</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">持卡人</span>
            <span class="info-row-value">${card.holderName}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">卡號</span>
            <span class="info-row-value" style="letter-spacing:0.1em;font-size:12px;">${card.displayCardNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">開卡日期</span>
            <span class="info-row-value">${card.activatedAt}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">有效期限</span>
            <span class="info-row-value gold-text">${card.validThru}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">NFC 入口</span>
            <span class="info-row-value status-active">已啟用</span>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" onclick="navigate('pwa-guide')">${icon('ios_share')} 教我加入 iPhone 主畫面</button>
      <button class="btn btn-ghost" onclick="navigate('app')">回到首頁</button>
    </div>
  `;
}

// ── Benefit usage ─────────────────────────

function findBenefit(key, id) {
  const cat = appState.benefits[key];
  return cat ? cat.items.find(i => i.id === id) : null;
}

// 兌換流程：點兌換 → 輸入支付密碼 → 把 pending 寫到 server → 顯示「請感應卡片」
// → 感應後瀏覽器開啟 ?card= 入口，讀到 server 的 pending 即執行兌換並顯示完成。
//   同畫面保留「我已完成感應」按鈕作為備援（同樣呼叫 commitPending）。

const PIN_CODE = '0823';        // 支付密碼（生日）
let pinTarget = null;
let redeemBusy = false;

window.confirmUseBenefit = function(key, id) {
  const item = findBenefit(key, id);
  if (!item || item.kind !== 'count') return;
  if (item.remaining <= 0) { showToast('此項目已兌換完', 'error'); return; }
  pinTarget = { key, id };
  showPinScreen(item);          // 先輸入支付密碼，再進感應畫面
};

// ── 支付密碼 ──
function showPinScreen(item) {
  const container = document.getElementById('page-container');
  document.getElementById('bottom-nav').classList.add('hidden');
  const div = document.createElement('div');
  div.className = 'page';
  container.innerHTML = '';
  container.appendChild(div);
  div.innerHTML = `
    <div class="pin-screen">
      <div class="back-btn" onclick="cancelPin()">${icon('chevron_left')} 取消</div>
      <div class="pin-head">
        <div class="pin-lock-circle">${icon('lock')}</div>
        <div class="pin-title">請輸入支付密碼</div>
        <div class="pin-sub">輸入 4 位數密碼以兌換「${item.title}」</div>
      </div>
      <input id="pin-input" class="pin-field" type="tel" inputmode="numeric"
             maxlength="4" autocomplete="off" oninput="onPinInput()" />
      <div class="pin-err" id="pin-err"></div>
      <div class="pin-hint">${icon('info')} 輸入正確密碼後進入感應畫面</div>
    </div>
  `;
  setTimeout(() => { const i = document.getElementById('pin-input'); if (i) i.focus(); }, 60);
}

window.onPinInput = function() {
  const inp = document.getElementById('pin-input');
  const val = (inp.value || '').replace(/\D/g, '').slice(0, 4);
  inp.value = val;
  const err = document.getElementById('pin-err');
  if (err) err.textContent = '';
  if (val.length === 4) {
    if (val === PIN_CODE) {
      const t = pinTarget; pinTarget = null;
      showRedeemTap(t.key, t.id);
    } else {
      inp.classList.add('shake');
      if (err) err.textContent = '密碼錯誤，請再試一次';
      setTimeout(() => { inp.value = ''; inp.classList.remove('shake'); inp.focus(); }, 500);
    }
  }
};

window.cancelPin = function() {
  pinTarget = null;
  handleRoute();   // hash 已是 products，直接重繪回兌換頁
};

async function showRedeemTap(key, id) {
  const item = findBenefit(key, id);
  if (!item) return;
  const unit = item.unit || '次';

  const container = document.getElementById('page-container');
  document.getElementById('bottom-nav').classList.add('hidden');
  const div = document.createElement('div');
  div.className = 'page';
  container.innerHTML = '';
  container.appendChild(div);
  div.innerHTML = `
    <div class="tap-screen">
      ${renderNfcAnim('contactless')}
      <div>
        <div class="eyebrow" style="font-size:10px;letter-spacing:0.2em;color:var(--gold-dim);text-transform:uppercase;margin-bottom:10px;">NFC Redeem</div>
        <div class="tap-title">請感應<br/>Girlfriend Black Card</div>
        <div class="tap-sub" style="margin-top:10px;">將卡片靠近 iPhone 頂部完成兌換</div>
      </div>
      <div class="tap-detail-box">
        <div class="tap-detail-row">
          <span class="tap-detail-label">兌換項目</span>
          <span class="tap-detail-value">${item.title}</span>
        </div>
        <div class="tap-detail-row">
          <span class="tap-detail-label">兌換後剩餘</span>
          <span class="tap-detail-value gold-text">${item.remaining - 1} ${unit}</span>
        </div>
      </div>
      <div class="tap-hint">感應卡片後，開啟的頁面會自動完成兌換</div>
      <div class="tap-actions">
        <button class="btn btn-primary" onclick="finishRedeem()">${icon('check_circle')} 我已完成感應</button>
        <button class="btn btn-ghost" onclick="cancelRedeem()">取消</button>
      </div>
    </div>
  `;
  // 把待處理動作寫到 server，供感應後開啟的新分頁讀取並執行
  const st = await apiCall({ action: 'setPending', pAction: 'redeem', id, title: item.title, unit });
  if (!st || !st.ok) showToast('連線失敗，請稍後再試', 'error');
}

window.cancelRedeem = async function() {
  await apiCall({ action: 'clearPending' });
  handleRoute();   // hash 已是 products，重繪回兌換頁
};

window.finishRedeem = async function() {
  if (redeemBusy) return;
  redeemBusy = true;
  const st = await apiCall({ action: 'commitPending' });
  redeemBusy = false;
  applyServerState(st);
  if (st && st.committed) {
    appState.lastAction = committedToAction(st.committed);
    navigate('success');
  } else {
    showToast('尚未感應或交易已完成', 'info');
    handleRoute();
  }
};

// ── Page: Daily Benefit ───────────────────

function renderDaily(el) {
  const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
  const claimed = appState.dailyClaimed;
  el.innerHTML = `
    <div class="daily-page">
      <div class="daily-icon">${icon(claimed ? 'favorite' : 'redeem')}</div>
      <div>
        <div class="daily-title">今日福利</div>
        <div class="daily-desc">任選一句稱讚<br/>由男友親自提供，不得敷衍。</div>
      </div>
      ${claimed
        ? `<div class="praise-box">"${praise}"</div>
           <div class="daily-claimed">✅ 今日福利已領取</div>`
        : `<button class="btn btn-primary" onclick="claimDaily()">${icon('volunteer_activism')} 領取今日福利</button>`
      }
      <button class="btn btn-ghost" onclick="navigate('app')">回到首頁</button>
    </div>
  `;
  window._todayPraise = praise;
}

window.claimDaily = function() {
  appState.dailyClaimed = true;
  renderDaily(document.querySelector('.page'));
};

// ── Page: PWA Guide ───────────────────────

function renderPwaGuide(el) {
  el.innerHTML = `
    <div class="pwa-page">
      <div>
        <h1>加入 iPhone 主畫面</h1>
        <p class="subtitle">讓 Girlfriend Black Card 像 App 一樣打開</p>
      </div>
      ${[
        ['1', '使用 <strong>Safari</strong> 開啟這個頁面', '其他瀏覽器不支援此功能'],
        ['2', '點擊下方工具列的 <strong>分享按鈕</strong>（□↑）', '在 Safari 底部工具列中間'],
        ['3', '向上捲動選單，點選 <strong>「加入主畫面」</strong>', '圖示是一個帶加號的方框'],
        ['4', '名稱改成 <strong>「女友黑卡」</strong>（可自訂）', ''],
        ['5', '點擊右上角 <strong>「新增」</strong>', '完成！主畫面會出現黑卡圖示']
      ].map(([n, text, sub]) => `
        <div class="step-card">
          <div class="step-number">${n}</div>
          <div>
            <div class="step-text">${text}</div>
            ${sub ? `<div class="step-text dim-text" style="font-size:12px;margin-top:3px;">${sub}</div>` : ''}
          </div>
        </div>
      `).join('')}
      <button class="btn btn-ghost" onclick="navigate('card')">返回卡片資訊</button>
    </div>
  `;
}

// ── Page: Success ─────────────────────────

function renderSuccess(el) {
  const a = appState.lastAction;
  if (!a) { navigate('app'); return; }

  let iconName, iconClass, title, desc, detail, buttons;

  if (a.type === 'activate') {
    iconName = 'verified'; iconClass = 'gold-icon';
    title = '開卡成功';
    desc = `妳的 Girlfriend Black Card 已正式啟用。<br/>從現在開始，妳可以兌換專屬權益。`;
    detail = `持卡人：${a.holderName}`;
    buttons = `
      <button class="btn btn-primary" onclick="navigate('app')">進入黑卡 App</button>
      <button class="btn btn-secondary" onclick="navigate('pwa-guide')">${icon('ios_share')} 加入 iPhone 主畫面教學</button>
    `;
  } else if (a.type === 'benefit') {
    iconName = 'check_circle'; iconClass = 'gold-icon';
    title = '兌換完成';
    desc = `已成功兌換「${a.title}」`;
    detail = a.detail || '';
    buttons = `
      <button class="btn btn-primary" onclick="navigate('transactions')">查看交易紀錄</button>
      <button class="btn btn-secondary" onclick="navigate('products')">回到兌換中心</button>
    `;
  } else if (a.type === 'chargeDone') {
    iconName = 'payments'; iconClass = 'gold-icon';
    title = '扣款完成';
    desc = `已從「${a.title}」扣除<br/><strong>NT$ ${Number(a.amount).toLocaleString()}</strong>`;
    detail = `${a.title}剩餘 NT$ ${Number(a.remaining).toLocaleString()}`;
    buttons = `
      <button class="btn btn-primary" onclick="navigate('app')">回到首頁</button>
      <button class="btn btn-secondary" onclick="navigate('transactions')">查看交易紀錄</button>
    `;
  } else if (a.type === 'daily') {
    iconName = 'favorite'; iconClass = 'gold-icon';
    title = '福利已領取';
    desc = '今日稱讚已送達，請查收。';
    detail = '';
    buttons = `
      <button class="btn btn-primary" onclick="navigate('app')">回到首頁</button>
    `;
  } else {
    navigate('app'); return;
  }

  el.innerHTML = `
    <div class="success-page">
      <div class="success-icon ${iconClass}">${icon(iconName)}</div>
      <div>
        <div class="success-title">${title}</div>
        <div class="success-desc" style="margin-top:8px;">${desc}</div>
        ${detail ? `<div class="success-detail" style="margin-top:8px;">${detail}</div>` : ''}
      </div>
      <div class="success-actions">${buttons}</div>
    </div>
  `;
}
