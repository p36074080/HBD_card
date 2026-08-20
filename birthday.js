/* ─────────────────────────────────────────────
   THE H RESERVE · birthday.js
   獨立生日 Landing Page 邏輯（vanilla JS，無外部依賴）
   內容全部讀自 birthday-data.js 的 PRIVATE_BANK
───────────────────────────────────────────── */
(function () {
  'use strict';
  const D = window.PRIVATE_BANK;
  const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s);

  /* ── 小型 inline SVG ── */
  const svg = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    card:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>',
    tap:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/><path d="M2.5 9a5 5 0 0 1 0 6M5 7.5a8 8 0 0 1 0 9" opacity="0.7"/></svg>',
    nfc:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a10 10 0 0 1 0 8M9.5 6.5a14 14 0 0 1 0 11M13 5a18 18 0 0 1 0 14M16.5 8a10 10 0 0 1 0 8"/></svg>',
    soundOn:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8a5 5 0 0 1 0 8" opacity="0.8"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="m17 9 4 6M21 9l-4 6"/></svg>'
  };

  const mono = (cls = '') => `<img class="pb-logo ${cls}" src="icons/icon-j-512.png" alt="${esc(D.bankName)}" width="76" height="76" />`;

  // 相片：先顯示優雅 placeholder，成功載入才淡入；載入失敗自動移除 img（不破圖）
  const photo = (src, label) => `
    <div class="pb-photo" data-full="${esc(src)}" tabindex="0" role="button" aria-label="放大查看照片">
      <span class="ph-mono">${esc(D.monogram)}</span>
      ${label ? `<span class="ph-label">${esc(label)}</span>` : ''}
      <img alt="" loading="lazy" src="${esc(src)}"
           onload="this.classList.add('loaded');this.parentNode&&this.parentNode.classList.add('has-img')"
           onerror="this.remove();this.parentNode&&this.parentNode.removeAttribute('data-full')">
    </div>`;

  // 翻卡：正面微浮動，點一下翻到背面，3 秒後自動翻回正面
  const flipCard = (fc) => `
    <div class="pb-flip" tabindex="0" role="button" aria-label="點一下查看卡片背面" onclick="pbFlip(this)"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pbFlip(this);}">
      <div class="pb-flip-inner">
        <div class="pb-flip-face pb-flip-front"><img src="${esc(fc.front)}" alt="卡片正面" loading="lazy"></div>
        <div class="pb-flip-face pb-flip-back"><img src="${esc(fc.back)}" alt="卡片背面" loading="lazy"></div>
      </div>
      <div class="pb-flip-hint"><span class="pb-flip-dot"></span>點一下看背面</div>
    </div>`;

  /* ═══════════ 建構主內容（Section 03–09 + footer）═══════════ */
  function buildMain() {
    const w = D.welcome, l = D.letter, p = D.portfolio, pv = D.privilege, f = D.final;

    const milestonesHtml = D.milestones.map((m) => {
      const media = m.flip
        ? flipCard(m.flip)
        : m.images && m.images.length
          ? `<div class="pb-gallery">${m.images.map((src, i) => photo(src, 'Memory 0' + (i + 1))).join('')}</div>`
          : (m.image ? photo(m.image, m.type) : '');
      return `
        <div class="pb-node reveal">
          <div class="pb-node-type">${esc(m.type)}</div>
          <div class="pb-node-date">${esc(m.date)}</div>
          <div class="pb-node-title pb-serif">${esc(m.title)}</div>
          <div class="pb-node-desc">${esc(m.description)}</div>
          ${media}
        </div>`;
    }).join('');

    const nm = D.nextMilestone;
    const nextHtml = `
      <div class="pb-node pb-next reveal">
        <div class="pb-node-type">${esc(nm.type)}</div>
        <div class="pb-node-title pb-serif">${esc(nm.title)}</div>
        <div class="pb-node-desc">${esc(nm.description)}</div>
      </div>`;

    $('#pb-main').innerHTML = `
      <!-- SECTION 03 · Welcome -->
      <section class="pb-section pb-hero" aria-label="Private banking welcome">
        <div class="reveal">${mono('lg')}</div>
        <h1 class="pb-hero-title reveal d1">WELCOME,<br><em>${esc(D.girlfriendFirstName)}</em></h1>
        <div class="pb-hero-sub reveal d2">${esc(w.subtitle)}</div>
        <div class="pb-hero-body reveal d3">${w.body.map(esc).join('<br>')}</div>

        <div class="pb-account-card reveal d2" id="pb-account-card">
          <div class="pb-ac-top">
            <div class="pb-ac-name">THE ${esc(D.girlfriendFirstName)} ACCOUNT</div>
            <div class="pb-ac-mono">${esc(D.monogram)}</div>
          </div>
          <div class="pb-ac-grid">
            <div><div class="k">Account Holder</div><div class="v">${esc(D.girlfriendFullName)}</div></div>
            <div><div class="k">Account No.</div><div class="v">${esc(D.accountNumber)}</div></div>
            <div><div class="k">Member Since</div><div class="v">${esc(D.memberSince)}</div></div>
            <div><div class="k">Client Status</div><div class="v">${esc(D.clientStatus)}</div></div>
          </div>
          <div class="pb-ac-tagline">${esc(w.cardTagline)}</div>
          <div class="pb-ac-wm">${esc(D.monogram)}</div>
        </div>
      </section>

      <div class="pb-divider-wrap"><hr class="pb-hairline"></div>

      <!-- SECTION 04 · Banker letter -->
      <section class="pb-section" aria-label="A note from your private banker">
        <div class="pb-heading">
          <div class="pb-eyebrow reveal">A NOTE FROM</div>
          <div class="pb-title pb-serif reveal d1">Your Private Banker</div>
        </div>
        <div class="pb-letter reveal d1">
          <div class="pb-letter-greet">親愛的 ${esc(D.girlfriendChineseName)}：</div>
          ${l.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
          <div class="pb-sign">
            <div class="role">Your Private Banker</div>
            <div class="name pb-serif">${esc(D.boyfriendName)}</div>
            <div class="date">${esc(l.date)}</div>
          </div>
        </div>
      </section>

      <div class="pb-divider-wrap"><hr class="pb-hairline"></div>

      <!-- SECTION 05 · Milestones -->
      <section class="pb-section wide" aria-label="Account milestones">
        <div class="pb-heading">
          <div class="pb-eyebrow reveal">ACCOUNT MILESTONES</div>
          <div class="pb-title pb-serif reveal d1">我們的帳戶歷程</div>
          <div class="pb-lead reveal d2">${D.milestonesIntro.map(esc).join('<br>')}</div>
        </div>
        <div class="pb-timeline">${milestonesHtml}${nextHtml}</div>
      </section>

      <div class="pb-divider-wrap"><hr class="pb-hairline"></div>

      <!-- SECTION 06 · Portfolio -->
      <section class="pb-section" aria-label="Portfolio overview">
        <div class="pb-heading">
          <div class="pb-eyebrow reveal">PORTFOLIO OVERVIEW</div>
          <div class="pb-title pb-serif reveal d1">情感資產總覽</div>
        </div>
        <div id="pb-portfolio" data-since="${esc(p.togetherSince || '')}">
          <div class="pb-days-stat reveal">
            <div class="stat-en">${esc(p.daysStat.en)}</div>
            <div class="value" data-type="days" data-suffix="${esc(p.daysStat.suffix || '')}">—</div>
            <div class="stat-label">${esc(p.daysStat.label)}</div>
          </div>
          <div class="pb-bars">
            ${p.bars.map((b, i) => `
              <div class="pb-bar reveal d${(i % 3) + 1}">
                <div class="pb-bar-top">
                  <span class="pb-bar-label">${esc(b.label)}<em>${esc(b.en)}</em></span>
                  <span class="pb-bar-val">${esc(b.display || (b.pct + '%'))}</span>
                </div>
                <div class="pb-bar-track"><div class="pb-bar-fill" data-pct="${Number(b.pct) || 0}"></div></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="pb-most reveal">
          <div class="cap">MOST VALUABLE ASSET</div>
          <div class="en pb-serif">${esc(p.mostValuable.en)}</div>
          <div class="cn">${p.mostValuable.cn.map(esc).join('<br>')}</div>
        </div>
      </section>

      <div class="pb-divider-wrap"><hr class="pb-hairline"></div>

      <!-- SECTION 07 · Privilege ready -->
      <section class="pb-section" aria-label="Private client privileges">
        <div class="pb-heading center" style="align-items:center;">
          <div class="pb-eyebrow reveal">PRIVATE CLIENT PRIVILEGES</div>
          <div class="pb-title pb-serif reveal d1">STATUS · READY FOR ACTIVATION</div>
        </div>
        <div class="pb-lead center reveal d1">${pv.body.map(esc).join('<br>')}</div>
        <div class="pb-nfc-card-wrap reveal d2">
          <div class="pb-ripple" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="pb-nfc-card" style="background-image:url('${esc(pv.cardImage)}')">
            <div class="ph-mono">${esc(D.monogram)}</div>
          </div>
        </div>
        <div class="pb-final-step reveal d2">
          <div class="en">ONE FINAL STEP</div>
          <div class="cn">拿起妳專屬的信用卡。</div>
        </div>
      </section>

      <div class="pb-divider-wrap"><hr class="pb-hairline"></div>

      <!-- SECTION 08 · NFC steps -->
      <section class="pb-section" aria-label="Activation steps">
        <div class="pb-heading" style="align-items:center;">
          <div class="pb-eyebrow reveal">ACTIVATION</div>
          <div class="pb-title pb-serif reveal d1">感應開卡</div>
        </div>

        <!-- 感應動畫示意：卡片靠近手機上方 → NFC 波紋 → App 開啟 -->
        <div class="pb-tap-demo reveal d1" aria-hidden="true">
          <div class="ttd-stage">
            <div class="ttd-phone">
              <span class="ttd-notch"></span>
              <span class="ttd-logo"><img src="icons/icon-j-512.png" alt="" width="42" height="42" /></span>
            </div>
            <div class="ttd-waves"><span></span><span></span><span></span></div>
            <div class="ttd-card" style="background-image:url('${esc(D.privilege.cardImage || 'card/c00.png')}')"></div>
          </div>
        </div>
        <div class="pb-demo-cap reveal d2">將卡片靠近手機上方並停留片刻，<br>手機就會自動開啟妳的專屬 App。</div>

        <div class="pb-steps">
          <div class="pb-steps-eyebrow reveal">三個步驟</div>
          ${D.nfcSteps.map((s, i) => `
            <div class="pb-step reveal d${i + 1}">
              <div class="pb-step-ico">${i === 0 ? svg.card : i === 1 ? svg.tap : svg.nfc}</div>
              <div>
                <div class="pb-step-no">STEP ${esc(s.no)}</div>
                <div class="pb-step-en">${esc(s.en)}</div>
                <div class="pb-step-cn">${esc(s.cn)}</div>
              </div>
            </div>`).join('')}
        </div>
        <div class="pb-hint reveal">
          <div class="row"><span class="dev">iPhone</span><span>將卡片靠近手機頂部。</span></div>
          <div class="row"><span class="dev">Android</span><span>將卡片靠近手機背面中央或上方。</span></div>
        </div>
      </section>

      <!-- SECTION 09 · Final CTA -->
      <section class="pb-final" aria-label="Activate your card">
        <div class="reveal">${mono()}</div>
        <h2 class="pb-final-title reveal d1">YOUR CARD<br>IS WAITING</h2>
        <div class="pb-final-sub reveal d1">Tap the card to your phone to continue.</div>
        <div class="pb-final-body reveal d2">${f.body.map(esc).join('<br>')}</div>
        <div class="pb-final-slogan reveal d2">
          WELCOME TO A WORLD<br>CREATED EXCLUSIVELY FOR YOU.
          <span class="cn">歡迎進入，一個專門為妳而設計的世界。</span>
        </div>

        <div class="pb-cta-actions reveal d3" id="pb-cta-actions">
          <button class="pb-btn" id="pb-activate">
            <span>啟用我的專屬禮遇</span><span class="sub">ACTIVATE MY PRIVILEGES</span>
          </button>
        </div>

        <div class="pb-tap-guide" id="pb-tap-guide" aria-live="polite">
          <div class="pb-tap-anim" aria-hidden="true">
            <span class="wave"></span><span class="wave"></span><span class="wave"></span>
            <div class="phone"></div>
          </div>
          <div class="pb-final-body">將卡片靠近手機上方並停留片刻，<br>手機會自動開啟妳的專屬 App。</div>
          <button class="pb-link" id="pb-fallback">無法感應？點此開啟專屬 App</button>
        </div>
      </section>

      <footer class="pb-footer">
        ${mono()}
        <div class="name">${esc(D.bankName)}</div>
      </footer>
    `;
  }

  /* ═══════════ Scroll reveal ═══════════ */
  function setupReveals() {
    const els = document.querySelectorAll('.reveal');
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      runPortfolio();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));

    // Portfolio 文字跳動：進入視窗時觸發一次
    const pf = $('#pb-portfolio');
    if (pf) {
      const io2 = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { runPortfolio(); io2.disconnect(); }
      }, { threshold: 0.4 });
      io2.observe(pf);
    }
  }

  // 情感資產：「相伴的日子」由 0 數到實際天數；其餘文字（無數/無限/無價）交給淡入
  function runPortfolio() {
    const pf = $('#pb-portfolio');
    if (!pf) return;
    const since = pf.getAttribute('data-since');
    const el = pf.querySelector('.value[data-type="days"]');
    if (!el) return;
    const suffix = el.getAttribute('data-suffix') || '';
    const target = since ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86400000)) : 0;
    if (RM) { el.textContent = target.toLocaleString() + suffix; return; }
    const dur = 1300, start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString() + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    // 資產配置進度條：填滿至各自百分比
    pf.querySelectorAll('.pb-bar-fill').forEach((bar, i) => {
      const pct = Number(bar.getAttribute('data-pct')) || 0;
      if (RM) { bar.style.width = pct + '%'; return; }
      setTimeout(() => { bar.style.width = pct + '%'; }, 200 + i * 130);
    });
  }

  /* ═══════════ 開場音效 welcome.wav（預設開啟；瀏覽器擋自動播放時，改於首次互動播放）═══════════ */
  let muted = false;
  let welcomeAudio = null;
  let welcomeStarted = false;

  function getWelcome() {
    if (!welcomeAudio) {
      welcomeAudio = new Audio('welcome.wav');
      welcomeAudio.preload = 'auto';
      welcomeAudio.volume = 0.7;
      welcomeAudio.addEventListener('playing', () => { welcomeStarted = true; });
    }
    return welcomeAudio;
  }
  function playWelcome() {
    if (muted) return;
    const p = getWelcome().play();
    if (p && p.catch) p.catch(() => {});   // 被瀏覽器擋下不報錯，等手勢補播
  }
  // 首次互動（點任何地方 / 按鍵）補播一次，處理自動播放限制
  function armWelcomeOnGesture() {
    const evs = ['pointerdown', 'touchstart', 'click', 'keydown'];
    const h = () => {
      evs.forEach((ev) => document.removeEventListener(ev, h, true));
      if (!welcomeStarted && !muted) playWelcome();
    };
    evs.forEach((ev) => document.addEventListener(ev, h, true));
  }
  function setupSound() {
    const btn = $('#pb-sound');
    if (!btn || btn.dataset.ready) return;
    btn.dataset.ready = '1';
    btn.classList.add('show');
    btn.innerHTML = muted ? svg.soundOff : svg.soundOn;
    btn.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效');
    btn.addEventListener('click', () => {
      muted = !muted;
      btn.innerHTML = muted ? svg.soundOff : svg.soundOn;
      btn.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效');
      if (muted) { if (welcomeAudio) welcomeAudio.pause(); }
      else { playWelcome(); }
    });
  }

  /* ═══════════ 開場：Section 01 + 02 ═══════════ */
  const overlay = $('#pb-overlay');
  const timers = [];
  let pctInterval = null;
  const after = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers.length = 0; if (pctInterval) { clearInterval(pctInterval); pctInterval = null; } };

  function showStage(id) {
    document.querySelectorAll('.pb-stage').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  function runLoader() {
    showStage('pb-stage-verify');
    const pct = $('#pb-pct');
    if (pct && !RM) {
      let v = 0;
      pctInterval = setInterval(() => { v = Math.min(100, v + Math.round(3 + Math.random() * 7)); pct.textContent = v + '%'; if (v >= 100 && pctInterval) { clearInterval(pctInterval); pctInterval = null; } }, 90);
    } else if (pct) { pct.textContent = '100%'; }

    const dur = RM ? 300 : 1700;
    after(() => {
      showStage('pb-stage-verified');
      after(goIntro, RM ? 300 : 1000);
    }, dur);
  }

  function goIntro() {
    clearTimers();
    sessionStorage.setItem('pb_seen', '1');
    showStage('pb-stage-intro');
    const seq = $('#pb-intro-seq');
    if (!seq) return;
    if (RM) { seq.querySelectorAll('*').forEach((n) => { n.style.opacity = 1; n.style.transform = 'none'; }); return; }
    // 逐段淡入
    const kids = Array.from(seq.children);
    kids.forEach((n, i) => { n.style.animationDelay = (0.15 + i * 0.4) + 's'; });
    seq.classList.add('run');
  }

  function enterBanking() {
    clearTimers();
    overlay.classList.add('hide');
    document.body.classList.remove('pb-lock');
    $('#pb-main').classList.add('show');
    setupReveals();
    setupSound();
    after(() => { overlay.style.display = 'none'; }, 750);
    // 焦點移到主內容，利於鍵盤/輔助工具
    const h = $('#pb-main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ═══════════ 最終 CTA 行為 ═══════════ */
  function activatePrivileges() {
    const guide = $('#pb-tap-guide');
    const actions = $('#pb-cta-actions');
    guide.classList.add('show');
    if (actions) actions.style.display = 'none';
    if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) {} }
    guide.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  }

  /* ═══════════ 翻卡（正 → 背 → 3 秒回正）═══════════ */
  window.pbFlip = function (el) {
    const hint = el.querySelector('.pb-flip-hint');
    if (el.classList.contains('flipped')) {          // 已在背面 → 立刻翻回正面
      el.classList.remove('flipped');
      if (hint) hint.innerHTML = '<span class="pb-flip-dot"></span>點一下看背面';
      if (el._flipTimer) { clearTimeout(el._flipTimer); el._flipTimer = null; }
      return;
    }
    el.classList.add('flipped');
    if (el._flipTimer) clearTimeout(el._flipTimer);
    el._flipTimer = setTimeout(() => {
      el.classList.remove('flipped');
      el._flipTimer = null;
    }, 3000);
  };

  /* ═══════════ Lightbox ═══════════ */
  function setupLightbox() {
    const lb = $('#pb-lightbox'), img = $('#pb-lightbox img');
    const open = (src) => { img.src = src; lb.classList.add('show'); document.body.classList.add('pb-lock'); };
    const close = () => { lb.classList.remove('show'); document.body.classList.remove('pb-lock'); img.src = ''; };
    document.addEventListener('click', (e) => {
      const ph = e.target.closest('.pb-photo');
      if (ph && ph.getAttribute('data-full') && ph.querySelector('img.loaded')) open(ph.getAttribute('data-full'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lb.classList.contains('show')) close();
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList.contains('pb-photo')) {
        const ph = document.activeElement;
        if (ph.getAttribute('data-full') && ph.querySelector('img.loaded')) { e.preventDefault(); open(ph.getAttribute('data-full')); }
      }
    });
    $('#pb-lightbox .close').addEventListener('click', close);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  }

  /* ═══════════ Init ═══════════ */
  function init() {
    if (!D) { console.warn('PRIVATE_BANK data missing'); return; }
    buildMain();
    setupLightbox();

    $('#pb-enter').addEventListener('click', enterBanking);
    document.querySelectorAll('.pb-skip').forEach((b) => b.addEventListener('click', goIntro));
    $('#pb-activate').addEventListener('click', activatePrivileges);
    const fb = $('#pb-fallback');
    if (D.nfcAppUrl) { fb.addEventListener('click', () => { window.location.href = D.nfcAppUrl; }); }
    else { fb.style.display = 'none'; }

    document.body.classList.add('pb-lock');

    // 開場音效：一進頁面就播 welcome.wav（動畫進行中）；被瀏覽器擋下就等首次互動補播
    setupSound();
    playWelcome();
    armWelcomeOnGesture();

    // 同一次瀏覽階段已看過 → 縮短，直接進帳戶啟用動畫
    if (sessionStorage.getItem('pb_seen')) { goIntro(); }
    else { runLoader(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
