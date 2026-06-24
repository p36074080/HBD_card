/* ─────────────────────────────────────────
   Girlfriend Black Card  ·  admin.js
   Admin portal — separate from holder app
   (data.js must be loaded before this file)
───────────────────────────────────────── */

// ── State (API + localStorage cache, shared with index) ──

const defaultCard = {
  cardToken: "c_demo_05201314",
  displayCardNumber: "0520 1314 0001",
  holderName: "Ariel",
  status: "active",
  activatedAt: "2026-06-15",
  validThru: "FOREVER"
};

let adminState = {
  isActivated: false,
  card: { ...defaultCard },
  transactions: [...DEFAULT_TRANSACTIONS],
  benefits: cloneBenefits(),
  lastAction: null
};

// 與 index 共用同一份快取 key（gfc_cache）
function loadCache() {
  try {
    const s = JSON.parse(localStorage.getItem('gfc_cache'));
    if (s) {
      if (s.card) adminState.card = Object.assign({}, adminState.card, s.card);
      if (s.transactions) adminState.transactions = s.transactions;
      if (s.benefits) adminState.benefits = s.benefits;
      adminState.isActivated = !!s.isActivated;
    }
  } catch (e) {}
}

function saveCache() {
  try {
    localStorage.setItem('gfc_cache', JSON.stringify({
      card: adminState.card,
      transactions: adminState.transactions,
      benefits: adminState.benefits,
      isActivated: adminState.isActivated
    }));
  } catch (e) {}
}

function applyServerState(st) {
  if (!st || !st.ok) return false;
  if (st.card) {
    adminState.card = Object.assign({}, adminState.card, st.card);
    adminState.isActivated = st.card.status === 'active';
  }
  if (st.transactions) adminState.transactions = st.transactions;
  adminState.benefits = mergeBenefitsFromServer(st.benefits);
  saveCache();
  return true;
}

function stateSig() {
  return JSON.stringify({
    c: adminState.card, a: adminState.isActivated,
    t: adminState.transactions, b: adminState.benefits
  });
}

// reRender：只有資料真的有變動時才重繪，避免無謂閃動
async function refreshFromServer(reRender) {
  try {
    const before = stateSig();
    const st = await apiFetchState();
    if (applyServerState(st) && reRender && stateSig() !== before) handleRoute();
    return st;
  } catch (e) { return null; }
}

// 手動 reload（紀錄頁右上角按鈕）
window.reloadData = async function(btn) {
  if (btn) btn.classList.add('spinning');
  await refreshFromServer(false);
  handleRoute();
};

// ── Router ────────────────────────────────

const routes = {
  'admin':              renderAdminHome,
  'admin-card':         renderAdminCard,
  'admin-cashback':     renderAdminCashback,
  'admin-transactions': renderAdminTransactions,
  'success':            renderAdminSuccess
};

const navPages = ['admin', 'admin-card', 'admin-cashback', 'admin-transactions'];

function navigate(hash) {
  window.location.hash = hash;
}

function currentRoute() {
  return window.location.hash.replace('#', '') || 'admin';
}

function handleRoute() {
  const route = currentRoute();
  const fn = routes[route] || renderAdminHome;
  const container = document.getElementById('page-container');
  const nav = document.getElementById('bottom-nav');

  const div = document.createElement('div');
  div.className = 'page';
  container.innerHTML = '';
  container.appendChild(div);
  fn(div);

  if (navPages.includes(route)) {
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
  handleRoute();            // 先用快取即時顯示
  refreshFromServer(true);  // 開啟時向 Google Sheet 同步一次（內容有變才重繪）
});

// ── Bottom Nav ────────────────────────────

function renderBottomNav(el, active) {
  const items = [
    { icon: 'dashboard',    label: '總覽',   hash: 'admin' },
    { icon: 'credit_card',  label: '卡片',   hash: 'admin-card' },
    { icon: 'paid',         label: '刷卡金', hash: 'admin-cashback' },
    { icon: 'receipt_long', label: '紀錄',   hash: 'admin-transactions' }
  ];
  el.innerHTML = items.map(item => `
    <div class="nav-item ${item.hash === active ? 'active' : ''}" onclick="navigate('${item.hash}')">
      <span class="nav-icon">${icon(item.icon)}</span>
      <span class="nav-label">${item.label}</span>
    </div>
  `).join('');
}

// ── Shared Components ─────────────────────

function renderBlackCard(card, size = 'full') {
  return `
    <div class="black-card" style="${size === 'small' ? 'max-width:280px;' : ''}">
      <div class="card-brand">♠</div>
      <div class="card-logo">Girlfriend Black Card</div>
      <div class="card-chip"></div>
      <div class="card-nfc">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8"/>
          <path d="M16 12a4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4"/>
          <circle cx="12" cy="12" r="1"/>
        </svg>
      </div>
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

// ── Modal & Toast ─────────────────────────

function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = `<div class="modal-handle"></div>` + html;
  overlay.classList.remove('hidden');
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

window.closeModal = closeModal;

function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  el.innerHTML = `<span>${icon(ic)}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Page: Admin Home ──────────────────────

function renderAdminHome(el) {
  const todayTxns = adminState.transactions.filter(t => t.createdAt.startsWith('今天'));
  const card = adminState.card;
  const cbTotal = cashbackTotal(adminState.benefits);
  const voucherLeft = adminState.benefits.vouchers.items.reduce((s, i) => s + i.remaining, 0);
  el.innerHTML = `
    <div class="admin-page">
      <div class="admin-header">
        <div class="admin-eyebrow">Admin Dashboard</div>
        <div class="admin-title">Girlfriend Black Card</div>
        <div class="admin-subtitle">管理她的專屬刷卡金與兌換紀錄</div>
      </div>

      <div class="admin-summary">
        <div class="summary-chip">
          <div class="summary-chip-label">持卡人</div>
          <div class="summary-chip-value">${card.holderName}</div>
        </div>
        <div class="summary-chip">
          <div class="summary-chip-label">卡片狀態</div>
          <div class="summary-chip-value green">${adminState.isActivated ? 'Active' : '未開卡'}</div>
        </div>
        <div class="summary-chip" style="grid-column:span 2;">
          <div class="summary-chip-label">刷卡金總額</div>
          <div class="summary-chip-value gold" style="font-size:26px;">NT$ ${cbTotal.toLocaleString()}</div>
        </div>
        <div class="summary-chip">
          <div class="summary-chip-label">票券剩餘</div>
          <div class="summary-chip-value">${voucherLeft} 張</div>
        </div>
        <div class="summary-chip">
          <div class="summary-chip-label">今日交易</div>
          <div class="summary-chip-value">${todayTxns.length} 筆</div>
        </div>
      </div>

      <div class="admin-actions">
        <div class="admin-action-card" onclick="navigate('admin-card')">
          <div class="aac-icon">${icon('credit_card')}</div>
          <div class="aac-label">查看卡片</div>
          <div class="aac-desc">卡片與權益庫存</div>
        </div>
        <div class="admin-action-card" onclick="openCashback('store')">
          <div class="aac-icon">${icon('savings')}</div>
          <div class="aac-label">刷卡金儲值</div>
          <div class="aac-desc">為指定項目加值</div>
        </div>
        <div class="admin-action-card" onclick="openCashback('charge')">
          <div class="aac-icon">${icon('payments')}</div>
          <div class="aac-label">刷卡金扣款</div>
          <div class="aac-desc">感應卡片刷卡</div>
        </div>
        <div class="admin-action-card" onclick="navigate('admin-transactions')">
          <div class="aac-icon">${icon('receipt_long')}</div>
          <div class="aac-label">交易紀錄</div>
          <div class="aac-desc">查看全部記錄</div>
        </div>
      </div>

      <button class="btn btn-ghost" onclick="window.location.href='index.html#app'">切換到持卡人 App</button>
      <button class="btn btn-ghost" style="color:var(--danger);" onclick="confirmReset()">${icon('restart_alt')} 重置測試狀態（恢復未開卡）</button>
    </div>
  `;
}

// ── 重置 / 初始化（測試用）──
window.confirmReset = function() {
  showModal(`
    <div class="modal-title">重置測試狀態</div>
    <div class="modal-desc">
      將卡片恢復為<strong>未開卡</strong>、所有刷卡金與票券<strong>補滿</strong>、並<strong>清空交易紀錄</strong>。<br/>
      用於測試完整流程，此動作無法復原。
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="doReset()">確認重置</button>
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
    </div>
  `);
};

window.doReset = async function() {
  closeModal();
  const st = await apiCall({ action: 'reset' });
  if (!applyServerState(st)) { showToast((st && st.error) || '重置失敗，請檢查連線', 'error'); return; }
  showToast('已重置為未開卡狀態', 'success');
  handleRoute();
};

window.openCashback = function(mode) {
  cashbackMode = mode;
  navigate('admin-cashback');
};

// ── Page: Admin Card + Benefit Inventory ──

function renderAdminCard(el) {
  const card = adminState.card;
  const recent = adminState.transactions.slice(0, 3);  // server 已是最新在前
  const cbTotal = cashbackTotal(adminState.benefits);

  // Admin action: 管理 for countable/money items, badge otherwise.
  const actionFor = (key, item) => {
    if (item.kind === 'unlimited') return `<span class="benefit-badge">無限</span>`;
    if (item.kind === 'always')    return `<span class="benefit-badge always">專屬</span>`;
    return `<button class="btn btn-secondary btn-sm" onclick="adminManageBenefit('${key}','${item.id}')">管理</button>`;
  };

  el.innerHTML = `
    <div class="admin-page">
      <div class="admin-header">
        <div class="admin-eyebrow">Card Detail</div>
        <div class="admin-title">卡片詳情</div>
      </div>

      ${renderBlackCard(card)}

      <div class="card">
        <div class="info-list">
          <div class="info-row">
            <span class="info-row-label">持卡人</span>
            <span class="info-row-value">${card.holderName}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">卡號</span>
            <span class="info-row-value" style="font-size:12px;letter-spacing:0.1em;">${card.displayCardNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">刷卡金總額</span>
            <span class="info-row-value gold-text">NT$ ${cbTotal.toLocaleString()}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">開卡日期</span>
            <span class="info-row-value">${card.activatedAt}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">卡片狀態</span>
            <span class="info-row-value status-active">● ${adminState.isActivated ? 'Active' : '未開卡'}</span>
          </div>
        </div>
      </div>

      <div class="benefit-intro">
        <span class="bi-ico">${icon('inventory_2')}</span>
        <div>
          <h2>權益庫存管理</h2>
          <p>點「管理」可調整剩餘次數或補滿額度</p>
        </div>
      </div>

      ${renderBenefitSections(adminState.benefits, actionFor)}

      <div style="display:flex;gap:10px;">
        <button class="btn btn-primary" style="flex:1;" onclick="openCashback('store')">刷卡金儲值</button>
        <button class="btn btn-danger" style="flex:1;" onclick="openCashback('charge')">刷卡金扣款</button>
      </div>
    </div>
  `;
}

// ── Benefit inventory management (vouchers/privileges/cashback) ──

function findBenefit(key, id) {
  const cat = adminState.benefits[key];
  return cat ? cat.items.find(i => i.id === id) : null;
}

window.adminManageBenefit = function(key, id) {
  const item = findBenefit(key, id);
  if (!item) return;
  const isMoney = item.kind === 'money';
  const unit = isMoney ? '' : (item.unit || '次');
  const fmtVal = v => isMoney ? `NT$ ${v.toLocaleString()}` : `${v} ${unit}`;
  showModal(`
    <div class="modal-title">管理 ${item.title}</div>
    <div class="modal-desc">
      目前剩餘 <strong>${fmtVal(item.remaining)}</strong>（總額 ${fmtVal(item.total)}）
    </div>
    <div class="form-row" style="margin-bottom:16px;">
      <label class="input-label">設定剩餘數值</label>
      <input id="benefit-set" class="input-field" type="number" inputmode="numeric" value="${item.remaining}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="adminSetBenefit('${key}','${id}')">儲存</button>
      <button class="btn btn-secondary" onclick="adminRestoreBenefit('${key}','${id}')">補滿至總額</button>
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
    </div>
  `);
};

window.adminSetBenefit = async function(key, id) {
  const item = findBenefit(key, id);
  if (!item) return;
  let val = parseInt(document.getElementById('benefit-set').value, 10);
  if (isNaN(val) || val < 0) { showToast('請輸入有效數值', 'error'); return; }
  if (val > item.total) val = item.total;
  closeModal();
  const st = await apiCall({ action: 'setBenefit', id, remaining: val });
  if (!applyServerState(st)) { showToast((st && st.error) || '更新失敗，請檢查連線', 'error'); return; }
  showToast(`已更新 ${item.title}`, 'success');
  renderAdminCard(document.querySelector('.page'));
};

window.adminRestoreBenefit = async function(key, id) {
  const item = findBenefit(key, id);
  if (!item) return;
  closeModal();
  const st = await apiCall({ action: 'restoreBenefit', id });
  if (!applyServerState(st)) { showToast((st && st.error) || '更新失敗，請檢查連線', 'error'); return; }
  showToast(`已補滿 ${item.title}`, 'success');
  renderAdminCard(document.querySelector('.page'));
};

// ── Page: Cashback (儲值 / 扣款) ──────────

let cashbackMode = 'store';                 // 'store' | 'charge'
let cashbackPool = 'cb_medical';            // selected pool id
let cashbackAmount = '';                    // current input value
let pendingCharge = null;                   // {poolId, amount, note}
let chargeTimer = null;

function renderAdminCashback(el) {
  const pools = adminState.benefits.cashback.items;
  if (!pools.find(p => p.id === cashbackPool)) cashbackPool = pools[0].id;
  const isCharge = cashbackMode === 'charge';

  el.innerHTML = `
    <div class="admin-page">
      <div class="admin-header">
        <div class="admin-eyebrow">Spending Credit</div>
        <div class="admin-title">刷卡金${isCharge ? '扣款' : '儲值'}</div>
        <div class="admin-subtitle">選擇項目與金額${isCharge ? '，確認後請她感應卡片' : ''}</div>
      </div>

      <div class="seg-toggle">
        <div class="seg-btn store ${!isCharge ? 'active' : ''}" onclick="setCashbackMode('store')">儲值</div>
        <div class="seg-btn charge ${isCharge ? 'active' : ''}" onclick="setCashbackMode('charge')">扣款</div>
      </div>

      <div>
        <div class="input-label" style="margin-bottom:8px;">選擇刷卡金項目</div>
        <div class="pool-grid">
          ${pools.map(p => `
            <div class="pool-card ${p.id === cashbackPool ? 'active' : ''}" onclick="setCashbackPool('${p.id}')">
              <div class="pool-card-top">${icon(p.icon)}<span class="pool-card-name">${p.title}</span></div>
              <div class="pool-card-bal">剩餘 NT$ ${p.remaining.toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-section">
        <div class="form-row">
          <label class="input-label">${isCharge ? '扣款' : '儲值'}金額</label>
          <input id="cashback-amount" class="input-field" type="number" inputmode="numeric" placeholder="輸入金額"
                 value="${cashbackAmount}" oninput="cashbackAmount=this.value" />
        </div>
        <div class="quick-amounts">
          ${[300, 520, 1000, 3000].map(n => `
            <div class="quick-amount-btn" onclick="setCashbackQuick(${n})">${isCharge ? '' : '+'}${n}</div>
          `).join('')}
        </div>
        <div class="form-row">
          <label class="input-label">備註（可選）</label>
          <input id="cashback-note" class="input-field" type="text" placeholder="${isCharge ? '例：醫美課程' : '例：520 節加碼'}" />
        </div>
      </div>

      <button class="btn ${isCharge ? 'btn-danger' : 'btn-primary'}" onclick="doCashback()">
        ${isCharge ? '確認扣款並感應' : '確認儲值'}
      </button>
    </div>
  `;
}

window.setCashbackMode = function(m) { cashbackMode = m; renderAdminCashback(document.querySelector('.page')); };
window.setCashbackPool = function(id) { cashbackPool = id; renderAdminCashback(document.querySelector('.page')); };
window.setCashbackQuick = function(n) {
  cashbackAmount = String(n);
  const inp = document.getElementById('cashback-amount');
  if (inp) inp.value = n;
};

window.doCashback = async function() {
  const amount = parseInt(cashbackAmount, 10);
  if (!amount || amount <= 0) { showToast('請輸入有效金額', 'error'); return; }
  const pool = findBenefit('cashback', cashbackPool);
  if (!pool) return;
  const note = (document.getElementById('cashback-note').value || '').trim() || pool.title;

  if (cashbackMode === 'store') {
    // 儲值不需感應，直接寫回 Sheet
    const btn = document.querySelector('.admin-page .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '儲值中…'; }
    const st = await apiCall({ action: 'topup', id: pool.id, amount, note });
    if (!applyServerState(st)) {
      showToast((st && st.error) || '儲值失敗，請檢查連線', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '確認儲值'; }
      return;
    }
    const updated = findBenefit('cashback', pool.id);
    adminState.lastAction = { type: 'topup', amount, poolTitle: pool.title, remaining: updated ? updated.remaining : amount };
    cashbackAmount = '';
    navigate('success');
  } else {
    if (amount > pool.remaining) { showToast(`超過剩餘額度（NT$ ${pool.remaining.toLocaleString()}）`, 'error'); return; }
    pendingCharge = { poolId: pool.id, amount, note };
    showChargeTap();
  }
};

// 扣款需感應：顯示「請她感應卡片」示意（含倒數與感應完成）
function showChargeTap() {
  const pool = findBenefit('cashback', pendingCharge.poolId);
  const amount = pendingCharge.amount;
  const container = document.getElementById('page-container');
  document.getElementById('bottom-nav').classList.add('hidden');
  const div = document.createElement('div');
  div.className = 'page';
  container.innerHTML = '';
  container.appendChild(div);

  let secs = 60;
  div.innerHTML = `
    <div class="tap-screen">
      ${renderNfcAnim('contactless')}
      <div>
        <div class="eyebrow" style="font-size:10px;letter-spacing:0.2em;color:var(--gold-dim);text-transform:uppercase;margin-bottom:10px;">NFC Charge</div>
        <div class="tap-title">請她將卡片<br/>感應你的手機</div>
        <div class="tap-sub" style="margin-top:10px;">感應後即完成這筆刷卡金扣款</div>
      </div>
      <div class="tap-detail-box">
        <div class="tap-detail-row">
          <span class="tap-detail-label">扣款項目</span>
          <span class="tap-detail-value">${pool.title}</span>
        </div>
        <div class="tap-detail-row">
          <span class="tap-detail-label">扣款金額</span>
          <span class="tap-detail-value" style="color:var(--danger);">- NT$ ${amount.toLocaleString()}</span>
        </div>
        <div class="tap-detail-row">
          <span class="tap-detail-label">扣款後剩餘</span>
          <span class="tap-detail-value gold-text">NT$ ${(pool.remaining - amount).toLocaleString()}</span>
        </div>
      </div>
      <div class="tap-countdown" id="tap-countdown">${secs} 秒後自動完成</div>
      <div class="tap-actions">
        <button class="btn btn-danger" onclick="finishCharge()">${icon('check_circle')} 感應完成，執行扣款</button>
        <button class="btn btn-ghost" onclick="cancelCharge()">取消</button>
      </div>
    </div>
  `;

  clearInterval(chargeTimer);
  chargeTimer = setInterval(() => {
    if (!document.body.contains(div)) { clearInterval(chargeTimer); return; }
    secs -= 1;
    if (secs <= 0) { clearInterval(chargeTimer); finishCharge(); return; }
    const cd = document.getElementById('tap-countdown');
    if (cd) cd.textContent = `${secs} 秒後自動完成`;
  }, 1000);
}

window.cancelCharge = function() {
  clearInterval(chargeTimer);
  pendingCharge = null;
  handleRoute();   // hash 已是 admin-cashback，直接重繪回該頁
};

let chargeBusy = false;

window.finishCharge = async function() {
  clearInterval(chargeTimer);
  if (!pendingCharge || chargeBusy) return;
  const pool = findBenefit('cashback', pendingCharge.poolId);
  const { poolId, amount, note } = pendingCharge;
  if (!pool) { pendingCharge = null; navigate('admin'); return; }
  if (amount > pool.remaining) { pendingCharge = null; showToast('餘額不足', 'error'); navigate('admin-cashback'); return; }

  chargeBusy = true;
  const cd = document.getElementById('tap-countdown');
  if (cd) cd.textContent = '扣款中…';
  const st = await apiCall({ action: 'charge', id: poolId, amount, note });
  chargeBusy = false;

  if (!applyServerState(st)) {
    showToast((st && st.error) || '扣款失敗，請檢查連線', 'error');
    pendingCharge = null;
    navigate('admin-cashback');
    return;
  }
  const updated = findBenefit('cashback', poolId);
  adminState.lastAction = { type: 'charge', amount, poolTitle: pool.title, remaining: updated ? updated.remaining : 0 };
  pendingCharge = null;
  cashbackAmount = '';
  navigate('success');
};

// ── Page: Admin Transactions ──────────────

function renderAdminTransactions(el) {
  el.innerHTML = `
    <div class="admin-page">
      <div class="page-head">
        <div class="admin-header">
          <div class="admin-eyebrow">Transaction History</div>
          <div class="admin-title">全部交易紀錄</div>
        </div>
        <button class="reload-btn" onclick="reloadData(this)" aria-label="重新整理">${icon('refresh')}</button>
      </div>
      <div id="admin-txn-list">
        ${renderAdminTxnList('all')}
      </div>
    </div>
  `;
}

function renderAdminTxnList(filter) {
  const filtered = adminState.transactions.filter(t => txnMatchesFilter(t, filter));
  return `
    <div class="filter-tabs">
      ${TX_FILTERS.map(([f, label]) => `
        <div class="filter-tab ${filter === f ? 'active' : ''}" onclick="setAdminTxnFilter('${f}')">${label}</div>
      `).join('')}
    </div>
    <div class="card">
      ${filtered.length === 0
        ? '<p style="color:var(--text-dim);font-size:14px;text-align:center;padding:20px 0;">尚無此類型交易</p>'
        : filtered.map(t => `
            ${renderTransactionItem(t)}
            <div style="font-size:10px;color:var(--text-dim);padding:0 0 10px 54px;">
              建立者：${t.createdBy === 'admin' ? '管理端' : t.createdBy === 'holder' ? '持卡人' : '系統'}
            </div>
          `).join('')
      }
    </div>
  `;
}

window.setAdminTxnFilter = function(filter) {
  const list = document.getElementById('admin-txn-list');
  if (list) list.innerHTML = renderAdminTxnList(filter);
};

// ── Page: Admin Success ───────────────────

function renderAdminSuccess(el) {
  const a = adminState.lastAction;
  if (!a) { navigate('admin'); return; }

  let iconName, iconClass, title, desc, detail;

  if (a.type === 'topup') {
    iconName = 'savings'; iconClass = 'gold-icon';
    title = '儲值成功';
    desc = `已為 ${adminState.card.holderName} 的「${a.poolTitle}」儲值<br/><strong>NT$ ${a.amount.toLocaleString()}</strong>`;
    detail = `${a.poolTitle}剩餘 NT$ ${a.remaining.toLocaleString()}`;
  } else if (a.type === 'charge') {
    iconName = 'payments'; iconClass = '';
    title = '扣款成功';
    desc = `已從「${a.poolTitle}」扣除 <strong>NT$ ${a.amount.toLocaleString()}</strong><br/>此交易會同步顯示在她的交易紀錄。`;
    detail = `${a.poolTitle}剩餘 NT$ ${a.remaining.toLocaleString()}`;
  } else {
    navigate('admin'); return;
  }

  el.innerHTML = `
    <div class="success-page">
      <div class="success-icon ${iconClass}">${icon(iconName)}</div>
      <div>
        <div class="success-title">${title}</div>
        <div class="success-desc" style="margin-top:8px;">${desc}</div>
        ${detail ? `<div class="success-detail" style="margin-top:8px;">${detail}</div>` : ''}
      </div>
      <div class="success-actions">
        <button class="btn btn-primary" onclick="navigate('admin')">回到 Admin</button>
        <button class="btn btn-secondary" onclick="navigate('admin-transactions')">查看交易紀錄</button>
      </div>
    </div>
  `;
}
