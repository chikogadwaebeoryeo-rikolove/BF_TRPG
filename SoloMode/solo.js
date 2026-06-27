(() => {
  const solo = { caseInfo: null, suspects: [], phase: 0, used: 0, selected: null, log: [], hand: [], rerolls: 0 };

  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  function drawHand() {
    solo.hand = shuffle(window.App.questions).slice(0, 5);
  }

  function makeAlibi(gameCase, culprit, job) {
    const { pick } = window.App;
    const scene = gameCase.scene || "현장";
    const victim = gameCase.victim || "피해자";
    const weapon = gameCase.weapon || "도구";
    const motive = gameCase.motive || "개인적인 문제";
    const away = pick(["로비", "주차장", "휴게실", "계단 앞", "사무실", "복도 끝", "창고 앞", "출입구 근처"]);
    const witness = pick(["동료", "직원", "손님", "경비 기록", "출입 기록", "결제 기록"]);
    if (culprit) {
      return {
        opening: `저는 사건 시각에 ${scene} 근처를 지나갔습니다. ${victim}와는 잠깐 말했지만 바로 헤어졌고, 그 뒤 몇 분은 혼자 있었습니다.`,
        time: `저는 사건 전후 10분 동안 ${scene} 근처에 있었습니다. 정확히는 잠깐 이동했다고 생각하는데, 그 몇 분은 저를 본 사람이 없습니다.`,
        last: `${victim}와 마지막으로 마주친 곳은 ${scene} 주변입니다. 짧게 이야기했고, 그 뒤에는 서로 다른 방향으로 갔다고 기억합니다.`,
        witness: `제 알리바이를 확실히 증명해 줄 사람은 없습니다. 다만 제가 오래 머문 건 아니니 주변 기록을 보면 어느 정도 확인될 겁니다.`,
        trace: `그 흔적은 나중에 이야기를 듣고 알았습니다. 제가 ${scene} 근처에 있었으니 일부 흔적이 제 동선과 겹칠 수는 있습니다.`,
        relation: `${victim}와 ${motive} 문제로 불편한 대화가 있었던 건 맞습니다. 그래도 사건을 벌일 정도의 관계는 아니었습니다.`,
        route: `저는 ${scene} 쪽 출입구를 지나 복도 쪽으로 나갔다가 다시 방향을 바꿨습니다. 순서는 조금 헷갈립니다.`,
        gap: `빈 구간은 몇 분 정도 있습니다. 그때는 혼자 통화하거나 이동 중이었다고 기억합니다.`,
        record: `기록이 이상하게 보인다면 제가 급하게 움직였기 때문일 겁니다. 정확한 시간까지는 기억하지 못합니다.`,
        motive: `${motive} 문제로 말이 나온 적은 있습니다. 하지만 저는 그 일을 크게 만들 생각이 없었습니다.`,
        object: `${weapon}은 ${scene} 주변에서 봤을 수 있습니다. 제가 마지막으로 만졌는지는 확실히 말하기 어렵습니다.`
      };
    }
    return {
      opening: `저는 사건 시각에 ${scene}이 아니라 ${away}에 있었습니다. ${witness}로 확인할 수 있고, ${victim}와는 그 전에 헤어졌습니다.`,
      time: `저는 사건 전후 10분 동안 ${away}에 있었습니다. ${witness}가 남아 있어서 제 위치를 확인할 수 있습니다.`,
      last: `${victim}를 마지막으로 본 곳은 ${scene} 근처가 아니라 이동 중이던 길목이었습니다. 사건 추정 시각보다 앞선 때였습니다.`,
      witness: `제 알리바이는 ${witness}로 확인할 수 있습니다. 제가 계속 혼자 있었다고 말하는 건 아닙니다.`,
      trace: `현장의 핵심 흔적은 사건이 알려진 뒤에 들었습니다. 그 전에는 ${scene} 안쪽 상황을 몰랐습니다.`,
      relation: `${victim}와는 ${job} 일과 관련해 필요한 말만 했습니다. 숨길 만한 사적인 충돌은 없었습니다.`,
      route: `출입 순서는 ${away}에서 다른 장소로 이동한 흐름입니다. ${scene}에 오래 머물지 않았습니다.`,
      gap: `제 동선에서 비는 시간은 길지 않습니다. 짧은 이동 시간은 있지만 ${witness}와 맞춰 볼 수 있습니다.`,
      record: `공개 기록과 제 말은 크게 다르지 않을 겁니다. 이상한 점이 있다면 제가 아니라 다른 사람의 이동 기록을 봐야 합니다.`,
      motive: `${motive} 문제와 저는 직접 관련이 없습니다. ${victim}와 감정적으로 크게 부딪힌 적도 없습니다.`,
      object: `${weapon}의 위치는 모릅니다. 제 물건도 아니고 제가 다뤘던 물건도 아닙니다.`
    };
  }

  function buildSuspects(gameCase) {
    const { pick, names, jobs } = window.App;
    const namePool = shuffle(names);
    const nextName = () => namePool.shift() || pick(names);
    const culpritJob = jobs.includes(gameCase.culprit) ? gameCase.culprit : pick(jobs);
    const pool = shuffle(jobs.filter((job) => job !== culpritJob));
    const list = [{ name: nextName(), job: culpritJob, culprit: true, alibi: makeAlibi(gameCase, true, culpritJob) }];
    pool.slice(0, 4).forEach((job) => list.push({ name: nextName(), job, culprit: false, alibi: makeAlibi(gameCase, false, job) }));
    return shuffle(list);
  }

  function alibiLine(suspect) {
    return suspect.alibi.opening;
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
      solo.log.push(`${suspect.name}(${suspect.job}) : ${alibiLine(suspect)}`);
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
    return suspect.alibi[questionKind(question)];
  }

  function answerQuestion(suspect) {
    if (!solo.selected) return;
    solo.used += 1;
    solo.log.push(`경찰 : ${solo.selected.text}`);
    solo.log.push(`${suspect.name}(${suspect.job}) : ${directAnswer(suspect, solo.selected.text)}`);
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
    const base = solo.selected ? [`경찰 : ${solo.selected.text}`, "답변할 용의자를 선택하십시오."] : ["질문카드를 선택한 뒤 용의자를 선택하십시오."];
    const lines = solo.log.length ? solo.log : base;
    box.replaceChildren(...lines.map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
  }

  function closingLines() {
    solo.log.push("마지막 발언");
    solo.suspects.forEach((suspect) => {
      solo.log.push(`${suspect.name}(${suspect.job}) : ${closingLine()}`);
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
