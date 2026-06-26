(() => {
  const solo = { caseInfo: null, suspects: [], phase: 0, used: 0, selected: null, log: [], hand: [], discovered: [] };

  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  function drawHand() {
    solo.hand = shuffle(window.App.questions).slice(0, 5);
  }

  function buildSuspects(gameCase) {
    const { pick, names, jobs } = window.App;
    const pool = jobs.filter((job) => job !== gameCase.culprit);
    const list = [{ name: pick(names), job: gameCase.culprit, culprit: true }];
    while (list.length < 5) {
      const job = pick(pool);
      if (!list.some((suspect) => suspect.job === job)) list.push({ name: pick(names), job, culprit: false });
    }
    return shuffle(list);
  }

  function openingLines() {
    solo.log.push("시작 발언");
    solo.suspects.forEach((suspect) => {
      const line = suspect.culprit ? "피해자와 업무상으로만 마주쳤고 특별한 일은 없었습니다." : "사건 당시 제 동선은 곧 설명할 수 있습니다.";
      solo.log.push(`${suspect.name}(${suspect.job}): ${line}`);
    });
  }

  function start() {
    const { pick, state, setMode, showSession, setRole, toast } = window.App;
    solo.caseInfo = pick(state.cases);
    solo.suspects = buildSuspects(solo.caseInfo);
    solo.phase = 0;
    solo.used = 0;
    solo.selected = null;
    solo.log = [];
    solo.discovered = [];
    drawHand();
    openingLines();
    setMode("solo");
    setRole("경찰", "플레이어", true);
    showSession("solo");
    render();
    toast("솔로모드를 시작합니다.");
  }

  function render() {
    const { $, fillList } = window.App;
    const gameCase = solo.caseInfo;
    $("session-title").textContent = `사건 경위 ${gameCase.id}`;
    $("case-meta").textContent = "초기 공개 정보";
    $("case-victim").textContent = `피해자: ${gameCase.victim || "미상"}`;
    $("case-weapon").textContent = gameCase.weapon || "미상";
    $("case-scene").textContent = gameCase.scene || "미상";
    $("suspect-count").textContent = `${solo.suspects.length}명`;
    $("phase-title").textContent = ["1차 질문", "2차 질문", "마지막 발언", "범인 지목", "결과"][solo.phase] || "수사";
    $("phase-count").textContent = solo.phase < 2 ? `${solo.used}/3` : "";
    $("evidence-count").textContent = `${solo.discovered.length}장`;
    fillList($("evidence-list"), solo.discovered.length ? solo.discovered : ["아직 발견된 단서가 없습니다."]);
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
    const { $ } = window.App;
    const box = $("question-list");
    box.replaceChildren();
    $("btn-reroll-hand").classList.toggle("hidden", solo.phase > 1);
    $("btn-reroll-hand").disabled = solo.phase > 1 || solo.used >= 3;
    $("btn-next-phase").classList.toggle("hidden", solo.phase === 3 || solo.phase === 4);
    $("btn-next-phase").textContent = solo.phase === 2 ? "범인 지목" : "다음 단계";
    if (solo.phase > 1) return;
    solo.hand.forEach((text, index) => {
      const btn = document.createElement("button");
      const active = solo.selected && solo.selected.text === text;
      btn.className = `question-card ${active ? "selected" : ""}`;
      btn.disabled = solo.used >= 3;
      btn.innerHTML = `<strong>질문 ${index + 1}</strong><span>${text}</span>`;
      btn.addEventListener("click", () => selectQuestion(index, text));
      box.appendChild(btn);
    });
  }

  function selectQuestion(index, text) {
    const { toast } = window.App;
    if (solo.used >= 3) return toast("이번 라운드 질문 3개를 모두 사용했습니다.");
    solo.selected = { index, text };
    toast("답변할 용의자를 선택하십시오.");
    render();
  }

  function nextClue() {
    const clues = solo.caseInfo.clues || [];
    const clue = clues.find((item) => !solo.discovered.includes(item));
    if (clue) solo.discovered.push(clue);
    return clue || "새 단서는 나오지 않았지만 진술의 모순이 기록되었습니다.";
  }

  function answerQuestion(suspect) {
    if (!solo.selected) return;
    const clue = nextClue();
    solo.used += 1;
    solo.log.push(`${suspect.name}(${suspect.job}) 질문: ${solo.selected.text}`);
    solo.log.push(`답변: ${clue}`);
    solo.hand.splice(solo.selected.index, 1);
    solo.selected = null;
    render();
  }

  function rerollHand() {
    const { toast } = window.App;
    if (solo.phase > 1) return;
    if (solo.used >= 3) return toast("패 3개를 모두 사용해 리롤할 수 없습니다.");
    solo.selected = null;
    drawHand();
    solo.log.push("질문 패를 리롤했습니다.");
    render();
  }

  function renderLog() {
    const { $ } = window.App;
    const box = $("case-log");
    const base = solo.selected ? [`선택한 질문: ${solo.selected.text}`, "답변할 용의자를 선택하십시오."] : ["질문카드를 선택한 뒤 용의자를 선택하십시오."];
    const lines = solo.log.length ? solo.log : base;
    box.replaceChildren(...lines.slice(-10).map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
  }

  function closingLines() {
    solo.log.push("마지막 발언");
    solo.suspects.forEach((suspect) => {
      const line = suspect.culprit ? solo.caseInfo.alibi : "제 진술은 앞선 답변과 같습니다.";
      solo.log.push(`${suspect.name}: ${line}`);
    });
  }

  function nextPhase() {
    const { toast } = window.App;
    if (solo.phase < 2 && solo.used < 3) return toast("질문 3개를 사용해야 다음 단계로 넘어갑니다.");
    if (solo.phase === 0) {
      solo.phase = 1;
      solo.used = 0;
      solo.selected = null;
      drawHand();
      solo.log.push("2차 질문을 시작합니다.");
    } else if (solo.phase === 1) {
      solo.phase = 2;
      solo.used = 0;
      solo.selected = null;
      closingLines();
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

  window.SoloMode = { start, nextPhase, rerollHand };
})();
