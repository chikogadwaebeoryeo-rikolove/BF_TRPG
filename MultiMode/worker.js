import { DurableObject } from "cloudflare:workers";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const fallbackQuestions = [
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

const fallbackJobs = ["간호사", "기자", "경찰", "회계사", "변호사", "상담원", "경비원", "프로그래머", "연예인", "약사", "교사", "배달원", "알바생", "사업가", "택시기사", "의사", "정치인", "요리사", "유튜버", "은행원", "탐정", "연구원", "건물주", "보험설계사", "담당 변호사", "담당 의사"];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    ...cors,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

const text = (value, max = 300) => String(value || "").trim().slice(0, max);
const roomCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
const hand = (questions) => shuffle(Array.isArray(questions) && questions.length ? questions.map((item) => text(item, 180)).filter(Boolean) : fallbackQuestions).slice(0, 5);
const uniqueTexts = (list, max = 30) => [...new Set((Array.isArray(list) ? list : []).map((item) => text(item, max)).filter(Boolean))];
const clean = (value) => text(value, 80).replace(/\s+/g, "").toLowerCase();
const jobPool = (jobs) => {
  const pool = uniqueTexts(jobs, 30);
  return pool.length ? pool : fallbackJobs;
};
const caseJob = (value, jobs) => {
  const wanted = text(value, 30);
  return jobs.includes(wanted) ? wanted : shuffle(jobs)[0] || "용의자";
};

async function readBody(request) {
  if (request.method === "GET") return {};
  return request.json().catch(() => ({}));
}

function roomStub(env, code) {
  return env.ROOM_HUB.get(env.ROOM_HUB.idFromName(code));
}

async function forward(stub, path, payload) {
  return stub.fetch("https://room.local" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/rooms/")) return json({ error: "not_found" }, 404);
    const body = await readBody(request);
    if (url.pathname.endsWith("/create")) {
      for (let i = 0; i < 8; i += 1) {
        const code = roomCode();
        const res = await forward(roomStub(env, code), "/api/rooms/create", { ...body, code });
        if (res.status !== 409) return res;
      }
      return json({ error: "code_collision" }, 503);
    }
    const code = text(body.code || url.searchParams.get("code"), 8).toUpperCase();
    if (!code) return json({ error: "code_required" }, 400);
    return forward(roomStub(env, code), url.pathname, { ...body, code, name: body.name || url.searchParams.get("name") });
  }
};

export class RoomHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async data() {
    return this.ctx.storage.get("room");
  }

  async save(room) {
    room.updatedAt = Date.now();
    room.history = (room.history || []).slice(-80);
    room.chat = (room.chat || []).slice(-80);
    await this.ctx.storage.put("room", room);
    return room;
  }

  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const body = await readBody(request);
    if (url.pathname.endsWith("/create")) return this.create(body);
    if (url.pathname.endsWith("/join")) return this.join(body);
    if (url.pathname.endsWith("/state")) return this.state(body);
    if (url.pathname.endsWith("/start")) return this.start(body);
    if (url.pathname.endsWith("/reroll")) return this.reroll(body);
    if (url.pathname.endsWith("/ask")) return this.ask(body);
    if (url.pathname.endsWith("/answer")) return this.answer(body);
    if (url.pathname.endsWith("/speech")) return this.speech(body);
    if (url.pathname.endsWith("/chat")) return this.chat(body);
    if (url.pathname.endsWith("/accuse")) return this.accuse(body);
    if (url.pathname.endsWith("/weapon")) return this.weapon(body);
    if (url.pathname.endsWith("/kick")) return this.kick(body);
    return json({ error: "not_found" }, 404);
  }

  normalize(room) {
    if (!room) return null;
    room.players = (room.players || []).map((player) => ({ score: 0, ...player }));
    room.history ||= [];
    room.chat ||= [];
    room.hand ||= [];
    room.used ||= 0;
    room.rerolls ||= 0;
    room.banned ||= [];
    room.phase ||= 0;
    room.started = Boolean(room.started);
    room.final ||= null;
    return room;
  }

  view(room, viewer) {
    const safe = this.normalize(structuredClone(room));
    const local = safe.players.find((player) => player.name === viewer);
    const gameCase = safe.case || {};
    safe.private = local?.role === "마피아" ? {
      weapon: gameCase.weapon || "",
      overview: [gameCase.story, gameCase.motive ? `동기: ${gameCase.motive}` : ""].filter(Boolean).join("\n")
    } : null;
    safe.case = { id: gameCase.id, victim: gameCase.victim, scene: gameCase.scene };
    safe.players = safe.players.map((player) => ({
      ...player,
      role: player.name === viewer ? player.role : player.host ? "경찰" : null
    }));
    delete safe.banned;
    return safe;
  }

  isHost(room, name) {
    return room.players.some((player) => player.name === name && player.host);
  }

  hasPlayer(room, name) {
    return room.players.some((player) => player.name === name);
  }

  suspects(room) {
    return room.players.filter((player) => !player.host);
  }

  speaker(room) {
    if (!room.speech) return null;
    return this.suspects(room)[room.speech.index] || null;
  }

  async create(body) {
    if (await this.data()) return json({ error: "room_exists" }, 409);
    const name = text(body.name, 16) || "플레이어";
    const gameCase = body.case && typeof body.case === "object" ? body.case : null;
    if (!gameCase) return json({ error: "case_required" }, 400);
    const room = {
      code: text(body.code, 8).toUpperCase(),
      players: [{ name, host: true, role: null, job: null, score: 0 }],
      case: gameCase,
      started: false,
      phase: 0,
      used: 0,
      rerolls: 0,
      hand: [],
      active: null,
      speech: null,
      final: null,
      banned: [],
      history: ["3명 이상 모이면 경찰이 게임을 시작할 수 있습니다."],
      chat: [],
      updatedAt: Date.now()
    };
    return json(this.view(await this.save(room), name));
  }

  async join(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16) || "플레이어";
    if (room.banned.includes(name)) return json({ error: "player_banned" }, 403);
    if (!room.players.some((player) => player.name === name)) {
      if (room.players.length >= 15) return json({ error: "room_full" }, 409);
      const late = room.started;
      room.players.push({ name, host: false, role: late ? "시민" : null, job: late ? this.nextJob(room, body.jobs) : null, score: 0 });
      room.history.push(`${name} ${late ? "도중 참여" : "참여"}`);
    }
    return json(this.view(await this.save(room), name));
  }

  async state(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    if (room.banned.includes(name)) return json({ error: "player_banned" }, 403);
    return json(this.view(room, name));
  }

  nextJob(room, jobs) {
    const pool = shuffle(jobPool(jobs));
    const used = new Set((room.players || []).map((player) => player.job).filter(Boolean));
    return pool.find((job) => !used.has(job)) || pool[0] || "용의자";
  }

  award(room, team) {
    if (!room.final || room.final.scored) return;
    room.players = room.players.map((player) => {
      const win = team === "mafia" ? player.role === "마피아" : player.role === "경찰" || player.role === "시민";
      return win ? { ...player, score: (player.score || 0) + 1 } : player;
    });
    room.final = { ...room.final, scored: true, winningTeam: team };
    room.history.push(team === "mafia" ? "마피아 팀 점수 +1" : "경찰·시민 팀 점수 +1");
  }

  async start(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    if (!this.isHost(room, name)) return json({ error: "host_only" }, 403);
    if (room.started) return json(this.view(room, name));
    if (room.players.length < 3) return json({ error: "need_three_players" }, 409);
    const suspects = this.suspects(room);
    const mafia = shuffle(suspects)[0]?.name;
    const jobs = jobPool(body.jobs);
    const culpritJob = caseJob(room.case?.culprit, jobs);
    const pool = shuffle(jobs.filter((job) => job !== culpritJob));
    let jobIndex = 0;
    room.players = room.players.map((player) => {
      if (player.host) return { ...player, role: "경찰", job: "수사관", score: player.score || 0 };
      const mafiaPlayer = player.name === mafia;
      const job = mafiaPlayer && culpritJob ? culpritJob : pool[jobIndex++ % Math.max(pool.length, 1)] || "용의자";
      return { ...player, role: mafiaPlayer ? "마피아" : "시민", job, score: player.score || 0 };
    });
    room.started = true;
    room.phase = 0;
    room.used = 0;
    room.rerolls = 0;
    room.hand = hand(body.questions);
    room.active = null;
    room.final = null;
    room.speech = suspects.length ? { type: "opening", index: 0 } : null;
    room.history.push("게임 시작");
    room.history.push("시작 발언을 진행합니다.");
    return json(this.view(await this.save(room), name));
  }

  async reroll(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    if (!this.isHost(room, name)) return json({ error: "host_only" }, 403);
    if (!room.started || room.speech || room.active || room.phase > 1) return json({ error: "bad_state" }, 409);
    if (room.used >= 3) return json({ error: "hand_locked" }, 409);
    if (room.rerolls >= 3) return json({ error: "reroll_limit" }, 409);
    room.rerolls += 1;
    room.hand = hand(body.questions);
    room.history.push(`경찰이 질문 패를 리롤했습니다. (${room.rerolls}/3)`);
    return json(this.view(await this.save(room), name));
  }

  async ask(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const question = text(body.question, 180);
    const target = text(body.target, 16);
    if (!room.started) return json({ error: "not_started" }, 409);
    if (!this.isHost(room, name)) return json({ error: "host_only" }, 403);
    if (room.speech || room.active || room.phase > 1 || room.used >= 3) return json({ error: "bad_state" }, 409);
    const targetPlayer = room.players.find((player) => player.name === target);
    if (!question || !targetPlayer || targetPlayer.host || !room.hand.includes(question)) return json({ error: "bad_question" }, 400);
    room.used += 1;
    room.hand = room.hand.filter((item) => item !== question);
    room.active = { question, target };
    return json(this.view(await this.save(room), name));
  }

  async answer(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const reply = text(body.text, 300);
    if (!room.active || room.active.target !== name) return json({ error: "target_only" }, 403);
    if (!reply) return json({ error: "empty_answer" }, 400);
    room.history.push(`경찰 : ${room.active.question}`);
    room.history.push(`${room.active.target} : ${reply}`);
    room.active = null;
    if (room.used >= 3) {
      if (room.phase === 0) {
        room.phase = 1;
        room.used = 0;
        room.hand = hand(body.questions);
        room.history.push("2차 질문을 시작합니다.");
      } else if (room.phase === 1) {
        room.phase = 2;
        room.hand = [];
        room.speech = this.suspects(room).length ? { type: "closing", index: 0 } : null;
        room.history.push("마지막 발언을 진행합니다.");
      }
    }
    return json(this.view(await this.save(room), name));
  }

  async speech(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const message = text(body.text, 300);
    const speaker = this.speaker(room);
    if (!speaker || speaker.name !== name) return json({ error: "speaker_only" }, 403);
    if (!message) return json({ error: "empty_speech" }, 400);
    const type = room.speech.type;
    room.history.push(`${type === "opening" ? "시작 발언" : "마지막 발언"} ${name} : ${message}`);
    room.speech.index += 1;
    if (!this.speaker(room)) {
      room.history.push(type === "opening" ? "질문을 시작합니다." : "마지막 발언이 끝났습니다.");
      if (type === "closing") room.history.push("경찰은 범인을 지목할 수 있습니다.");
      room.speech = null;
    }
    return json(this.view(await this.save(room), name));
  }

  async accuse(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const target = text(body.target, 16);
    if (!this.isHost(room, name)) return json({ error: "host_only" }, 403);
    if (!room.started || room.phase < 2 || room.speech || room.active || room.final?.done) return json({ error: "bad_state" }, 409);
    const suspect = this.suspects(room).find((player) => player.name === target);
    if (!suspect) return json({ error: "bad_target" }, 400);
    const correct = suspect.role === "마피아";
    room.final = { suspect: suspect.name, suspectJob: suspect.job || "용의자", suspectCorrect: correct, weapon: null, weaponCorrect: null, done: !correct };
    room.history.push(`경찰이 ${suspect.name}(${suspect.job || "용의자"})을 범인으로 지목했습니다.`);
    room.history.push(correct ? "범인 지목 완료. 무기까지 맞춰야 정답 처리됩니다." : "범인 지목 실패. 사건 해결에 실패했습니다.");
    if (!correct) this.award(room, "mafia");
    return json(this.view(await this.save(room), name));
  }

  async weapon(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const guess = text(body.weapon, 30);
    if (!this.isHost(room, name)) return json({ error: "host_only" }, 403);
    if (!room.final?.suspectCorrect || room.final.done) return json({ error: "bad_state" }, 409);
    if (!guess) return json({ error: "weapon_required" }, 400);
    const correct = clean(guess) === clean(room.case?.weapon);
    room.final = { ...room.final, weapon: guess, weaponCorrect: correct, answerWeapon: room.case?.weapon || "미상", done: true };
    room.history.push(`경찰이 무기를 ${guess}로 지목했습니다.`);
    room.history.push(correct ? "범인과 무기를 모두 맞췄습니다. 정답 처리됩니다." : `무기 지목 실패. 정답은 ${room.final.answerWeapon}입니다.`);
    this.award(room, correct ? "civilians" : "mafia");
    return json(this.view(await this.save(room), name));
  }

  async kick(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const target = text(body.target, 16);
    if (!this.isHost(room, name)) return json({ error: "host_only" }, 403);
    const targetPlayer = room.players.find((player) => player.name === target);
    if (!targetPlayer || targetPlayer.host) return json({ error: "bad_target" }, 400);
    const kickedSpeaker = this.speaker(room)?.name === target;
    room.banned = [...new Set([...room.banned, target])];
    room.players = room.players.filter((player) => player.name !== target);
    if (room.active?.target === target) room.active = null;
    if (kickedSpeaker || !this.speaker(room)) room.speech = null;
    room.history.push(`${target} 강퇴`);
    return json(this.view(await this.save(room), name));
  }

  async chat(body) {
    const room = this.normalize(await this.data());
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const message = text(body.text, 180);
    if (!this.hasPlayer(room, name)) return json({ error: "player_only" }, 403);
    if (!message) return json({ error: "empty_chat" }, 400);
    room.chat.push(`${name} : ${message}`);
    return json(this.view(await this.save(room), name));
  }
}
