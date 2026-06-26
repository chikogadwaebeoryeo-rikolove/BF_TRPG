(() => {
  const solo = { caseInfo: null, suspects: [], phase: 0, used: [], selected: null, log: [] };

  function buildSuspects(gameCase) {
    const { pick, names, jobs } = window.App;
    const pool = jobs.filter((job) => job !== gameCase.culprit);
    const list = [{ name: pick(names), job: gameCase.culprit, culprit: true }];
    while (list.length < 5) {
      const job = pick(pool);
      if (!list.some((suspect) => suspect.job === job)) list.push({ name: pick(names), job, culprit: false });
    }
    return list.sort(() => Math.random() - 0.5);
  }

  function start() {
    const { pick, state, setMode, showSession, toast } = window.App;
    solo.caseInfo = pick(state.cases);
    solo.suspects = buildSuspects(solo.caseInfo);
    solo.phase = 0;
    solo.used = [];
    solo.selected = null;
    solo.log = [];
    setMode("solo");
    showSession("solo");
    render();
    toast("솔로모드를 시작합니다.");
  }

  function render() {
    const { $, fillList } = window.App;
    const gameCase = solo.caseInfo;
    $("session-title").textContent = `사건 경위 ${gameCase.id}`;
    $("case-meta").textContent = `${gameCase.scene} · ${gameCase.weapon} · ${gameCase.motive}`;
    $("case-story").textContent = gameCase.story;
    $("suspect-count").textContent = `${solo.suspects.length}명`;
    $("phase-title").textContent = ["1차 질문", "2차 질문", "마지막 발언", "범인 지목", "결과"][solo.phase] || "수사";
    $("phase-count").textContent = solo.phase < 2 ? `${solo.used.length}/3` : "";
    fillList($("evidence-list"), gameCase.clues.slice(0, 3));
    renderSuspects();
    renderQuestions();
    renderLog();
    renderFinalPick();
  }

  function renderSuspects() {
    const { $ } = window.App;
    $("suspect-list").replaceChildren(...solo.suspects.map((suspect) => {
      const card = document.createElement(solo.selected && solo.phase < 2 ? "button" : "div");
      card.className = "suspect-card";
      card.innerHTML = `<strong>${suspect.name}</strong><span>${suspect.job}</span>`;
      if (solo.selected && solo.phase < 2) card.addEventListener("click", () => answerQuestion(suspect));
      return card;
    }));
  }

  function renderQuestions() {
    const { $, questions } = window.App;
    const box = $("question-list");
    box.replaceChildren();
    $("btn-next-phase").classList.toggle("hidden", solo.phase === 3 || solo.phase === 4);
    $("btn-next-phase").textContent = solo.phase === 2 ? "범인 지목" : "다음 단계";
    if (solo.phase > 1) return;
    questions.slice(solo.phase * 5, solo.phase * 5 + 5).forEach((text, index) => {
      const btn = document.createElement("button");
      const active = solo.selected && solo.selected.index === index;
      btn.className = `question-card ${solo.used.includes(index) ? "used" : ""} ${active ? "selected" : ""}`;
      btn.disabled = solo.used.includes(index);
      btn.innerHTML = `<strong>질문 ${index + 1}</strong><span>${text}</span>`;
      btn.addEventListener("click", () => selectQuestion(index, text));
      box.appendChild(btn);
    });
  }

  function selectQuestion(index, text) {
    const { toast } = window.App;
    if (solo.used.length >= 3) return toast("이번 라운드 질문 3개를 모두 사용했습니다.");
    solo.selected = { index, text };
    toast("답변할 용의자를 선택하십시오.");
    render();
  }

  function answerQuestion(suspect) {
    const { pick } = window.App;
    if (!solo.selected) return;
    const clue = suspect.culprit ? pick(solo.caseInfo.clues) : "자신에게 불리한 부분은 흐리지만 결정적 증거와 직접 연결되지는 않는다.";
    solo.used.push(solo.selected.index);
    solo.log.push(`${suspect.name}(${suspect.job}) 질문: ${solo.selected.text}`);
    solo.log.push(`답변: ${clue}`);
    solo.selected = null;
    render();
  }

  function renderLog() {
    const { $ } = window.App;
    const box = $("case-log");
    const base = solo.selected ? [`선택한 질문: ${solo.selected.text}`, "답변할 용의자를 선택하십시오."] : ["질문카드를 선택한 뒤 용의자를 선택하십시오."];
    const lines = solo.log.length ? solo.log : base;
    box.replaceChildren(...lines.slice(-8).map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
  }

  function nextPhase() {
    const { toast } = window.App;
    if (solo.phase < 2 && solo.used.length < 3) return toast("질문 3개를 사용해야 다음 단계로 넘어갑니다.");
    if (solo.phase === 0) {
      solo.phase = 1;
      solo.used = [];
      solo.selected = null;
      solo.log.push("1차 질문카드 5장은 모두 버려졌습니다.");
    } else if (solo.phase === 1) {
      solo.phase = 2;
      solo.used = [];
      solo.selected = null;
      solo.log.push("2차 질문카드 5장은 모두 버려졌습니다. 이후 질문은 불가능합니다.");
      solo.suspects.forEach((suspect) => solo.log.push(`${suspect.name}: ${suspect.culprit ? solo.caseInfo.alibi : "저는 사건과 직접 관련 없습니다."}`));
    } else if (solo.phase === 2) {
      solo.phase = 3;
    }
    render();
  }

  function renderFinalPick() {
    const { $ } = window.App;
    const box = $("final-pick");
    box.classList.toggle("hidden", solo.phase !== 3 && solo.phase !== 4);
    box.replaceChildren();
    if (solo.phase !== 3) return;
    solo.suspects.forEach((suspect) => {
      const btn = document.createElement("button");
      btn.className = "suspect-card";
      btn.innerHTML = `<strong>${suspect.name}</strong><span>${suspect.job}</span>`;
      btn.addEventListener("click", () => revealResult(suspect));
      box.appendChild(btn);
    });
  }

  function revealResult(suspect) {
    solo.phase = 4;
    solo.log.push(suspect.culprit ? "정답입니다. 수사 성공." : `오답입니다. 실제 범인은 ${solo.caseInfo.culprit}입니다.`);
    solo.log.push(solo.caseInfo.truth);
    render();
  }

  window.SoloMode = { start, nextPhase };
})();
