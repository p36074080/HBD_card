# Girlfriend Black Card — Google Sheet 後端串接指南

把 localStorage 換成 Google Sheet 當資料庫。用 **Google Apps Script** 發佈成 Web App API，前端 `fetch` 讀寫。

---

## 一、設計理念

- **會變動的數字** → 放 Google Sheet（剩餘張數、刷卡金餘額、交易紀錄、持卡人）
- **不會變的目錄資料** → 留在程式 `data.js`（每個權益的圖示、文案、分類、單位）

Sheet 只存「狀態」，前端用 `id` 把 Sheet 的剩餘量合併進 `data.js` 的目錄。Sheet 乾淨、你自己打開也看得懂。

---

## 二、Google Sheet 結構（3 個分頁）

> 第一列都是**標題列**，請照欄位順序建立。`setupSheet()` 會自動幫你建好＋填入預設值（見第四節），所以你也可以不用手動建。

### 分頁 1：`Card`（單列資料）

| holderName | status | activatedAt | displayCardNumber | validThru |
|------------|--------|-------------|-------------------|-----------|
| Ariel | active | 2026-06-15 | 0520 1314 0001 | FOREVER |

### 分頁 2：`Benefits`（所有可兌換項目 + 刷卡金的當前數量）

| id | category | title | total | remaining |
|----|----------|-------|-------|-----------|
| cb_medical | cashback | 美麗升級金 | 3000 | 3000 |
| cb_outfit | cashback | 造型治裝金 | 3000 | 3000 |
| cb_sport | cashback | 健康運動金 | 3000 | 3000 |
| cb_travel | cashback | 旅行加值金 | 3000 | 3000 |
| v_massage | vouchers | 15 分鐘按摩券 | 6 | 6 |
| v_wash | vouchers | 洗頭服務 | 6 | 6 |
| v_dessert | vouchers | 甜品下午茶兌換券 | 6 | 6 |
| v_drink | vouchers | 手搖兌換券 | 12 | 12 |
| v_blowdry | vouchers | 吹頭服務券 | 12 | 12 |
| v_bouquet | vouchers | 花束券 | 2 | 2 |
| v_breakfast | vouchers | 早餐送到床邊券 | 6 | 6 |
| v_soymilk | vouchers | 豆漿兌換券 | 6 | 6 |
| v_bobo | vouchers | 波波飲養品券 | 4 | 4 |
| pr_pickup | privileges | 上下班專屬接送 | 6 | 6 |
| pr_chores | privileges | 一週家事代理 | 6 | 6 |
| pr_aroma | privileges | 專屬芳療體驗 | 2 | 2 |
| pr_intimacy | privileges | 專屬情慾體驗 | 4 | 4 |
| pr_date | privileges | 專屬約會企劃 | 1 | 1 |
| pr_photo | privileges | 專屬拍照企劃 | 4 | 4 |
| tr_cabin | travel | 舒適飛行升艙服務 | 4 | 4 |

> 說明：
> - `total` = 原始發放量、`remaining` = 目前剩餘。前端顯示「剩 remaining / total」。
> - **無限次/常駐型**（登機前咖啡、行李整理、住宿升等、折扣、基本權益）不會變動，**不用放進 Sheet**，留在 `data.js` 即可。
> - 刷卡金（cashback）的 `remaining` 就是金額餘額。

### 分頁 3：`Transactions`（流水帳，只新增不修改）

| id | createdAt | type | title | amount | note | createdBy |
|----|-----------|------|-------|--------|------|-----------|
| t_001 | 2026-06-18 22:00 | topup | 美麗升級金 · 儲值 | 3000 | 開卡禮金 | admin |
| t_002 | 2026-06-18 22:13 | redeem | 兌換 手搖兌換券 | | 剩餘 11 張 | holder |
| t_003 | 2026-06-19 19:30 | charge | 造型治裝金 · 扣款 | -800 | 造型治裝金 | admin |

> `type`：`topup`(儲值) / `charge`(扣款) / `redeem`(兌換)。
> `amount`：只有 topup/charge 有值（兌換留空）。

---

## 三、Apps Script 程式碼（貼到 `Code.gs`）

> 建議做法：直接在這個 Google Sheet 上方選 **擴充功能 → Apps Script**，這樣是「綁定」的指令碼，`SHEET_ID` 可留空。

```javascript
/** Girlfriend Black Card — Google Sheet 後端 (Apps Script) */

const SHEET_ID = '';          // 綁定試算表時留空；否則填你的 Sheet ID
const TZ = 'Asia/Taipei';

function ss_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

/* ───────── Web 進入點 ───────── */
function doGet(e) {
  return json_(getState_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // 避免同時寫入打架
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(handleAction_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ───────── 讀取整包狀態 ───────── */
function getState_() {
  return {
    ok: true,
    card: readCard_(),
    benefits: readBenefits_(),     // { id: {total, remaining} }
    transactions: readTransactions_()
  };
}

function readCard_() {
  const v = ss_().getSheetByName('Card').getRange(2, 1, 1, 5).getValues()[0];
  return {
    holderName: v[0],
    status: v[1],
    activatedAt: v[2] instanceof Date ? fmtDate_(v[2]) : v[2],
    displayCardNumber: v[3],
    validThru: v[4]
  };
}

function readBenefits_() {
  const rows = ss_().getSheetByName('Benefits').getDataRange().getValues();
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][0];
    if (!id) continue;
    out[id] = { total: Number(rows[i][3]) || 0, remaining: Number(rows[i][4]) || 0 };
  }
  return out;
}

function readTransactions_() {
  const rows = ss_().getSheetByName('Transactions').getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      id: rows[i][0],
      createdAt: rows[i][1] instanceof Date ? fmtDateTime_(rows[i][1]) : rows[i][1],
      type: rows[i][2],
      title: rows[i][3],
      amount: rows[i][4] === '' ? null : Number(rows[i][4]),
      note: rows[i][5],
      createdBy: rows[i][6]
    });
  }
  return out.reverse();             // 最新在前
}

/* ───────── 動作分派 ───────── */
function handleAction_(b) {
  switch (b.action) {
    case 'topup':           return doTopup_(b);
    case 'charge':          return doCharge_(b);
    case 'redeem':          return doRedeem_(b);
    case 'setBenefit':      return doSetBenefit_(b);
    case 'restoreBenefit':  return doRestoreBenefit_(b);
    case 'activate':        return doActivate_(b);
    default:                return { ok: false, error: 'unknown action: ' + b.action };
  }
}

function benefitRow_(id) {
  const sh = ss_().getSheetByName('Benefits');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      return { sh, row: i + 1, total: Number(rows[i][3]) || 0, remaining: Number(rows[i][4]) || 0, title: rows[i][2] };
    }
  }
  return null;
}

function writeBenefit_(b, remaining, total) {
  b.sh.getRange(b.row, 5).setValue(remaining);                 // E = remaining
  if (total !== undefined) b.sh.getRange(b.row, 4).setValue(total); // D = total
}

function appendTxn_(t) {
  ss_().getSheetByName('Transactions').appendRow([
    't_' + Date.now(),
    new Date(),
    t.type,
    t.title,
    (t.amount === null || t.amount === undefined) ? '' : t.amount,
    t.note || '',
    t.createdBy || ''
  ]);
}

/* 儲值：刷卡金加值（不需感應） */
function doTopup_(b) {
  const it = benefitRow_(b.id);
  if (!it) return { ok: false, error: 'benefit not found' };
  const amount = Number(b.amount);
  if (!amount || amount <= 0) return { ok: false, error: '金額無效' };
  const remaining = it.remaining + amount;
  writeBenefit_(it, remaining, Math.max(it.total, remaining));
  appendTxn_({ type: 'topup', title: it.title + ' · 儲值', amount: amount, note: b.note || it.title, createdBy: 'admin' });
  return getState_();
}

/* 扣款：刷卡金扣除（前端會先跑感應動畫，感應完成才呼叫這支） */
function doCharge_(b) {
  const it = benefitRow_(b.id);
  if (!it) return { ok: false, error: 'benefit not found' };
  const amount = Number(b.amount);
  if (!amount || amount <= 0) return { ok: false, error: '金額無效' };
  if (amount > it.remaining) return { ok: false, error: '餘額不足' };
  writeBenefit_(it, it.remaining - amount);
  appendTxn_({ type: 'charge', title: it.title + ' · 扣款', amount: -amount, note: b.note || it.title, createdBy: 'admin' });
  return getState_();
}

/* 兌換：票券/禮遇 -1（不記金額） */
function doRedeem_(b) {
  const it = benefitRow_(b.id);
  if (!it) return { ok: false, error: 'benefit not found' };
  if (it.remaining <= 0) return { ok: false, error: '已兌換完' };
  const remaining = it.remaining - 1;
  writeBenefit_(it, remaining);
  const unit = b.unit || '次';
  appendTxn_({ type: 'redeem', title: '兌換 ' + it.title, amount: null, note: '剩餘 ' + remaining + ' ' + unit, createdBy: 'holder' });
  return getState_();
}

/* 管理：直接設定剩餘值 */
function doSetBenefit_(b) {
  const it = benefitRow_(b.id);
  if (!it) return { ok: false, error: 'benefit not found' };
  const remaining = Math.max(0, Math.min(Number(b.remaining), it.total));
  writeBenefit_(it, remaining);
  return getState_();
}

/* 管理：補滿至總額 */
function doRestoreBenefit_(b) {
  const it = benefitRow_(b.id);
  if (!it) return { ok: false, error: 'benefit not found' };
  writeBenefit_(it, it.total);
  return getState_();
}

/* 開卡 */
function doActivate_(b) {
  const sh = ss_().getSheetByName('Card');
  if (b.holderName) sh.getRange(2, 1).setValue(b.holderName);
  sh.getRange(2, 2).setValue('active');
  sh.getRange(2, 3).setValue(new Date());
  return getState_();
}

/* ───────── 工具 ───────── */
function fmtDate_(d)     { return Utilities.formatDate(new Date(d), TZ, 'yyyy-MM-dd'); }
function fmtDateTime_(d) { return Utilities.formatDate(new Date(d), TZ, 'MM/dd HH:mm'); }

/* ───────── 一次性：建立分頁＋填預設值 ─────────
   建好 Sheet 後，在編輯器選這支函式按「執行」一次即可。 */
function setupSheet() {
  const ss = ss_();

  // Card
  let card = ss.getSheetByName('Card') || ss.insertSheet('Card');
  card.clear();
  card.getRange(1, 1, 1, 5).setValues([['holderName', 'status', 'activatedAt', 'displayCardNumber', 'validThru']]);
  card.getRange(2, 1, 1, 5).setValues([['Ariel', 'active', new Date('2026-06-15'), '0520 1314 0001', 'FOREVER']]);

  // Benefits
  let ben = ss.getSheetByName('Benefits') || ss.insertSheet('Benefits');
  ben.clear();
  ben.getRange(1, 1, 1, 5).setValues([['id', 'category', 'title', 'total', 'remaining']]);
  const items = [
    ['cb_medical', 'cashback', '美麗升級金', 3000, 3000],
    ['cb_outfit', 'cashback', '造型治裝金', 3000, 3000],
    ['cb_sport', 'cashback', '健康運動金', 3000, 3000],
    ['cb_travel', 'cashback', '旅行加值金', 3000, 3000],
    ['v_massage', 'vouchers', '15 分鐘按摩券', 6, 6],
    ['v_wash', 'vouchers', '洗頭服務', 6, 6],
    ['v_dessert', 'vouchers', '甜品下午茶兌換券', 6, 6],
    ['v_drink', 'vouchers', '手搖兌換券', 12, 12],
    ['v_blowdry', 'vouchers', '吹頭服務券', 12, 12],
    ['v_bouquet', 'vouchers', '花束券', 2, 2],
    ['v_breakfast', 'vouchers', '早餐送到床邊券', 6, 6],
    ['v_soymilk', 'vouchers', '豆漿兌換券', 6, 6],
    ['v_bobo', 'vouchers', '波波飲養品券', 4, 4],
    ['pr_pickup', 'privileges', '上下班專屬接送', 6, 6],
    ['pr_chores', 'privileges', '一週家事代理', 6, 6],
    ['pr_aroma', 'privileges', '專屬芳療體驗', 2, 2],
    ['pr_intimacy', 'privileges', '專屬情慾體驗', 4, 4],
    ['pr_date', 'privileges', '專屬約會企劃', 1, 1],
    ['pr_photo', 'privileges', '專屬拍照企劃', 4, 4],
    ['tr_cabin', 'travel', '舒適飛行升艙服務', 4, 4]
  ];
  ben.getRange(2, 1, items.length, 5).setValues(items);

  // Transactions
  let tx = ss.getSheetByName('Transactions') || ss.insertSheet('Transactions');
  tx.clear();
  tx.getRange(1, 1, 1, 7).setValues([['id', 'createdAt', 'type', 'title', 'amount', 'note', 'createdBy']]);

  // 刪掉預設空白分頁
  const def = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}
```

---

## 四、部署步驟

1. 建立一個 Google Sheet（名字隨意）。
2. 上方 **擴充功能 → Apps Script**，把上面整段貼進 `Code.gs`，存檔。
3. 在函式下拉選 **`setupSheet`** → 按 **執行**（第一次會要求授權，同意即可）。回 Sheet 確認三個分頁都建好了。
4. 右上 **部署 → 新增部署作業 → 類型選「網頁應用程式」**。
   - 執行身分：**我**
   - 具有存取權的使用者：**所有人**
5. 複製產生的 **`/exec` 網址**（就是 API base URL）。

---

## 五、前端怎麼改（`app.js` / `admin.js`）

目前資料進出都集中在 `loadState()` / `saveState()`。改成打 API 即可，其餘 render 邏輯幾乎不動。**核心觀念：所有寫入動作改成「呼叫 API → 用回傳的最新 state 重繪」**，不要再自己改本地數字。

```javascript
const API = 'https://script.google.com/macros/s/XXXXX/exec';  // 你的 /exec 網址

// 讀取整包狀態
async function fetchState() {
  const res = await fetch(API);
  return res.json();   // { ok, card, benefits:{id:{total,remaining}}, transactions }
}

// 寫入動作（重點：body 用純字串，不要加 Content-Type header，
// 這樣是「simple request」不會觸發 CORS 預檢，Apps Script 才收得到）
async function callApi(payload) {
  const res = await fetch(API, { method: 'POST', body: JSON.stringify(payload) });
  return res.json();   // 回傳更新後的整包 state
}

// 範例：兌換一張票券
async function redeem(id, title, unit) {
  const state = await callApi({ action: 'redeem', id, title, unit });
  applyState(state);   // 把 state 合併進畫面後重繪
}

// 範例：admin 刷卡金扣款（感應動畫完成後呼叫）
async function charge(id, amount, note) {
  const state = await callApi({ action: 'charge', id, amount, note });
  applyState(state);
}
```

### 把 Sheet 的 remaining 合併進 `data.js` 目錄

`data.js` 的 `BENEFITS_DEFAULT` 仍保留圖示/文案/分類；只把 Sheet 的 `remaining/total` 蓋上去：

```javascript
function mergeBenefits(serverBenefits) {
  const cat = cloneBenefits();                 // 程式內的目錄
  Object.keys(cat).forEach(k => {
    cat[k].items.forEach(it => {
      const s = serverBenefits[it.id];
      if (s) { it.remaining = s.remaining; it.total = s.total; }
    });
  });
  return cat;                                   // 再塞進 appState.benefits 重繪
}
```

### 各動作對應的 API call

| 前端操作 | API payload |
|----------|-------------|
| 持卡人兌換票券/禮遇 | `{action:'redeem', id, title, unit}` |
| admin 刷卡金儲值 | `{action:'topup', id, amount, note}` |
| admin 刷卡金扣款（感應後） | `{action:'charge', id, amount, note}` |
| admin 設定剩餘 | `{action:'setBenefit', id, remaining}` |
| admin 補滿 | `{action:'restoreBenefit', id}` |
| 開卡 | `{action:'activate', holderName}` |

---

## 六、NFC 自動刷新（之後可一併解決）

有後端後，真實 NFC 流程可改成：
- 感應 → 預設瀏覽器開 `tap.html` → 打 `redeem` API 完成兌換
- PWA 端在 **回到前景時重新 `fetchState()`** 自動同步：

```javascript
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshFromServer();   // 切回 App 就抓最新
});
```

這樣就能繞過「iOS 獨立 PWA 與 Safari localStorage 隔離」導致無法自動刷新的問題。

---

## 七、注意事項

- Apps Script Web App 有**配額**與**並發寫入**限制（已用 `LockService` 處理打架）。你們一張卡兩個人用，完全夠。
- `/exec` 網址形同密碼，別公開貼到 GitHub。
- 每次改 Apps Script 程式碼後，要**重新部署**（或部署時選「管理部署作業 → 編輯 → 新版本」）才會生效。
- 想保留離線可用，可讓前端：先讀 localStorage 快取顯示 → 背景 `fetchState()` 成功後更新並回寫快取。
```
