(() => {
  const solo = { caseInfo: null, suspects: [], phase: 0, used: 0, selected: null, log: [], hand: [], clueIndex: 0 };

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

  function neutralLine() {
    return window.App.pick([
      "사건 전후로 평소 일정에서 크게 벗어난 일은 없었습니다.",
      "피해자와는 필요한 말만 나눴고 특별히 다툰 기억은 없습니다.",
      "제 위치는 다른 사람들과 기록을 맞춰 보면 확인될 겁니다.",
      "그 시간대에는 주변이 어수선해서 세부 순서는 다시 확인해야 합니다.",
      "제가 본 것은 많지 않지만 질문을 받으면 아는 만큼 말하겠습니다.",
      "피해자를 마지막으로 본 시점은 정확히 정리해서 말씀드리겠습니다.",
      "현장 근처에 있던 이유는 제 업무와 관련된 일이었습니다.",
      "특별히 숨길 일은 없고, 기억나는 범위에서 답하겠습니다."
    ]);
  }

  function closingLine() {
    return window.App.pick([
      "제가 말한 내용은 앞선 답변과 크게 다르지 않습니다.",
      "의심받는 건 이해하지만, 제 기억은 처음부터 일관됩니다.",
      "빠뜨린 부분이 있다면 기록을 보고 다시 확인해야 합니다.",
      "저도 사건이 왜 그렇게 흘러갔는지 명확히 알고 싶습니다.",
      "제 동선은 설명했고, 더 덧붙일 말은 많지 않습니다.",
      "질문받은 부분 외에는 특별히 말할 내용이 없습니다."
    ]);
  }

  function openingLines() {
    solo.log.push("시작 발언");
    solo.suspects.forEach((suspect) => {
      solo.log.push(`${suspect.name}(${suspect.job}): ${neutralLine()}`);
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
    solo.clueIndex = 0;
    drawHand();
    openingLines();
    setMode("solo");
    setRole("경찰", "플레이어", true);
    showSession("solo");
    render();
    toast("솔로모드를 시작합니다.");
  }

  function render() {
    const { $ } = window.App;
    const gameCase = solo.caseInfo;
    $("session-title").textContent = `사건 경위 ${gameCase.id}`;
    $("case-meta").textContent = "초기 공개 정보";
    $("case-victim").textContent = `피해자: ${gameCase.victim || "미상"}`;
    $("case-weapon").textContent = gameCase.weapon || "미상";
    $("case-scene").textContent = gameCase.scene || "미상";
    $("suspect-count").textContent = `${solo.suspects.length}명`;
    $("phase-title").textContent = ["1차 질문", "2차 질문", "마지막 발언", "범인 지목", "결과"][solo.phase] || "수사";
    $("phase-count").textContent = solo.phase < 2 ? `${solo.used}/3` : "";
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
    const clue = clues[solo.clueIndex % Math.max(clues.length, 1)];
    solo.clueIndex += 1;
    return clue || "";
  }

  function clueTopic(clue) {
    const value = String(clue || "");
    if (/CCTV|카메라|영상|녹화|사진/.test(value)) return "기록된 장면";
    if (/휴대폰|메시지|통화|녹음|채팅/.test(value)) return "연락 기록";
    if (/서버|로그|전산|파일|클라우드|백업/.test(value)) return "남은 기록";
    if (/결제|주문|계좌|영수증|돈|금전/.test(value)) return "돈의 흐름";
    if (/출입|카드|도어락|차량|GPS|동선/.test(value)) return "이동 경로";
    if (/가방|지문|섬유|흔적|자국|물건/.test(value)) return "현장 흔적";
    return "확인해야 할 부분";
  }

  function indirectAnswer(suspect, clue) {
    const topic = clueTopic(clue);
    return window.App.pick(suspect.culprit ? [
      `${topic}만으로 단정하기는 어렵습니다. 저는 평소와 크게 다르지 않았습니다.`,
      `그 부분은 오해가 섞였을 수 있습니다. 지금 말할 수 있는 건 제 동선뿐입니다.`,
      `${topic}을 다시 보면 다른 해석도 가능할 겁니다. 제가 먼저 설명할 일은 아닙니다.`,
      `기억이 선명하지 않습니다. 다만 사건과 직접 엮일 만한 행동은 없었습니다.`
    ] : [
      `${topic}을 확인하면 제 말과 크게 어긋나지는 않을 겁니다.`,
      `제가 본 건 제한적입니다. 그 부분은 기록을 맞춰 보는 게 낫습니다.`,
      `그 시간대는 평소처럼 움직였습니다. 특별히 숨길 일은 없습니다.`,
      `${topic} 쪽은 제가 단정할 수 없지만, 제 설명은 처음과 같습니다.`
    ]);
  }

  function answerQuestion(suspect) {
    if (!solo.selected) return;
    const clue = nextClue();
    solo.used += 1;
    solo.log.push(`${suspect.name}(${suspect.job}) 질문: ${solo.selected.text}`);
    solo.log.push(`${suspect.name} 답변: ${indirectAnswer(suspect, clue)}`);
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
      solo.log.push(`${suspect.name}: ${closingLine()}`);
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
