(() => {
  const multi = { room: null, selectedQuestion: null, currentName: "플레이어", roleKey: "", handSig: "", caseSig: "", targetSig: "", finalSig: "", rerolling: false, accuseOpen: false };

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

  function isPolice() {
    return localPlayer()?.role === "경찰";
  }

  function changed(key, value) {
    if (multi[key] === value) return false;
    multi[key] = value;
    return true;
  }

  function resetSignals() {
    multi.selectedQuestion = null;
    multi.handSig = "";
    multi.caseSig = "";
    multi.targetSig = "";
    multi.finalSig = "";
    multi.accuseOpen = false;
  }

  function renderPlayers() {
    const { $ } = window.App;
    const list = $("room-player-list");
    list.replaceChildren(...(multi.room?.players || []).map((player) => {
      const item = document.createElement("li");
      const info = document.createElement("div");
      const name = document.createElement("strong");
      const detail = document.createElement("span");
      item.className = "player-row";
      info.className = "player-main";
      name.textContent = `${player.name}${player.name === multi.currentName ? " (나)" : ""}`;
      detail.textContent = `${player.job || "직업 대기"} · ${player.role || "역할 비공개"} · ${player.score || 0}점${player.host ? " · 방장" : ""}`;
      info.append(name, detail);
      item.appendChild(info);
      if (isHost() && !player.host && player.role !== "경찰") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kick-button";
        btn.textContent = "강퇴";
        btn.addEventListener("click", () => kickPlayer(player.name));
        item.appendChild(btn);
      }
      return item;
    }));
  }

  function suspects() {
    if (!multi.room) return [];
    return multi.room.started ? multi.room.players.filter((player) => player.role !== "경찰") : multi.room.players.filter((player) => !player.host);
  }

  function speaker() {
    if (!multi.room?.speech) return null;
    return suspects()[multi.room.speech.index] || null;
  }

  function renderPanels() {
    const playing = Boolean(multi.room?.started);
    ["multi-talk-panel", "multi-action-panel"].forEach((id) => {
      window.App.$(id).classList.toggle("hidden", !playing);
    });
    window.App.$("multi-case-panel").classList.add("hidden");
    window.App.$("multi-memo-panel").classList.add("hidden");
    window.App.$("multi-lobby-panel").classList.toggle("hidden", playing);
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
    const key = `${multi.room.code}:${multi.room.round || 0}:${player.role}`;
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
      resetSignals();
      setRole(null, multi.currentName);
      openRoom();
      toast(`방 코드 ${multi.room.code}`);
    } catch (error) {
      toast(error.message === "server_url_required" ? "멀티 서버 URL을 설정해야 합니다." : "방을 만들지 못했습니다.");
    }
  }

  async function joinRoom(code) {
    const { setMode, setRole, toast, jobs } = window.App;
    setMode("multi");
    playerName();
    try {
      multi.room = await api("/api/rooms/join", { code, name: multi.currentName, jobs });
      multi.roleKey = "";
      resetSignals();
      setRole(null, multi.currentName);
      openRoom();
      toast(`${multi.room.code} 방에 참여했습니다.`);
    } catch (error) {
      toast(error.message === "server_url_required" ? "멀티 서버 URL을 설정해야 합니다." : error.message === "player_banned" ? "방장이 내보낸 이름은 재입장할 수 없습니다." : "방에 참여하지 못했습니다.");
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
    const { toast, state, showLobby } = window.App;
    if (!multi.room) return;
    try {
      multi.room = await api(`/api/rooms/state?code=${encodeURIComponent(multi.room.code)}&name=${encodeURIComponent(multi.currentName)}`);
      renderRoom();
    } catch (error) {
      if (error.message === "player_banned") {
        clearInterval(state.roomTimer);
        state.roomTimer = null;
        multi.room = null;
        showLobby();
        toast("방장이 내보낸 이름은 재입장할 수 없습니다.");
      } else {
        toast("방 상태를 갱신하지 못했습니다.");
      }
    }
  }

  async function startRoom() {
    const { jobs, questions, toast } = window.App;
    if (!multi.room) return;
    try {
      multi.room = await api("/api/rooms/start", { code: multi.room.code, name: multi.currentName, jobs, questions });
      resetSignals();
      renderRoom();
    } catch (error) {
      toast(error.message === "need_three_players" ? "3명 이상이어야 시작할 수 있습니다." : "게임을 시작하지 못했습니다.");
    }
  }

  async function newGame() {
    const { jobs, pick, questions, setRole, state, toast } = window.App;
    if (!multi.room) return;
    if (!isHost()) return toast("방장만 새 게임을 시작할 수 있습니다.");
    const gameCase = pick(state.cases);
    try {
      multi.room = await api("/api/rooms/restart", { code: multi.room.code, name: multi.currentName, case: gameCase, jobs, questions });
      multi.roleKey = "";
      resetSignals();
      renderRoom();
      toast("새 게임을 시작했습니다.");
    } catch (error) {
      if (error.message === "not_found") {
        try {
          multi.room = await api("/api/rooms/create", { name: multi.currentName, case: gameCase });
          multi.roleKey = "";
          resetSignals();
          setRole(null, multi.currentName);
          openRoom();
          toast("새 방을 만들었습니다. 새 코드를 공유하십시오.");
          return;
        } catch (fallbackError) {
          toast("새 게임을 시작하지 못했습니다.");
          return;
        }
      }
      toast(error.message === "need_three_players" ? "3명 이상이어야 새 게임을 시작할 수 있습니다." : error.message === "host_only" ? "방장만 새 게임을 시작할 수 있습니다." : "새 게임을 시작하지 못했습니다.");
    }
  }

  function renderRoom() {
    const { $, pick, state } = window.App;
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
    renderPanels();
    renderPlayers();
    $("btn-start-room").classList.toggle("hidden", room.started || !isHost());
    $("btn-start-room").disabled = room.players.length < 3;
    $("multi-case-meta").textContent = "초기 공개 정보";
    $("multi-case-victim").textContent = `피해자: ${gameCase.victim || "미상"}`;
    $("multi-case-weapon").textContent = room.private?.weapon || "미확인";
    $("multi-case-scene").textContent = gameCase.scene || "미상";
    $("multi-case-line").textContent = `피해자: ${gameCase.victim || "미상"} · 무기: ${room.private?.weapon || "미확인"} · 현장: ${gameCase.scene || "미상"}`;
    changed("caseSig", [gameCase.victim || "", room.private?.weapon || "", gameCase.scene || ""].join("|"));
    $("mafia-case-brief").classList.toggle("hidden", !room.private?.overview);
    $("mafia-case-story").textContent = room.private?.overview || "";
    renderTalkControl();
    renderQuestionControl();
    renderFinalControl();
    renderMultiLog();
  }

  function renderTalkControl() {
    const { $ } = window.App;
    const current = speaker();
    const active = multi.room?.active;
    const canAnswer = Boolean(active && active.target === multi.currentName);
    const canSpeak = Boolean(current && current.name === multi.currentName);
    const canChat = Boolean(multi.room?.started && !active && !current);
    const canSend = canAnswer || canSpeak || canChat;
    $("talk-state").textContent = canAnswer ? `${active.target} 답변 차례` : canSpeak ? `${current.name} 발언 차례` : active ? `${active.target} 답변 대기` : current ? `${current.name} 발언 대기` : "자유 채팅";
    $("multi-talk-input").placeholder = canAnswer ? `답변 입력: ${active.question}` : canSpeak ? "알리바이 또는 발언 입력" : active ? `${active.target} 답변 차례입니다` : current ? `${current.name} 발언 차례입니다` : "메시지 입력";
    $("btn-submit-talk").textContent = canAnswer ? "답변 전송" : canSpeak ? "발언 전송" : "채팅 전송";
    $("multi-talk-input").disabled = !canSend;
    $("btn-submit-talk").disabled = !canSend;
  }

  function renderQuestionControl() {
    const { $ } = window.App;
    const room = multi.room;
    const rerolls = room.rerolls || 0;
    const blocked = !room.started || Boolean(room.speech) || Boolean(room.active) || Boolean(room.final) || room.phase > 1 || room.used >= 3;
    const hand = room.speech ? [] : room.hand || [];
    const drawQuestions = changed("handSig", hand.join("\n"));
    $("multi-question-state").textContent = !room.started ? "3명 이상 입장 후 시작" : room.speech ? "발언 진행 중" : room.active ? `${room.active.target} 답변 대기` : isPolice() ? `${room.used}/3 질문` : "경찰 질문 대기";
    $("multi-question-list").replaceChildren();
    $("multi-target-list").replaceChildren();
    if (!room.started || room.speech) {
      multi.selectedQuestion = null;
      changed("targetSig", "");
      $("btn-reroll-multi-hand").textContent = `패 리롤 (${rerolls}/3)`;
      $("btn-reroll-multi-hand").disabled = true;
      return;
    }
    hand.forEach((text, index) => {
      const btn = document.createElement("button");
      btn.className = `question-card ${multi.selectedQuestion === text ? "selected" : ""}`;
      btn.disabled = !isPolice() || blocked;
      btn.innerHTML = `<strong>질문 ${index + 1}</strong><span>${text}</span>`;
      btn.addEventListener("click", () => {
        multi.selectedQuestion = text;
        renderQuestionControl();
      });
      $("multi-question-list").appendChild(btn);
    });
    if (drawQuestions && hand.length) window.App.animateCards(Array.from($("multi-question-list").children));
    const targetSig = suspects().map((player) => `${player.name}:${player.job || ""}`).join("|");
    const drawTargets = changed("targetSig", targetSig);
    suspects().forEach((player) => {
      const btn = document.createElement("button");
      btn.className = "suspect-card";
      btn.disabled = !isPolice() || blocked || !multi.selectedQuestion;
      btn.innerHTML = `<strong>${player.name}</strong><span>${player.job || "직업 미정"}</span>`;
      btn.addEventListener("click", () => ask(player.name));
      $("multi-target-list").appendChild(btn);
    });
    if (drawTargets && suspects().length) window.App.animateCards(Array.from($("multi-target-list").children));
    $("btn-reroll-multi-hand").textContent = `패 리롤 (${rerolls}/3)`;
    $("btn-reroll-multi-hand").disabled = multi.rerolling || !isPolice() || !room.started || Boolean(room.speech) || Boolean(room.active) || Boolean(room.final) || room.phase > 1 || room.used >= 3 || rerolls >= 3;
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
    const { $, animateCards, questions, toast, wait } = window.App;
    if (multi.rerolling) return;
    multi.rerolling = true;
    let shouldRender = false;
    try {
      const cards = Array.from($("multi-question-list").querySelectorAll(".question-card"));
      if (cards.length) {
        animateCards(cards, "discard");
        await wait(260);
      }
      multi.room = await api("/api/rooms/reroll", { code: multi.room.code, name: multi.currentName, questions });
      multi.selectedQuestion = null;
      shouldRender = true;
    } catch (error) {
      toast(error.message === "reroll_limit" ? "패 리롤은 방 전체에서 3번까지만 가능합니다." : "패를 리롤할 수 없습니다.");
      shouldRender = true;
    } finally {
      multi.rerolling = false;
      if (shouldRender && multi.room) renderRoom();
    }
  }

  function finalEnabled() {
    const room = multi.room;
    return Boolean(room?.started && !room.speech && !room.active && !room.final?.done);
  }

  function finalText(final) {
    if (!final) {
      if (!multi.room?.started) return "게임 시작 후 가능";
      if (multi.room.speech) return "알리바이 이후 가능";
      return finalEnabled() ? isPolice() ? "범인 지목 가능" : "경찰 지목 대기" : "진행 중";
    }
    if (final.suspectCorrect && !final.done) return "무기까지 맞춰야 정답";
    if (!final.suspectCorrect) return "범인 지목 실패";
    return final.weaponCorrect ? "정답 처리 완료" : "무기 지목 실패";
  }

  function renderFinalControl() {
    const { $ } = window.App;
    const room = multi.room;
    const final = room?.final;
    const canAccuse = isPolice() && finalEnabled() && !final;
    const canGuessWeapon = isPolice() && final?.suspectCorrect && !final.done;
    const showAccuse = canAccuse && multi.accuseOpen;
    $("multi-final-state").textContent = finalText(final);
    $("btn-open-accuse").classList.toggle("hidden", Boolean(final));
    $("btn-open-accuse").disabled = !canAccuse;
    $("btn-open-accuse").textContent = multi.accuseOpen ? "지목 닫기" : "범인 지목하기";
    $("multi-final-suspects").replaceChildren();
    $("multi-final-suspects").classList.toggle("hidden", !showAccuse);
    if (showAccuse) suspects().forEach((player) => {
      const btn = document.createElement("button");
      btn.className = "suspect-card";
      btn.innerHTML = `<strong>${player.name}</strong><span>${player.job || "직업 미정"}</span>`;
      btn.addEventListener("click", () => accuse(player.name));
      $("multi-final-suspects").appendChild(btn);
    });
    const finalSig = suspects().map((player) => `${player.name}:${player.job || ""}:${showAccuse}`).join("|");
    if (showAccuse && changed("finalSig", finalSig) && suspects().length) window.App.animateCards(Array.from($("multi-final-suspects").children));
    $("weapon-guess-panel").classList.toggle("hidden", !canGuessWeapon);
    $("weapon-guess-input").disabled = !canGuessWeapon;
    $("btn-submit-weapon").disabled = !canGuessWeapon;
    if (!canGuessWeapon) $("weapon-guess-input").value = "";
  }

  async function accuse(target) {
    const { toast } = window.App;
    try {
      multi.room = await api("/api/rooms/accuse", { code: multi.room.code, name: multi.currentName, target });
      multi.accuseOpen = false;
      renderRoom();
    } catch (error) {
      toast("지목할 수 없습니다.");
    }
  }

  function toggleAccuse() {
    if (!isPolice() || !finalEnabled() || multi.room?.final) return;
    multi.accuseOpen = !multi.accuseOpen;
    renderFinalControl();
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

  async function kickPlayer(target) {
    const { toast } = window.App;
    try {
      multi.room = await api("/api/rooms/kick", { code: multi.room.code, name: multi.currentName, target });
      renderRoom();
    } catch (error) {
      toast("플레이어를 내보낼 수 없습니다.");
    }
  }

  async function submitTalk() {
    const { $, questions, toast } = window.App;
    const text = $("multi-talk-input").value.trim();
    const active = multi.room?.active;
    const current = speaker();
    if (!text || !multi.room) return;
    if (active && active.target !== multi.currentName) return toast(`${active.target} 답변 차례입니다.`);
    if (current && current.name !== multi.currentName) return toast(`${current.name} 발언 차례입니다.`);
    try {
      if (active && active.target === multi.currentName) {
        multi.room = await api("/api/rooms/answer", { code: multi.room.code, name: multi.currentName, text, questions });
      } else if (current && current.name === multi.currentName) {
        multi.room = await api("/api/rooms/speech", { code: multi.room.code, name: multi.currentName, text });
      } else {
        multi.room = await api("/api/rooms/chat", { code: multi.room.code, name: multi.currentName, text });
      }
      $("multi-talk-input").value = "";
      renderRoom();
    } catch (error) {
      toast(active?.target === multi.currentName ? "답변을 전송하지 못했습니다." : current?.name === multi.currentName ? "현재 발언 차례가 아닙니다." : "채팅을 보내지 못했습니다.");
    }
  }

  function renderMultiLog() {
    const { $ } = window.App;
    const lines = [...(multi.room.history || [])];
    const log = $("multi-log");
    if (multi.room.active) {
      lines.push(`경찰 : ${multi.room.active.question}`);
      lines.push(`${multi.room.active.target} 답변 대기`);
    }
    if (multi.room.chat?.length) lines.push(...multi.room.chat);
    if (!lines.length) lines.push("아직 진행 기록이 없습니다.");
    log.replaceChildren(...lines.map((text) => {
      const line = document.createElement("div");
      line.textContent = text;
      return line;
    }));
    requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight;
    });
  }

  window.MultiMode = { createRoom, joinRoom, refreshRoom, startRoom, newGame, rerollHand, toggleAccuse, submitTalk, submitWeapon, kickPlayer };
})();
