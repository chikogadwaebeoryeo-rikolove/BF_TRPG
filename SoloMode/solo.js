(() => {
  const solo = { caseInfo: null, suspects: [], phase: 0, used: 0, selected: null, log: [], hand: [], rerolls: 0 };

  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  function drawHand() {
    solo.hand = shuffle(window.App.questions).slice(0, 5);
  }

  function buildSuspects(gameCase) {
    const { pick, names, jobs } = window.App;
    const namePool = shuffle(names);
    const nextName = () => namePool.shift() || pick(names);
    const culpritJob = jobs.includes(gameCase.culprit) ? gameCase.culprit : pick(jobs);
    const pool = jobs.filter((job) => job !== culpritJob);
    const list = [{ name: nextName(), job: culpritJob, culprit: true }];
    while (list.length < 5) {
      const job = pick(pool);
      if (!list.some((suspect) => suspect.job === job)) list.push({ name: nextName(), job, culprit: false });
    }
    return shuffle(list);
  }

  function alibiLine(suspect) {
    const scene = solo.caseInfo.scene || "현장";
    const victim = solo.caseInfo.victim || "피해자";
    return suspect.culprit ? window.App.pick([
      `사건 시각에는 ${scene} 근처에 잠깐 있었지만 ${victim}와 직접 마주치지는 않았다고 주장합니다. 확인자는 뚜렷하지 않습니다.`,
      `${scene} 주변을 지나간 일은 인정하지만 사건 시각에는 개인 용무를 보고 있었다고 말합니다. 시간 설명이 조금 비어 있습니다.`,
      `${victim}와는 사건 전에 짧게 만났을 뿐이라며, 이후 동선은 기록으로 확인될 것이라고 주장합니다.`
    ]) : window.App.pick([
      `사건 시각에는 ${scene}과 떨어진 곳에서 ${suspect.job} 관련 일을 하고 있었다고 말합니다. 확인 가능한 사람이 있다고 덧붙입니다.`,
      `${victim}를 마지막으로 본 뒤 곧바로 자기 일로 돌아갔다고 합니다. 사건 추정 시간에는 다른 장소에 있었다고 주장합니다.`,
      `사건 전후 동선은 비교적 단순하며 ${scene}에 머문 시간은 짧았다고 말합니다. 주변 기록으로 확인 가능하다고 합니다.`
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
    solo.log.push("시작 알리바이");
    solo.suspects.forEach((suspect) => {
      solo.log.push(`${suspect.name}(${suspect.job}) 알리바이: ${alibiLine(suspect)}`);
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
    solo.rerolls = 0;
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
    $("btn-reroll-hand").textContent = `패 리롤 (${solo.rerolls}/3)`;
    $("btn-reroll-hand").disabled = solo.phase > 1 || solo.used >= 3 || solo.rerolls >= 3;
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

  function questionKind(question) {
    if (/전후|10분|무엇을 했/.test(question)) return "time";
    if (/마지막|마주친|장소/.test(question)) return "last";
    if (/알리바이|증명/.test(question)) return "witness";
    if (/핵심 흔적|언제 알았/.test(question)) return "trace";
    if (/숨긴 관계|관계/.test(question)) return "relation";
    if (/출입구|순서/.test(question)) return "route";
    if (/빈 구간/.test(question)) return "gap";
    if (/공개 기록|설명하기 어려운/.test(question)) return "record";
    if (/금전|원한|문제/.test(question)) return "motive";
    if (/도구|위치/.test(question)) return "object";
    return "time";
  }

  function directAnswer(suspect, question) {
    const kind = questionKind(question);
    const scene = solo.caseInfo.scene || "현장";
    const victim = solo.caseInfo.victim || "피해자";
    const weapon = solo.caseInfo.weapon || "도구";
    const motive = solo.caseInfo.motive || "개인적인 문제";
    const culprit = {
      time: `사건 전후 10분에는 ${scene} 근처를 지나갔다고 말합니다. 다만 정확히 어디에 몇 분 있었는지는 흐리게 답합니다.`,
      last: `${victim}를 사건 전에 ${scene} 주변에서 봤다고 인정합니다. 이후에는 각자 움직였다고 주장합니다.`,
      witness: "알리바이를 확실히 증명할 사람은 없고, 기록을 보면 된다고만 말합니다.",
      trace: "현장 흔적은 업무나 우연한 접촉으로 남았을 수 있다고 말하지만, 언제 알았는지는 바로 답하지 못합니다.",
      relation: `${victim}와 불편한 일이 있었던 건 맞지만 사건으로 이어질 정도는 아니었다고 말합니다.`,
      route: `출입 순서는 ${scene}에 먼저 들렀다가 잠깐 자리를 비웠다는 식으로 말합니다. 순서가 앞선 알리바이와 조금 어긋납니다.`,
      gap: "짧은 빈 구간은 개인적인 통화나 이동 때문이었다고 말합니다. 그 시간만 확인자가 없습니다.",
      record: "기록이 어긋난다면 착오나 시스템 문제일 거라고 말합니다. 구체적인 반박은 하지 못합니다.",
      motive: `${motive} 이야기는 과장됐다고 말합니다. 하지만 그 문제로 ${victim}와 말다툼이 있었던 점은 부정하지 않습니다.`,
      object: `${weapon}의 위치는 원래 그 주변에 있었을 것이라고 말합니다. 자신이 마지막으로 만진 시점은 분명히 말하지 못합니다.`
    };
    const clear = {
      time: `사건 전후 10분에는 ${scene}과 떨어진 곳에 있었다고 답합니다. 이동 시간이 맞지 않아 바로 현장에 오기 어렵다고 말합니다.`,
      last: `${victim}를 마지막으로 본 건 사건보다 앞선 시점이라고 답합니다. 이후에는 다른 사람과 함께 있었다고 말합니다.`,
      witness: "같이 있던 사람이나 남은 기록으로 알리바이를 확인할 수 있다고 답합니다.",
      trace: "현장 흔적에 대해서는 직접 본 것이 없다고 답합니다. 알게 된 건 사건이 알려진 뒤라고 말합니다.",
      relation: `${victim}와는 업무상 또는 일상적인 관계였고 숨길 만한 충돌은 없었다고 답합니다.`,
      route: `출입 순서는 단순했다고 답합니다. ${scene}에 오래 머문 적은 없고 바로 다른 곳으로 이동했다고 말합니다.`,
      gap: "동선의 빈 구간은 거의 없고, 잠깐 비는 시간도 주변 기록으로 맞출 수 있다고 답합니다.",
      record: "공개 기록과 자신의 진술이 크게 다르지 않다고 답합니다. 이상한 점이 있다면 다른 사람 기록을 봐야 한다고 말합니다.",
      motive: `${motive} 문제와 직접 관련된 적은 없다고 답합니다. ${victim}와 감정적으로 크게 부딪힌 일도 없었다고 합니다.`,
      object: `${weapon}의 위치나 사용 여부는 모른다고 답합니다. 자신이 다루던 물건과는 다르다고 말합니다.`
    };
    return (suspect.culprit ? culprit : clear)[kind];
  }

  function answerQuestion(suspect) {
    if (!solo.selected) return;
    solo.used += 1;
    solo.log.push(`${suspect.name}(${suspect.job}) 질문: ${solo.selected.text}`);
    solo.log.push(`${suspect.name} 답변: ${directAnswer(suspect, solo.selected.text)}`);
    solo.hand.splice(solo.selected.index, 1);
    solo.selected = null;
    render();
  }

  function rerollHand() {
    const { toast } = window.App;
    if (solo.phase > 1) return;
    if (solo.used >= 3) return toast("패 3개를 모두 사용해 리롤할 수 없습니다.");
    if (solo.rerolls >= 3) return toast("패 리롤은 게임 전체에서 3번까지만 가능합니다.");
    solo.selected = null;
    solo.rerolls += 1;
    drawHand();
    solo.log.push(`질문 패를 리롤했습니다. (${solo.rerolls}/3)`);
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
    const answer = solo.suspects.find((item) => item.culprit);
    solo.phase = 4;
    solo.log.push(suspect.culprit ? "정답입니다. 수사 성공." : `오답입니다. 실제 범인은 ${answer.name}(${answer.job})입니다.`);
    solo.log.push(solo.caseInfo.truth);
    render();
  }

  window.SoloMode = { start, nextPhase, rerollHand };
})();
