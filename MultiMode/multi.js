(() => {
  const multi = { room: null, selectedQuestion: null, currentName: "플레이어", roleKey: "" };

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

  function localPlayer() {
    return multi.room?.players.find((player) => player.name === multi.currentName);
  }

  function isHost() {
    return Boolean(localPlayer()?.host);
  }

  function suspects() {
    if (!multi.room) return [];
    return multi.room.players.filter((player) => !player.host);
  }

  function speaker() {
    if (!multi.room?.speech) return null;
    return suspects()[multi.room.speech.index] || null;
  }

  function syncRole() {
    const { setRole, state, renderRoleProfile } = window.App;
    const player = localPlayer();
    if (!player?.role) {
      if (state.role) setRole(null, multi.currentName);
      else {
        state.playerName = multi.currentName;
        renderRoleProfile();
      }
      return;
    }
    const key = `${multi.room.code}:${player.role}`;
    if (multi.roleKey !== key) {
      multi.roleKey = key;
      setRole(player.role, multi.currentName, true);
    }
  }

  async function createRoom() {
    const { pick, state, setMode, setRole, toast } = window.App;
    setMode("multi");
    playerName();
    try {
      multi.room = await api("/api/rooms/create", { name: multi.currentName, case: pick(state.cases) });
      multi.roleKey = "";
      setRole(null, multi.currentName);
      openRoom();
      toast(`방 코드 ${multi.room.code}`);
    } catch (error) {
      toast(error.message === "server_url_required" ? "멀티 서버 URL을 설정해야 합니다." : "방을 만들지 못했습니다.");
    }
  }

  async function joinRoom(code) {
    const { setMode, setRole, toast } = window.App;
    setMode("multi");
    playerName();
    try {
      multi.room = await api("/api/rooms/join", { code, name: multi.currentName });
      multi.roleKey = "";
      setRole(null, multi.currentName);
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
      multi.room = await api(`/api/rooms/state?code=${encodeURIComponent(multi.room.code)}&name=${encodeURIComponent(multi.currentName)}`);
      renderRoom();
    } catch (error) {
      toast("방 상태를 갱신하지 못했습니다.");
    }
  }

  async function startRoom() {
    const { jobs, questions, toast } = window.App;
    if (!multi.room) return;
    try {
      multi.room = await api("/api/rooms/start", { code: multi.room.code, name: multi.currentName, jobs, questions });
      renderRoom();
    } catch (error) {
      toast(error.message === "need_three_players" ? "3명 이상이어야 시작할 수 있습니다." : "게임을 시작하지 못했습니다.");
    }
  }

  function renderRoom() {
    const { $, fillList, pick, state } = window.App;
    const room = multi.room;
    if (!room) return;
    syncRole();
    const gameCase = room.case || pick(state.cases);
    const share = `${location.origin}${location.pathname}?room=${room.code}`;
    $("session-title").textContent = room.started ? "멀티모드 진행 중" : "멀티모드 대기방";
    $("room-code-label").textContent = room.code;
    $("room-share-text").textContent = room.started ? "게임이 시작되었습니다." : "다른 플레이어는 이 링크로 접속한 뒤 방 코드를 입력합니다.";
    $("room-url").textContent = share;
    $("room-player-count").textContent = `${room.players.length}/15`;
    fillList($("room-player-list"), room.players.map((p) => `${p.name} · ${p.job || (p.host ? "수사관" : "직업 대기")} · ${p.role || (p.host ? "경찰" : "역할 비공개")}`));
    $("btn-start-room").classList.toggle("hidden", room.started || !isHost());
    $("btn-start-room").disabled = room.players.length < 3;
    $("multi-case-meta").textContent = "초기 공개 정보";
    $("multi-case-victim").textContent = `피해자: ${gameCase.victim || "미상"}`;
    $("multi-case-weapon").textContent = room.private?.weapon || "미확인";
    $("multi-case-scene").textContent = gameCase.scene || "미상";
    renderSpeechControl();
    renderQuestionControl();
    renderAnswerBox();
    renderFinalControl();
    renderMultiLog();
    renderChat();
  }

  function renderSpeechControl() {
    const { $ } = window.App;
    const current = speaker();
    const canSpeak = Boolean(current && current.name === multi.currentName);
    $("speech-state").textContent = current ? `${current.name} 발언 차례` : multi.room?.started ? "발언 대기 없음" : "대기 중";
    $("speech-guide").textContent = current ? `${current.name}만 발언할 수 있습니다.` : "게임 시작 후 용의자가 차례대로 발언합니다.";
    $("speech-input").disabled = !canSpeak;
    $("btn-submit-speech").disabled = !canSpeak;
    if (!canSpeak) $("speech-input").value = "";
  }

  function renderQuestionControl() {
    const { $, questions } = window.App;
    const room = multi.room;
    const blocked = !room.started || Boolean(room.speech) || Boolean(room.active) || Boolean(room.final) || room.phase > 1 || room.used >= 3;
    $("multi-question-state").textContent = !room.started ? "3명 이상 입장 후 시작" : room.speech ? "발언 진행 중" : room.active ? `${room.active.target} 답변 대기` : isHost() ? `${room.used}/3 질문` : "경찰 질문 대기";
    $("multi-question-list").replaceChildren();
    $("multi-target-list").replaceChildren();
    (room.hand?.length ? room.hand : questions.slice(0, 5)).forEach((text, index) => {
      const btn = document.createElement("button");
      btn.className = `question-card ${multi.selectedQuestion === text ? "selected" : ""}`;
      btn.disabled = !isHost() || blocked;
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
      btn.disabled = !isHost() || blocked || !multi.selectedQuestion;
      btn.innerHTML = `<strong>${player.name}</strong><span>${player.job || "직업 미정"}</span>`;
      btn.addEventListener("click", () => ask(player.name));
      $("multi-target-list").appendChild(btn);
    });
    $("btn-reroll-multi-hand").disabled = !isHost() || !room.started || Boolean(room.speech) || Boolean(room.active) || Boolean(room.final) || room.phase > 1 || room.used >= 3;
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

  async function rerollHand() {
    const { questions, toast } = window.App;
    try {
      multi.room = await api("/api/rooms/reroll", { code: multi.room.code, name: multi.currentName, questions });
      multi.selectedQuestion = null;
      renderRoom();
    } catch (error) {
      toast("패를 리롤할 수 없습니다.");
    }
  }

  function renderAnswerBox() {
    const { $ } = window.App;
    const active = multi.room?.active;
    const canAnswer = Boolean(active && active.target === multi.currentName);
    $("multi-answer-input").disabled = !canAnswer;
    $("btn-submit-answer").disabled = !canAnswer;
    $("answer-guide").textContent = active ? `${active.target}만 답변할 수 있습니다. 질문: ${active.question}` : "선택된 용의자만 답변할 수 있습니다.";
    if (!canAnswer) $("multi-answer-input").value = "";
  }

  async function submitAnswer() {
    const { $, questions, toast } = window.App;
    const text = $("multi-answer-input").value.trim();
    if (!text) return toast("답변을 입력하십시오.");
    if (!multi.room.active || multi.room.active.target !== multi.currentName) return toast("선택된 용의자만 답변할 수 있습니다.");
    try {
      multi.room = await api("/api/rooms/answer", { code: multi.room.code, name: multi.currentName, text, questions });
      $("multi-answer-input").value = "";
      renderRoom();
    } catch (error) {
      toast("선택된 용의자만 답변할 수 있습니다.");
    }
  }

  function finalEnabled() {
    const room = multi.room;
    return Boolean(room?.started && room.phase >= 2 && !room.speech && !room.active);
  }

  function finalText(final) {
    if (!final) return finalEnabled() ? isHost() ? "범인 지목 대기" : "경찰 지목 대기" : "질문과 발언 종료 후 진행";
    if (final.suspectCorrect && !final.done) return "무기까지 맞춰야 정답";
    if (!final.suspectCorrect) return "범인 지목 실패";
    return final.weaponCorrect ? "정답 처리 완료" : "무기 지목 실패";
  }

  function renderFinalControl() {
    const { $ } = window.App;
    const room = multi.room;
    const final = room?.final;
    const canAccuse = isHost() && finalEnabled() && !final;
    const canGuessWeapon = isHost() && final?.suspectCorrect && !final.done;
    $("multi-final-state").textContent = finalText(final);
    $("multi-final-suspects").replaceChildren();
    suspects().forEach((player) => {
      const btn = document.createElement("button");
      btn.className = "suspect-card";
      btn.disabled = !canAccuse;
      btn.innerHTML = `<strong>${player.name}</strong><span>${player.job || "직업 미정"}</span>`;
      btn.addEventListener("click", () => accuse(player.name));
      $("multi-final-suspects").appendChild(btn);
    });
    $("weapon-guess-panel").classList.toggle("hidden", !canGuessWeapon);
    $("weapon-guess-input").disabled = !canGuessWeapon;
    $("btn-submit-weapon").disabled = !canGuessWeapon;
    if (!canGuessWeapon) $("weapon-guess-input").value = "";
  }

  async function accuse(target) {
    const { toast } = window.App;
    try {
      multi.room = await api("/api/rooms/accuse", { code: multi.room.code, name: multi.currentName, target });
      renderRoom();
    } catch (error) {
      toast("지목할 수 없습니다.");
    }
  }

  async function submitWeapon() {
    const { $, toast } = window.App;
    const weapon = $("weapon-guess-input").value.trim();
    if (!weapon) return toast("무기를 입력하십시오.");
    try {
      multi.room = await api("/api/rooms/weapon", { code: multi.room.code, name: multi.currentName, weapon });
      $("weapon-guess-input").value = "";
      renderRoom();
    } catch (error) {
      toast("무기를 지목할 수 없습니다.");
    }
  }

  async function submitSpeech() {
    const { $, toast } = window.App;
    const text = $("speech-input").value.trim();
    if (!text) return toast("발언을 입력하십시오.");
    try {
      multi.room = await api("/api/rooms/speech", { code: multi.room.code, name: multi.currentName, text });
      $("speech-input").value = "";
      renderRoom();
    } catch (error) {
      toast("현재 발언 차례가 아닙니다.");
    }
  }

  async function submitChat() {
    const { $, toast } = window.App;
    const text = $("chat-input").value.trim();
    if (!text || !multi.room) return;
    try {
      multi.room = await api("/api/rooms/chat", { code: multi.room.code, name: multi.currentName, text });
      $("chat-input").value = "";
      renderRoom();
    } catch (error) {
      toast("채팅을 보내지 못했습니다.");
    }
  }

  function renderMultiLog() {
    const { $ } = window.App;
    const lines = [...(multi.room.history || [])];
    if (!lines.length) lines.push("3명 이상 모이면 경찰이 게임을 시작할 수 있습니다.");
    $("multi-log").replaceChildren(...lines.slice(-10).map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
  }

  function renderChat() {
    const { $ } = window.App;
    const lines = [...(multi.room.chat || [])];
    $("chat-state").textContent = multi.room.started ? "전체 채팅" : "대기실 채팅";
    $("chat-input").disabled = false;
    $("multi-chat-log").replaceChildren(...(lines.length ? lines : ["아직 채팅이 없습니다."]).slice(-10).map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
  }

  window.MultiMode = { createRoom, joinRoom, refreshRoom, startRoom, rerollHand, submitAnswer, submitSpeech, submitChat, submitWeapon };
})();
