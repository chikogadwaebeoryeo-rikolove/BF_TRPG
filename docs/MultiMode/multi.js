(() => {
  const multi = { room: null, selectedQuestion: null, currentName: "플레이어" };

  function serverBase() {
    return String(window.BF_TRPG_MULTI_SERVER || "").trim().replace(/\/$/, "");
  }

  async function api(path, body) {
    const base = serverBase();
    if (!base) throw new Error("server_url_required");
    const options = body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    } : { method: "GET" };
    const res = await fetch(`${base}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || String(res.status));
    return data;
  }

  function playerName() {
    const { $ } = window.App;
    multi.currentName = $("player-name-input").value.trim() || "플레이어";
    return multi.currentName;
  }

  async function createRoom() {
    const { pick, state, setMode, toast } = window.App;
    setMode("multi");
    playerName();
    try {
      multi.room = await api("/api/rooms/create", { name: multi.currentName, case: pick(state.cases) });
      openRoom();
      toast(`방 코드 ${multi.room.code}`);
    } catch (error) {
      toast(error.message === "server_url_required" ? "멀티 서버 URL을 설정해야 합니다." : "방을 만들지 못했습니다.");
    }
  }

  async function joinRoom(code) {
    const { setMode, toast } = window.App;
    setMode("multi");
    playerName();
    try {
      multi.room = await api("/api/rooms/join", { code, name: multi.currentName });
      openRoom();
      toast(`${multi.room.code} 방에 참여했습니다.`);
    } catch (error) {
      toast(error.message === "server_url_required" ? "멀티 서버 URL을 설정해야 합니다." : "방에 참여하지 못했습니다.");
    }
  }

  function openRoom() {
    const { state, showSession } = window.App;
    showSession("multi");
    renderRoom();
    clearInterval(state.roomTimer);
    state.roomTimer = setInterval(refreshRoom, 2500);
  }

  async function refreshRoom() {
    const { toast } = window.App;
    if (!multi.room) return;
    try {
      multi.room = await api(`/api/rooms/state?code=${encodeURIComponent(multi.room.code)}`);
      renderRoom();
    } catch (error) {
      toast("방 상태를 갱신하지 못했습니다.");
    }
  }

  function isHost() {
    return Boolean(multi.room && multi.room.players.some((p) => p.name === multi.currentName && p.host));
  }

  function suspects() {
    if (!multi.room) return [];
    const list = multi.room.players.filter((p) => !p.host);
    return list.length ? list : multi.room.players;
  }

  function renderRoom() {
    const { $, fillList, pick, state } = window.App;
    const room = multi.room;
    if (!room) return;
    const gameCase = room.case || pick(state.cases);
    const share = `${location.origin}${location.pathname}?room=${room.code}`;
    $("session-title").textContent = "멀티모드 대기방";
    $("room-code-label").textContent = room.code;
    $("room-share-text").textContent = "다른 플레이어는 이 링크로 접속한 뒤 방 코드를 입력합니다.";
    $("room-url").textContent = share;
    $("room-player-count").textContent = `${room.players.length}/15`;
    fillList($("room-player-list"), room.players.map((p) => `${p.name}${p.host ? " · 경찰" : " · 용의자"}`));
    $("multi-case-meta").textContent = `${gameCase.scene} · ${gameCase.weapon} · ${gameCase.motive}`;
    $("multi-case-story").textContent = gameCase.story;
    renderQuestionControl();
    renderMultiLog();
  }

  function renderQuestionControl() {
    const { $, questions } = window.App;
    $("multi-question-state").textContent = multi.room.active ? `${multi.room.active.target} 답변 대기` : isHost() ? "경찰 질문 선택" : "경찰 질문 대기";
    $("multi-question-list").replaceChildren();
    $("multi-target-list").replaceChildren();
    questions.slice(0, 5).forEach((text, index) => {
      const btn = document.createElement("button");
      btn.className = `question-card ${multi.selectedQuestion === text ? "selected" : ""}`;
      btn.disabled = !isHost() || Boolean(multi.room.active);
      btn.innerHTML = `<strong>질문 ${index + 1}</strong><span>${text}</span>`;
      btn.addEventListener("click", () => {
        multi.selectedQuestion = text;
        renderQuestionControl();
      });
      $("multi-question-list").appendChild(btn);
    });
    suspects().forEach((player) => {
      const btn = document.createElement("button");
      btn.className = "suspect-card";
      btn.disabled = !isHost() || !multi.selectedQuestion || Boolean(multi.room.active);
      btn.innerHTML = `<strong>${player.name}</strong><span>용의자</span>`;
      btn.addEventListener("click", () => ask(player.name));
      $("multi-target-list").appendChild(btn);
    });
    renderAnswerBox();
  }

  async function ask(target) {
    const { toast } = window.App;
    if (!multi.selectedQuestion) return toast("질문카드를 먼저 선택하십시오.");
    try {
      multi.room = await api("/api/rooms/ask", { code: multi.room.code, name: multi.currentName, question: multi.selectedQuestion, target });
      multi.selectedQuestion = null;
      renderRoom();
    } catch (error) {
      toast("질문을 등록하지 못했습니다.");
    }
  }

  function renderAnswerBox() {
    const { $ } = window.App;
    const active = multi.room.active;
    const canAnswer = Boolean(active && active.target === multi.currentName);
    $("multi-answer-input").disabled = !canAnswer;
    $("btn-submit-answer").disabled = !canAnswer;
    $("answer-guide").textContent = active ? `${active.target}만 답변할 수 있습니다. 질문: ${active.question}` : "선택된 용의자만 답변할 수 있습니다.";
    if (!canAnswer) $("multi-answer-input").value = "";
  }

  async function submitAnswer() {
    const { $, toast } = window.App;
    const text = $("multi-answer-input").value.trim();
    if (!text) return toast("답변을 입력하십시오.");
    if (!multi.room.active || multi.room.active.target !== multi.currentName) return toast("선택된 용의자만 답변할 수 있습니다.");
    try {
      multi.room = await api("/api/rooms/answer", { code: multi.room.code, name: multi.currentName, text });
      $("multi-answer-input").value = "";
      renderRoom();
    } catch (error) {
      toast("선택된 용의자만 답변할 수 있습니다.");
    }
  }

  function renderMultiLog() {
    const { $ } = window.App;
    const active = multi.room.active;
    const lines = [...(multi.room.history || [])];
    if (active) lines.push(`${active.target}에게 질문: ${active.question}`);
    if (!lines.length) lines.push("경찰이 질문카드를 선택한 뒤 용의자를 선택합니다.");
    $("multi-log").replaceChildren(...lines.slice(-8).map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
  }

  window.MultiMode = { createRoom, joinRoom, refreshRoom, submitAnswer };
})();
