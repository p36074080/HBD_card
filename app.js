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
  validThru: "FOREVER",
  face: "c00"
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
  'unlock':       renderUnlock,
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

let unlocked = false;   // 本次開啟是否已解鎖（每次冷啟動重置）
let nfcEntry = false;   // 是否由 NFC（帶 ?card=）進入

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  loadCache();
  const cardParam = new URLSearchParams(location.search).get('card');
  if (cardParam) { try { localStorage.setItem('gfc_card_token', cardParam); } catch (e) {} nfcEntry = true; }

  if (location.hash) {
    handleRoute();            // 深層連結 / 重新整理：尊重現有 hash
    refreshFromServer(true);
  } else {
    // 冷啟動：一律先到載入畫面，由 renderTap 抓 server 真實狀態後再決定去向
    location.hash = 'tap';
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  setupPullToRefresh();
});

// ── 下拉重新載入（首頁等主頁面）──────────────
function setupPullToRefresh() {
  const sc = document.getElementById('page-container');
  const shell = document.getElementById('app-shell');
  if (!sc || !shell) return;

  const ind = document.createElement('div');
  ind.id = 'ptr-indicator';
  ind.innerHTML = '<span class="ptr-spinner"></span>';
  shell.appendChild(ind);

  const THRESH = 68;
  let startY = 0, pulling = false, dist = 0, refreshing = false;

  const canPull = () => {
    if (refreshing) return false;
    if (!holderNavPages.includes(currentRoute())) return false;       // 只在主頁面
    if (!document.getElementById('modal-overlay').classList.contains('hidden')) return false;  // 有彈窗時不觸發
    return sc.scrollTop <= 0;
  };

  sc.addEventListener('touchstart', (e) => {
    if (!canPull()) { pulling = false; return; }
    startY = e.touches[0].clientY; pulling = true; dist = 0;
  }, { passive: true });

  sc.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    dist = e.touches[0].clientY - startY;
    if (dist > 0 && sc.scrollTop <= 0) {
      if (e.cancelable) e.preventDefault();       // 接手下拉，顯示指示器
      const pull = Math.min(dist * 0.5, 88);
      ind.style.transform = `translate(-50%, ${Math.min(pull, 60)}px)`;
      ind.style.opacity = Math.min(pull / THRESH, 1);
      ind.classList.toggle('ready', pull >= THRESH * 0.7);
    }
  }, { passive: false });

  sc.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    const pull = Math.min(dist * 0.5, 88);
    dist = 0;
    if (pull >= THRESH * 0.7) {
      refreshing = true;
      ind.classList.remove('ready');
      ind.classList.add('spin');
      ind.style.transform = 'translate(-50%, 52px)';
      ind.style.opacity = '1';
      await refreshFromServer(false);
      handleRoute();
      ind.classList.remove('spin');
      refreshing = false;
    }
    ind.style.transform = '';
    ind.style.opacity = '';
    ind.classList.remove('ready');
  });
}

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

// ── 卡面（使用 card/ 內的設計圖，程式僅保留持卡人姓名）──
// 卡面圖已含晶片/感應/logo 等，故隱藏程式繪製的 chip / member since / mastercard
function renderBlackCard(card, size = 'full') {
  const holder = (card.holderName || 'MEMBER').toUpperCase();
  const face = cardFaceId(card);
  return `
    <div class="black-card faced ${size === 'small' ? 'card-sm' : ''}" style="background-image:url('card/${face}.png')">
      <div class="mc-holder">${holder}</div>
    </div>
  `;
}

// ── 禮物卡（夢幻包款兌換券，示意）──
function renderGiftCard(item) {
  const done = item.remaining <= 0;
  return `
    <div class="gift-card ${done ? 'done' : ''}">
      <div class="gc-watermark">${icon('shopping_bag')}</div>
      ${done ? `<div class="gc-stamp">${icon('check_circle')} 已兌換</div>` : ''}
      <div class="gc-top">
        <span class="gc-brand">GIFT CARD</span>
        <span class="gc-mark">${icon('card_giftcard')}</span>
      </div>
      <div class="gc-center">
        <div class="gc-title">夢幻包款</div>
        <div class="gc-sub">Dream Bag · 專屬兌換券</div>
      </div>
      <div class="gc-bottom">
        <span class="gc-qty">${done ? '已於兌換紀錄留存 · 感謝妳收下' : `可兌換 ${item.remaining} 個`}</span>
        ${done ? '' : `<button class="gc-redeem" onclick="confirmUseBenefit('gift','${item.id}')">${icon('redeem')} 兌換</button>`}
      </div>
    </div>
  `;
}

// 卡片輪播：更新指示點 / 點指示點捲到該卡
window.updateCardDots = function() {
  const t = document.getElementById('cc-track');
  if (!t) return;
  const i = Math.round(t.scrollLeft / t.clientWidth);
  document.querySelectorAll('.cc-dots .cc-dot').forEach((d, k) => d.classList.toggle('active', k === i));
};
window.goCard = function(i) {
  const t = document.getElementById('cc-track');
  if (t) t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
};

// 支付條碼：忘記帶實體卡時，點卡片出示 QR 給男友用 admin 掃描扣款
// 出示期間持續查 server：男友掃描/感應完成扣款（多一筆交易）→ 自動關閉並跳到交易紀錄
let payPoll = null;
let payVis = null;

function txSig(st) {
  const t = (st && st.transactions) || [];
  return t.length + '|' + JSON.stringify(t[0] || {});
}

function stopPayPoll() {
  if (payPoll) { clearInterval(payPoll); payPoll = null; }
  if (payVis) { document.removeEventListener('visibilitychange', payVis); payVis = null; }
}

window.showPaySheet = function() {
  const num = appState.card.displayCardNumber || '';
  showModal(`
    <div class="pay-sheet">
      <div class="pay-title">支付條碼</div>
      <div class="pay-sub">忘記帶卡片時，出示此條碼給熊熊掃描扣款</div>
      <div class="pay-qr-frame">
        <img class="pay-qr-img" src="icons/pay-qr.png" alt="支付條碼" />
      </div>
      <div class="pay-cardno">${num}</div>
      <div class="pay-hint">${icon('lock')} 此條碼僅供熊熊掃描使用</div>
      <button class="btn btn-ghost" onclick="closeModal()">關閉</button>
    </div>
  `);

  stopPayPoll();
  let base = null;   // 第一次查詢當基準，之後有變化才視為完成扣款
  const check = async () => {
    if (document.getElementById('modal-overlay').classList.contains('hidden')) { stopPayPoll(); return; }
    const st = await apiFetchState();
    if (!st || !st.ok) return;
    const sig = txSig(st);
    if (base === null) { base = sig; applyServerState(st); return; }
    if (sig !== base) {
      stopPayPoll();
      applyServerState(st);
      closeModal();
      showToast('已完成扣款', 'success');
      navigate('transactions');
    }
  };
  payPoll = setInterval(check, 1500);
  payVis = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', payVis);
  check();   // 立即抓一次當基準
};

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
  stopPayPoll();   // 關閉支付條碼時停止輪詢
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
        <button class="btn btn-primary" onclick="navigate('activate')">${icon('auto_awesome')} 我準備好開卡了</button>
        <button class="btn btn-ghost" style="margin-top:10px;" onclick="window.location.href='admin.html'">管理端入口</button>
      </div>
    </div>
  `;
}

// ── Page: Tap ─────────────────────────────

function renderTap(el) {
  // App 啟動載入畫面（splash）：品牌字樣 + 乾淨的載入動畫，不需要 NFC 感應圖示/字樣
  el.innerHTML = `
    <div class="tap-page">
      <div class="splash">
        <div class="splash-eyebrow">J BANK</div>
        <div class="splash-title">專屬黑卡</div>
        <div class="splash-spinner"></div>
      </div>
    </div>
  `;
  // 載入：抓 server 真實狀態後決定去向
  (async () => {
    const minWait = new Promise(r => setTimeout(r, 1300));
    await refreshFromServer(false);
    // NFC 感應進來且 server 有待處理動作（兌換/扣款）→ 感應即執行並顯示完成
    if (nfcEntry && appState.pending) {
      const st = await apiCall({ action: 'commitPending' });
      applyServerState(st);
      if (st && st.committed) {
        appState.lastAction = committedToAction(st.committed);
        await minWait;
        navigate('success');
        return;
      }
    }
    await minWait;
    if (!appState.isActivated) { navigate(nfcEntry ? 'activate' : 'welcome'); return; }
    navigate(unlocked ? 'app' : 'unlock');   // 已開卡 → 先解鎖
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
          <label class="input-label">設定交易密碼（4 位數字）</label>
          <input id="activate-pin" class="input-field" type="tel" inputmode="numeric" maxlength="4" placeholder="每次兌換時要輸入" />
          <div class="dim-text" style="font-size:11px;margin-top:2px;">這組密碼之後每次兌換都會用到，由妳自己決定</div>
        </div>
      </div>

      <button class="btn btn-primary" onclick="doActivate()" style="margin-top:auto;">${icon('credit_card')} 開通我的黑卡</button>
    </div>
  `;
}

window.doActivate = async function() {
  const name = document.getElementById('activate-name').value.trim() || 'Ariel';
  const pin = (document.getElementById('activate-pin').value || '').replace(/\D/g, '').slice(0, 4);
  if (pin.length !== 4) { showToast('請設定 4 位數字交易密碼', 'error'); return; }
  const btn = document.querySelector('.activate-page .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '開通中…'; }
  const st = await apiCall({ action: 'activate', holderName: name, pin, face: DEFAULT_FACE });
  if (applyServerState(st)) {
    unlocked = true;   // 剛開卡完直接視為已解鎖
    appState.lastAction = { type: 'activate', holderName: appState.card.holderName };
    navigate('success');
  } else {
    showToast((st && st.error) ? st.error : '開卡失敗，請檢查連線', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('credit_card')} 開通我的黑卡`; }
  }
};

// ── Page: Unlock（每次開啟先解鎖，像銀行 App）──

// 依當下時間顯示問候語
function greetingText() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11)  return 'GOOD MORNING';
  if (h >= 11 && h < 17) return 'GOOD AFTERNOON';
  if (h >= 17 && h < 22) return 'GOOD EVENING';
  return 'GOOD NIGHT';
}

function renderUnlock(el) {
  el.innerHTML = `
    <div class="unlock-screen">
      <div class="unlock-brand">${greetingText()}</div>
      <button class="unlock-btn" onclick="unlockApp()" aria-label="輕觸解鎖">${icon('lock')}</button>
      <div class="unlock-text">
        <div class="unlock-hi">Hi, ${appState.card.holderName}</div>
        <div class="unlock-hint">輕觸解鎖妳的專屬黑卡</div>
      </div>
    </div>
  `;
}

window.unlockApp = function() {
  unlocked = true;
  const btn = document.querySelector('.unlock-btn');
  if (btn) { btn.classList.add('unlocking'); btn.innerHTML = icon('lock_open'); }
  setTimeout(() => navigate('app'), 280);
};

window.lockApp = function() {
  unlocked = false;
  navigate('unlock');
};

// ── Page: App Home ────────────────────────

let balanceHidden = false;

function balanceDisplay(total) {
  return balanceHidden
    ? '<span class="bb-cur">NT$</span> ••••••'
    : `<span class="bb-cur">NT$</span> ${total.toLocaleString()}`;
}

function renderApp(el) {
  const recent = appState.transactions.slice(0, 3);  // server 已是最新在前
  const cashback = appState.benefits.cashback.items;
  const total = cashback.reduce((s, i) => s + i.remaining, 0);
  const gift = findBenefitAny(appState.benefits, 'gift_bag');   // 禮物卡（夢幻包款）
  el.innerHTML = `
    <div class="app-page">
      <div class="app-header">
        <div class="app-header-text">
          <div class="greeting-sub">${greetingText()}</div>
          <div class="greeting-name">Hi, ${appState.card.holderName}</div>
          <div class="greeting-desc">感謝妳選擇專屬於妳的專屬黑卡</div>
        </div>
        <div class="app-header-actions">
          <a class="hdr-btn" href="tel:0917680220" aria-label="客服專線">${icon('support_agent')}</a>
          <button class="hdr-btn" onclick="lockApp()" aria-label="鎖定並回到解鎖畫面">${icon('lock')}</button>
        </div>
      </div>

      <!-- 卡片輪播（主卡 + 禮物卡），下方指示點 -->
      <div class="card-carousel">
        <div class="cc-track" id="cc-track" onscroll="updateCardDots()">
          <div class="cc-slide" onclick="showPaySheet()" role="button" tabindex="0" aria-label="出示支付條碼">${renderBlackCard(appState.card)}</div>
          ${gift ? `<div class="cc-slide">${renderGiftCard(gift.item)}</div>` : ''}
        </div>
        <div class="cc-dots">
          <button class="cc-dot active" aria-label="黑卡" onclick="goCard(0)"></button>
          ${gift ? `<button class="cc-dot" aria-label="禮物卡" onclick="goCard(1)"></button>` : ''}
        </div>
      </div>

      <!-- 可用餘額 + 專屬權益（獨立區塊，不放卡面）-->
      <div class="balance-wrap">
        <div class="balance-block">
          <div class="balance-main">
            <div class="bb-label">可用餘額
              <span class="eye-btn" role="button" tabindex="0" aria-label="顯示或隱藏餘額"
                    onclick="toggleBalance()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleBalance();}">${icon('visibility')}</span>
            </div>
            <div class="bb-amount-row">
              <div class="bb-amount" id="balance-amount" aria-live="polite">${balanceDisplay(total)}</div>
              <button class="bb-chev-btn" id="cb-chevron" onclick="toggleCashback()"
                      aria-label="刷卡金明細" aria-expanded="false" aria-controls="cashback-panel">${icon('expand_more')}</button>
            </div>
          </div>
          <div class="bb-divider"></div>
          <div class="balance-actions">
            <button class="round-action" onclick="navigate('benefits')" aria-label="查看專屬權益">
              <span class="round-ico">${icon('workspace_premium')}</span>
              <span class="round-lbl">專屬權益</span>
            </button>
          </div>
        </div>

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

      <!-- 經常兌換（女友可自訂的首頁快捷）-->
      <div class="card fav-card">
        <div class="section-header txn-card-head">
          <div class="section-title">經常兌換</div>
          <button class="fav-edit-btn" onclick="openFavEditor()" aria-label="編輯經常兌換">${icon('tune')} 編輯</button>
        </div>
        ${renderFavRow()}
      </div>

      <div class="card">
        <div class="section-header txn-card-head">
          <div class="section-title">最近交易</div>
          <div class="section-more" onclick="navigate('transactions')">查看全部 ${icon('chevron_right')}</div>
        </div>
        ${recent.map(renderTransactionItem).join('')}
        ${recent.length === 0 ? '<p style="color:var(--text-dim);font-size:14px;text-align:center;padding:16px 0;">尚無交易紀錄</p>' : ''}
      </div>
    </div>
  `;
}

window.toggleBalance = function() {
  balanceHidden = !balanceHidden;
  const total = appState.benefits.cashback.items.reduce((s, i) => s + i.remaining, 0);
  const amt = document.getElementById('balance-amount');
  if (amt) amt.innerHTML = balanceDisplay(total);
  const eye = document.querySelector('.eye-btn .material-symbols-outlined');
  if (eye) eye.textContent = balanceHidden ? 'visibility_off' : 'visibility';
};

window.toggleCashback = function() {
  const p = document.getElementById('cashback-panel');
  const c = document.getElementById('cb-chevron');
  const open = p ? !p.classList.contains('open') : false;
  if (p) p.classList.toggle('open');
  if (c) { c.classList.toggle('open', open); c.setAttribute('aria-expanded', String(open)); }
};

// ── 經常兌換區塊 ──
function renderFavRow() {
  const favs = favoriteList(appState.benefits);
  if (!favs.length) {
    return `<div class="fav-empty">尚未設定，點右上「編輯」加入常用兌換</div>`;
  }
  return `
    <div class="fav-row">
      ${favs.map(f => `
        <button class="fav-item ${f.item.remaining <= 0 ? 'used' : ''}"
                onclick="confirmUseBenefit('${f.key}','${f.item.id}')" aria-label="兌換 ${f.item.title}">
          <span class="fav-ico">${icon(f.item.icon)}</span>
          <span class="fav-lbl">${f.item.title}</span>
        </button>
      `).join('')}
    </div>
  `;
}

// ── 經常兌換編輯（bottom sheet）──
let favEdit = [];

window.openFavEditor = function() {
  favEdit = favoriteList(appState.benefits).map(f => f.item.id);
  showModal(renderFavEditor());
};

function renderFavEditor() {
  const selected = favEdit.map(id => findBenefitAny(appState.benefits, id)).filter(Boolean);
  const available = favoritableItems(appState.benefits).filter(x => !favEdit.includes(x.item.id));
  return `
    <div class="modal-title">編輯經常兌換</div>
    <div class="modal-desc">最多 5 個；由上到下＝首頁由左到右。</div>
    <div class="fav-edit">
      <div class="fav-edit-sec">已加入（${selected.length}/5）</div>
      ${selected.length ? selected.map((x, i) => `
        <div class="fav-edit-row">
          <span class="fav-edit-ico">${icon(x.item.icon)}</span>
          <span class="fav-edit-name">${x.item.title}</span>
          <span class="fav-edit-ctrls">
            <button class="fav-mini" ${i === 0 ? 'disabled' : ''} onclick="favMove('${x.item.id}',-1)" aria-label="上移">${icon('keyboard_arrow_up')}</button>
            <button class="fav-mini" ${i === selected.length - 1 ? 'disabled' : ''} onclick="favMove('${x.item.id}',1)" aria-label="下移">${icon('keyboard_arrow_down')}</button>
            <button class="fav-mini remove" onclick="favRemove('${x.item.id}')" aria-label="移除">${icon('close')}</button>
          </span>
        </div>
      `).join('') : `<div class="fav-empty" style="padding:12px 0;">尚未加入任何項目</div>`}

      <div class="fav-edit-sec">可加入</div>
      ${available.length ? available.map(x => `
        <div class="fav-edit-row">
          <span class="fav-edit-ico">${icon(x.item.icon)}</span>
          <span class="fav-edit-name">${x.item.title}</span>
          <button class="fav-mini add" ${favEdit.length >= 5 ? 'disabled' : ''} onclick="favAdd('${x.item.id}')" aria-label="加入">${icon('add')}</button>
        </div>
      `).join('') : `<div class="fav-empty" style="padding:12px 0;">已全部加入</div>`}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="runWithLoading(this, () => saveFavorites())">儲存</button>
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
    </div>
  `;
}

function refreshFavEditor() {
  const box = document.getElementById('modal-box');
  if (box) box.innerHTML = `<div class="modal-handle"></div>` + renderFavEditor();
}

window.favAdd = function(id) {
  if (favEdit.length >= 5 || favEdit.includes(id)) return;
  favEdit.push(id);
  refreshFavEditor();
};
window.favRemove = function(id) {
  favEdit = favEdit.filter(x => x !== id);
  refreshFavEditor();
};
window.favMove = function(id, dir) {
  const i = favEdit.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= favEdit.length) return;
  [favEdit[i], favEdit[j]] = [favEdit[j], favEdit[i]];
  refreshFavEditor();
};
window.saveFavorites = async function() {
  const st = await apiCall({ action: 'setFavorites', ids: favEdit });
  if (!applyServerState(st)) { showToast((st && st.error) || '儲存失敗，請檢查連線', 'error'); return; }
  closeModal();
  showToast('已更新經常兌換', 'success');
  handleRoute();
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
      <div class="card-page-head">
        <h1>卡片資訊</h1>
        <button class="icon-btn" onclick="openFaceEditor()" aria-label="更換卡面">${icon('style')}</button>
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

// ── 更換卡面（bottom sheet）──────────────
window.openFaceEditor = function() {
  const cur = cardFaceId(appState.card);
  const grid = CARD_FACES.map(f => `
    <button class="face-opt ${f === cur ? 'active' : ''}" onclick="selectFace('${f}')" aria-label="卡面 ${f}">
      <img src="card/${f}.png" alt="卡面 ${f}" loading="lazy" />
      ${f === cur ? `<span class="face-check">${icon('check_circle')}</span>` : ''}
    </button>
  `).join('');
  showModal(`
    <div class="face-sheet">
      <div class="modal-title">選擇卡面</div>
      <div class="face-sub">挑一款妳喜歡的卡片樣式，隨時都能換</div>
      <div class="face-grid">${grid}</div>
      <button class="btn btn-ghost" onclick="closeModal()">關閉</button>
    </div>
  `);
};

window.selectFace = async function(face) {
  if (CARD_FACES.indexOf(face) < 0) return;
  if (cardFaceId(appState.card) === face) { closeModal(); return; }
  appState.card.face = face;      // 立即換卡面（樂觀更新）
  saveCache();
  closeModal();
  handleRoute();
  showToast('已更換卡面', 'success');
  try { const st = await apiCall({ action: 'setCardFace', face }); if (st && st.ok) applyServerState(st); } catch (e) {}
};

// ── Benefit usage ─────────────────────────

function findBenefit(key, id) {
  const cat = appState.benefits[key];
  return cat ? cat.items.find(i => i.id === id) : null;
}

// 兌換流程：點兌換 → 輸入支付密碼 → 把 pending 寫到 server → 顯示「請感應卡片」
// → 感應後瀏覽器開啟 ?card= 入口，讀到 server 的 pending 即執行兌換並顯示完成。
//   同畫面保留「我已完成感應」按鈕作為備援（同樣呼叫 commitPending）。

let pinTarget = null;
let redeemBusy = false;
let redeemPoll = null;          // 感應畫面定時查詢是否已完成
let redeemVis = null;           // 回到 App 時立即查一次的 visibility handler

// 女友開卡時自己設定的交易密碼（存在 Card sheet，隨 state 回傳）
function cardPin() {
  const p = appState.card && appState.card.pin;
  return (p === null || p === undefined || p === '') ? '' : String(p).padStart(4, '0');
}

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
      <div class="pin-top">
        <button class="back-btn" onclick="cancelPin()">${icon('chevron_left')} 取消</button>
      </div>
      <div class="pin-body">
        <div class="pin-head">
          <div class="pin-lock-circle">${icon('lock')}</div>
          <div class="pin-title">請輸入支付密碼</div>
          <div class="pin-sub">輸入 4 位數密碼以兌換「${item.title}」</div>
        </div>
        <div class="pin-dots" id="pin-dots" onclick="focusPin()">
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <input id="pin-input" class="pin-hidden" type="tel" inputmode="numeric"
                 maxlength="4" autocomplete="off" oninput="onPinInput()" />
        </div>
        <div class="pin-err" id="pin-err"></div>
      </div>
      <div class="pin-hint">${icon('info')} 輸入正確密碼後進入感應畫面</div>
    </div>
  `;
  // 同步 focus：保留在點擊手勢內，iOS 才會自動叫起鍵盤；再補一次以防未繪製完成
  const inp0 = document.getElementById('pin-input');
  if (inp0) inp0.focus();
  setTimeout(() => { const i = document.getElementById('pin-input'); if (i) i.focus(); }, 80);
}

window.focusPin = function() {
  const i = document.getElementById('pin-input');
  if (i) i.focus();
};

window.onPinInput = function() {
  const inp = document.getElementById('pin-input');
  const val = (inp.value || '').replace(/\D/g, '').slice(0, 4);
  inp.value = val;
  const dots = document.querySelectorAll('#pin-dots .pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < val.length));
  const err = document.getElementById('pin-err');
  if (err) err.textContent = '';
  if (val.length === 4) {
    const pin = cardPin();
    if (!pin || val === pin) {
      const t = pinTarget; pinTarget = null;
      showRedeemTap(t.key, t.id);
    } else {
      const wrap = document.getElementById('pin-dots');
      if (wrap) wrap.classList.add('shake');
      if (err) err.textContent = '密碼錯誤，請再試一次';
      setTimeout(() => {
        inp.value = '';
        dots.forEach(d => d.classList.remove('filled'));
        if (wrap) wrap.classList.remove('shake');
        inp.focus();
      }, 500);
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
        <button class="btn btn-primary" onclick="runWithLoading(this, () => finishRedeem())">${icon('check_circle')} 我已完成感應</button>
        <button class="btn btn-ghost" onclick="runWithLoading(this, () => cancelRedeem())">取消</button>
      </div>
    </div>
  `;
  // 把待處理動作寫到 server，供感應後開啟的新分頁讀取並執行
  const st = await apiCall({ action: 'setPending', pAction: 'redeem', id, title: item.title, unit });
  if (!st || !st.ok) { showToast('連線失敗，請稍後再試', 'error'); return; }
  startRedeemPoll();   // 開始定時查詢：感應端完成後自動跳轉
}

// 定時查詢 server：當 pending 被感應端結算掉 → 自動到交易紀錄
// 另外監聽 visibilitychange：從 NFC 開啟的新分頁切回 App 時立即查一次，不用等輪詢
// redeemActive：取消/完成時立刻設 false，避免「取消時剛好把 pending 清掉」被 in-flight 查詢誤判成兌換完成
let redeemActive = false;

function stopRedeemPoll() {
  redeemActive = false;
  clearInterval(redeemPoll);
  if (redeemVis) { document.removeEventListener('visibilitychange', redeemVis); redeemVis = null; }
}

function startRedeemPoll() {
  stopRedeemPoll();
  redeemActive = true;
  const check = async () => {
    if (!redeemActive || !document.querySelector('.tap-screen')) { stopRedeemPoll(); return; }
    const st = await apiFetchState();
    if (!redeemActive || !document.querySelector('.tap-screen')) return;   // 取消後 in-flight 查詢直接作廢
    if (st && st.ok && !st.pending) {        // 待處理已被結算
      stopRedeemPoll();
      applyServerState(st);
      showToast('兌換完成', 'success');
      navigate('transactions');
    }
  };
  redeemPoll = setInterval(check, 1200);
  redeemVis = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', redeemVis);
}

window.cancelRedeem = async function() {
  stopRedeemPoll();               // 先停止輪詢（redeemActive=false）
  await apiCall({ action: 'clearPending' });
  handleRoute();   // hash 已是 products，重繪回兌換頁
};

window.finishRedeem = async function() {
  if (redeemBusy) return;
  redeemBusy = true;
  stopRedeemPoll();
  const st = await apiCall({ action: 'commitPending' });
  redeemBusy = false;
  applyServerState(st);
  if (st && st.committed) {
    appState.lastAction = committedToAction(st.committed);
    navigate('success');
  } else {
    showToast('尚未感應或交易已完成', 'info');
    navigate('transactions');
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
