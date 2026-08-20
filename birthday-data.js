/* ─────────────────────────────────────────────────────────
   THE H RESERVE · 私人銀行生日 Landing Page
   ── 所有可編輯內容集中在這一個檔案 ──
   要改文案 / 名字 / 里程碑 / 圖片，只需要動這個檔。
   ⚠️ 標了「請替換」的地方是 placeholder，記得換成真的內容。
───────────────────────────────────────────────────────── */

const PRIVATE_BANK = {
  // ── 基本資料 ──
  bankName: "J BANK",
  monogram: "J",                       // 品牌 Monogram（logo 已改用 icons/icon-j 圖）
  girlfriendFirstName: "NING",         // 女友英文名字
  girlfriendFullName: "NING",          // 請替換：女友英文全名（如需要）
  girlfriendChineseName: "Ning",       // 請替換：信件抬頭稱呼
  boyfriendName: "J",                  // 請替換：我的名字
  accountNumber: "000001",
  memberSince: "2026.08.23",           // 請替換：正式日期
  birthdayDate: "2026.08.23",          // 請替換：生日日期
  clientStatus: "FOUNDING MEMBER",
  nfcAppUrl: "https://p36074080.github.io/HBD_card/?card=c_demo_05201314", // NFC 卡片開啟的 App URL（備用連結用）

  // ── SECTION 03：歡迎頁 ──
  welcome: {
    subtitle: "Your private banker is at your service.",
    body: [
      "歡迎成為本行唯一的創始客戶。",
      "從今天開始，妳所擁有的不只是一張卡，",
      "而是一個專門為妳保留的位置。"
    ],
    cardTagline: "Her happiness is our highest priority."
  },

  // ── SECTION 04：私人銀行家生日獻詞 ──
  letter: {
    // 收件人稱謂會自動帶入 girlfriendChineseName
    paragraphs: [
      "歡迎來到妳的三十歲。",
      "我成立這間私人銀行，不是為了記錄妳花了多少，也不是要計算我能替妳做多少。",
      "我只是希望，在未來每一個需要被照顧、需要休息，或只是想任性一下的時刻，妳都知道，有一個人願意替妳保留一份餘裕。",
      "這個帳戶因妳而成立，也只為妳一個人服務。",
      "生日快樂，我唯一的創始客戶。"
    ],
    date: "2026.08.23"                 // 請替換
  },

  // ── SECTION 05：帳戶歷程 ──
  milestonesIntro: [
    "有些帳戶累積的是數字，",
    "而我們累積的是一起經歷過的日子。"
  ],
  milestones: [
    {
      type: "INITIAL DEPOSIT",
      date: "2015.04.11",
      title: "第一次一起過夜",
      description: "那一晚之後，有些東西悄悄地不一樣了。這個帳戶，記下了第一筆存入。",
      image: "images/2015.04.11.JPG"
    },
    {
      type: "ACCOUNT ESTABLISHED",
      date: "2015.05.20",
      title: "正式交往的那一天",
      description: "我們決定不再只是曖昧。從這一天起，帳戶正式以「我們」的名義開立。",
      image: "images/2015.05.20.JPG"
    },
    {
      type: "FIRST SHARED ASSET",
      date: "2016.08.30",
      title: "第一次一起去海邊",
      description: "第一次帶著妳去看海。原來一起看同一片海，本身就是一種資產。",
      image: "images/2016.08.30.JPG"
    },
    {
      type: "ACCOUNTS MERGED",
      date: "2023.02.16",
      title: "開始一起生活",
      description: "把兩個人的日子併進同一個屋簷下。從這天起，帳戶不再分你我。",
      image: "images/2023.02.16.jpg"
    },
    {
      type: "FIRST OVERSEAS HOLDING",
      date: "2023.08.03",
      title: "第一次一起出國旅行",
      description: "第一次牽著妳的手走過另一個國家。我們的版圖，又擴大了一點。",
      image: "images/2023.08.03.jpg"
    },
    {
      type: "30TH BIRTHDAY · SPECIAL ISSUE",
      date: "2026.08.23",
      title: "三十歲生日特別發行",
      description: "今天，妳正式成為本行唯一的創始會員。這張卡為妳的三十歲特別發行，也是下一個階段的開始。",
      // 翻卡：正面微浮動，點一下看背面，3 秒後自動翻回正面
      flip: { front: "images/PB_card_正面.png", back: "images/PB_card_反面.png" }
    }
  ],
  nextMilestone: {
    type: "NEXT MILESTONE",
    title: "TO BE CONTINUED",
    description: "下一筆重要紀錄，等我們一起寫下。"
  },

  // ── SECTION 06：情感資產總覽 ──
  portfolio: {
    togetherSince: "2015-05-20",   // 用來計算「相伴的日子」天數（到瀏覽當下）
    daysStat: { en: "DAYS TOGETHER", label: "相伴的日子", suffix: " 天" },
    // 以「資產配置」進度條呈現（pct 為填滿百分比；display 可覆蓋顯示文字，如 ∞）
    bars: [
      { en: "COMPANIONSHIP", label: "陪伴妳的心意",   pct: 100 },
      { en: "TRUST",         label: "對妳的信任",     pct: 100 },
      { en: "DEVOTION",      label: "想寵妳、照顧妳",  pct: 100 },
      { en: "FUTURE",        label: "對未來的投入",   pct: 100, display: "∞" }
    ],
    mostValuable: {
      en: "Every ordinary day spent together.",
      cn: ["本帳戶最珍貴的資產，", "是我們一起度過的每一個平凡日子。"]
    }
  },

  // ── SECTION 07：專屬禮遇等待啟用 ──
  privilege: {
    body: [
      "妳的私人帳戶已經建立完成。",
      "接下來，還有一項專屬權限等待啟用。"
    ],
    cardImage: "card/c00.png"          // NFC 信用卡示意圖（沿用專案卡面）
  },

  // ── SECTION 08：NFC 感應開卡指引 ──
  nfcSteps: [
    { no: "01", en: "PICK UP YOUR CARD",        cn: "拿起妳專屬的信用卡。" },
    { no: "02", en: "TAP TO ACTIVATE",          cn: "將信用卡背面的 NFC 感應位置，靠近手機上方並停留片刻。" },
    { no: "03", en: "ENTER YOUR PRIVATE WORLD", cn: "感應成功後，系統將開啟專屬 App，完成開卡並啟用妳的私人禮遇。" }
  ],

  // ── SECTION 09：最終行動畫面 ──
  final: {
    body: [
      "妳的專屬信用卡正在等待啟用。",
      "拿起妳專屬的信用卡，",
      "將卡片靠近手機，",
      "進入只屬於妳的私人領域。"
    ]
  }
};

// 讓後續 script（birthday.js、html 內嵌 script）可透過 window 取用
window.PRIVATE_BANK = PRIVATE_BANK;
