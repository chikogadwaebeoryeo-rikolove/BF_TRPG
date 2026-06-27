(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fallbackCases = [
    {
      id: "001",
      culprit: "의사",
      victim: "보험설계사",
      weapon: "약",
      scene: "병원",
      motive: "보험금",
      story: "보험설계사인 피해자는 병원 VIP 병동의 보험금 지급 문제를 확인하러 왔다가 병실 상담실에서 쓰러진 채 발견된다. 피해자는 담당 의사의 진단서 조작 정황을 확인하고 있었다.",
      clues: ["피해자 가방에서 보험 수익자 변경 신청서와 의사의 진단서 사본이 함께 발견된다.", "병원 전산 처방 기록은 정상처럼 보였지만 사건 이후 12분 뒤 수정된 흔적이 남아 있다.", "피해자 휴대폰에는 환자 가족과 다툰 메시지가 많다."],
      alibi: "의사는 병동 회의실에서 회진 회의를 하고 있었다고 주장하지만, 회의 녹음에는 20분 가까이 발언이 없다.",
      truth: "범인은 의사이다. 처방 기록 수정 시간과 회의 중 공백이 피해자의 추정 시간과 겹치며 알리바이가 무너진다."
    }
  ];
  const profiles = {
    solo: {
      title: "솔로모드",
      subtitle: "1인 수사",
      summary: "혼자 현장, 무기, 용의자 진술을 비교해 범인을 지목합니다.",
      cards: "현장카드 1장, 무기카드 1장, 용의자카드 5장, 질문카드만 사용합니다.",
      players: "1 PLAYER",
      team: "플레이어 vs 사건",
      flow: ["역할 공개", "시작 발언", "질문 선택", "용의자 선택", "범인 지목"],
      limits: ["질문 전 단서는 공개되지 않습니다.", "패 리롤은 게임 전체에서 3번까지 가능합니다.", "마지막 발언 이후에는 질문할 수 없습니다."]
    },
    multi: {
      title: "멀티모드",
      subtitle: "3-15인 방 코드",
      summary: "방 코드로 클라우드 서버에 접속한 플레이어가 경찰, 시민, 마피아 역할로 사건을 진행합니다.",
      cards: "현장카드, 무기카드, 용의자카드, 질문카드, 역할카드를 사용합니다.",
      players: "3-15 PLAYERS",
      team: "경찰·시민 팀 vs 마피아 팀",
      flow: ["방 생성 또는 코드 참여", "3명 이상 게임 시작", "용의자 시작 발언", "질문과 답변", "마지막 발언"],
      limits: ["경찰만 질문카드를 사용합니다.", "패 리롤은 방 전체에서 3번까지 가능합니다.", "선택된 용의자만 답변할 수 있습니다.", "승리 팀은 점수를 얻고 강퇴된 이름은 재입장할 수 없습니다."]
    }
  };
  const questions = [
    "사건 시각 전후 10분 동안 무엇을 했나?",
    "피해자와 마지막으로 마주친 장소는 어디였나?",
    "누가 당신의 알리바이를 증명할 수 있나?",
    "현장의 핵심 흔적을 언제 알았나?",
    "피해자와 숨긴 관계가 있나?",
    "출입구를 지나간 순서를 말하라.",
    "알리바이의 빈 구간은 어디인가?",
    "공개 기록 중 설명하기 어려운 것은 무엇인가?",
    "피해자와 금전 또는 원한 문제가 있었나?",
    "도구나 기록이 원래 있던 위치는 어디인가?"
  ];
  const names = ["오지훈", "김태윤", "정수빈", "송하린", "강도윤", "한유라", "문세진", "백지아", "서민재", "유하늘"];
  const jobs = ["간호사", "기자", "경찰", "회계사", "변호사", "상담원", "경비원", "프로그래머", "연예인", "약사", "교사", "배달원", "알바생", "사업가", "택시기사", "의사", "정치인", "요리사", "유튜버", "은행원", "탐정", "연구원", "건물주", "보험설계사", "담당 변호사", "담당 의사"];
  const roleDefs = {
    경찰: { title: "경찰", image: "../역할카드/경찰.jpg" },
    시민: { title: "시민", image: "../역할카드/시민.jpg" },
    마피아: { title: "마피아", image: "../역할카드/마피아.jpg" }
  };
  const state = { mode: "solo", cases: fallbackCases, roomTimer: null, toastTimer: null, role: null, playerName: "플레이어", roleHold: false };

  function toast(text) {
    $("toast-text").textContent = text;
    $("toast").classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2600);
  }

  async function getJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function loadCases() {
    try {
      const data = await getJson("../Data/cases.json");
      if (Array.isArray(data.cases) && data.cases.length) state.cases = data.cases;
    } catch (error) {
      state.cases = fallbackCases;
    }
  }

  function fillList(node, items, ordered = false) {
    node.replaceChildren();
    items.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      node.appendChild(item);
    });
    node.style.listStyleType = ordered ? "decimal" : "disc";
  }

  function animateCard(node, index = 0, type = "draw") {
    node.classList.remove("card-draw", "card-discard");
    node.style.setProperty("--draw-delay", `${Math.min(index * 58, 360)}ms`);
    void node.offsetWidth;
    node.classList.add(type === "discard" ? "card-discard" : "card-draw");
  }

  function animateCards(nodes, type = "draw") {
    nodes.forEach((node, index) => animateCard(node, index, type));
  }

  function setMode(mode) {
    state.mode = mode;
    const profile = profiles[mode];
    $("btn-solo").classList.toggle("active", mode === "solo");
    $("btn-multi").classList.toggle("active", mode === "multi");
    $("multi-panel").classList.toggle("hidden", mode !== "multi");
    $("mode-title").textContent = profile.title;
    $("mode-subtitle").textContent = profile.subtitle;
    $("mode-summary").textContent = profile.summary;
    $("mode-cards").textContent = profile.cards;
    fillList($("mode-flow"), profile.flow.slice(0, 3));
  }

  function showLobby() {
    clearInterval(state.roomTimer);
    state.roomTimer = null;
    $("lobby-screen").classList.remove("hidden");
    $("session-screen").classList.add("hidden");
    document.body.classList.remove("session-open");
  }

  function showSession(mode) {
    $("lobby-screen").classList.add("hidden");
    $("session-screen").classList.remove("hidden");
    $("solo-game").classList.toggle("hidden", mode !== "solo");
    $("multi-room").classList.toggle("hidden", mode !== "multi");
    $("session-mode").textContent = profiles[mode].title;
    document.body.classList.add("session-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    if (!$$(".modal").some((item) => !item.classList.contains("hidden"))) document.body.classList.remove("modal-open");
  }

  function renderRoleProfile() {
    $("role-profile-name").textContent = state.playerName;
    $("role-profile-label").textContent = "?";
    $("role-profile-image").replaceChildren();
    $("role-profile-image").textContent = "?";
  }

  function setRole(role, name = "플레이어", showNow = false) {
    state.role = roleDefs[role] ? role : null;
    state.playerName = name || "플레이어";
    renderRoleProfile();
    if (showNow && state.role) showRoleModal();
  }

  function showRoleModal() {
    if (!state.role) return;
    const role = roleDefs[state.role];
    $("role-modal-title").textContent = role.title;
    $("role-modal-image").src = role.image;
    $("role-modal-image").alt = role.title;
    openModal($("modal-role"));
  }

  function showHeldRole(event) {
    if (!state.role) return;
    event.preventDefault();
    state.roleHold = true;
    if (event.pointerId !== undefined) $("role-profile").setPointerCapture(event.pointerId);
    showRoleModal();
  }

  function hideHeldRole() {
    if (!state.roleHold) return;
    state.roleHold = false;
    closeModal($("modal-role"));
  }

  function renderRules(mode) {
    const profile = profiles[mode];
    $("rules-title").textContent = `${profile.title} 규칙`;
    $("rules-subtitle").textContent = profile.subtitle;
    $("rules-summary").textContent = profile.summary;
    $("rules-players").textContent = profile.players;
    $("rules-team").textContent = profile.team;
    $("rules-cards").textContent = profile.cards;
    fillList($("rules-flow"), profile.flow, true);
    fillList($("rules-limits"), profile.limits);
    $$("[data-rule-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.ruleTab === mode));
  }

  function initParticles() {
    const canvas = $("particle-canvas");
    const ctx = canvas.getContext("2d");
    const particles = Array.from({ length: 45 }, () => ({ x: 0, y: 0, s: Math.random() * 1.5 + 0.5, vx: Math.random() * 0.2 - 0.1, vy: -(Math.random() * 0.4 + 0.1), a: Math.random() * 0.5 + 0.1 }));
    const resize = () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      particles.forEach((p) => {
        p.x = Math.random() * canvas.width;
        p.y = Math.random() * canvas.height;
      });
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = canvas.height;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = "#c5a880";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    addEventListener("resize", resize);
    resize();
    draw();
  }

  function bindMemo(id) {
    const box = $(id);
    const key = `bf-trpg:${id}`;
    try {
      box.value = localStorage.getItem(key) || "";
      box.addEventListener("input", () => localStorage.setItem(key, box.value));
    } catch (error) {
      box.value = "";
    }
  }

  function bind() {
    bindMemo("case-memo");
    bindMemo("multi-case-memo");
    $("btn-solo").addEventListener("click", () => window.SoloMode.start());
    $("btn-multi").addEventListener("click", () => setMode("multi"));
    $("btn-create-room").addEventListener("click", () => window.MultiMode.createRoom());
    $("join-room-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const code = $("room-code-input").value.trim();
      if (!code) return toast("방 코드를 입력하십시오.");
      window.MultiMode.joinRoom(code);
    });
    $("btn-back-lobby").addEventListener("click", showLobby);
    $("btn-new-case").addEventListener("click", () => state.mode === "solo" ? window.SoloMode.start() : window.MultiMode.refreshRoom());
    $("btn-next-phase").addEventListener("click", () => window.SoloMode.nextPhase());
    $("btn-reroll-hand").addEventListener("click", () => window.SoloMode.rerollHand());
    $("btn-refresh-room").addEventListener("click", () => window.MultiMode.refreshRoom());
    $("btn-start-room").addEventListener("click", () => window.MultiMode.startRoom());
    $("btn-reroll-multi-hand").addEventListener("click", () => window.MultiMode.rerollHand());
    $("btn-submit-weapon").addEventListener("click", () => window.MultiMode.submitWeapon());
    $("multi-talk-form").addEventListener("submit", (event) => {
      event.preventDefault();
      window.MultiMode.submitTalk();
    });
    $("role-profile").addEventListener("click", (event) => event.preventDefault());
    $("role-profile").addEventListener("pointerdown", showHeldRole);
    $("role-profile").addEventListener("pointerup", hideHeldRole);
    $("role-profile").addEventListener("pointercancel", hideHeldRole);
    $("role-profile").addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") showHeldRole(event);
    });
    $("role-profile").addEventListener("keyup", hideHeldRole);
    $("btn-rules").addEventListener("click", () => {
      renderRules(state.mode);
      openModal($("modal-rules"));
    });
    $("btn-dev-logs").addEventListener("click", () => openModal($("modal-dev-logs")));
    $("btn-close-rules").addEventListener("click", () => closeModal($("modal-rules")));
    $("btn-close-modal").addEventListener("click", () => closeModal($("modal-dev-logs")));
    $("btn-close-role").addEventListener("click", () => closeModal($("modal-role")));
    $$(".modal").forEach((modal) => modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    }));
    $$("[data-rule-tab]").forEach((tab) => tab.addEventListener("click", () => renderRules(tab.dataset.ruleTab)));
    addEventListener("keydown", (event) => {
      if (event.key === "Escape") $$(".modal").forEach(closeModal);
    });
  }

  async function init() {
    initParticles();
    setMode("solo");
    setRole(null, "플레이어");
    await loadCases();
    bind();
    setTimeout(() => $("intro-screen").classList.add("hide"), 2100);
    setTimeout(() => $("intro-screen").classList.add("hidden"), 3300);
    const code = new URLSearchParams(location.search).get("room");
    if (code) {
      setMode("multi");
      $("room-code-input").value = code.toUpperCase();
      toast("방 코드를 입력칸에 불러왔습니다.");
    }
  }

  window.App = { $, $$, pick, profiles, questions, names, jobs, roleDefs, state, toast, getJson, fillList, wait, animateCard, animateCards, setMode, showLobby, showSession, setRole, showRoleModal, renderRoleProfile };
  document.addEventListener("DOMContentLoaded", init);
})();
