import { DurableObject } from "cloudflare:workers";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

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
    return forward(roomStub(env, code), url.pathname, { ...body, code });
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
    room.history = room.history.slice(-80);
    await this.ctx.storage.put("room", room);
    return room;
  }

  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const body = await readBody(request);
    if (url.pathname.endsWith("/create")) return this.create(body);
    if (url.pathname.endsWith("/join")) return this.join(body);
    if (url.pathname.endsWith("/state")) return this.state();
    if (url.pathname.endsWith("/ask")) return this.ask(body);
    if (url.pathname.endsWith("/answer")) return this.answer(body);
    return json({ error: "not_found" }, 404);
  }

  async create(body) {
    if (await this.data()) return json({ error: "room_exists" }, 409);
    const name = text(body.name, 16) || "플레이어";
    const gameCase = body.case && typeof body.case === "object" ? body.case : null;
    if (!gameCase) return json({ error: "case_required" }, 400);
    const room = {
      code: text(body.code, 8).toUpperCase(),
      players: [{ name, host: true }],
      case: gameCase,
      active: null,
      history: [],
      updatedAt: Date.now()
    };
    return json(await this.save(room));
  }

  async join(body) {
    const room = await this.data();
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16) || "플레이어";
    if (!room.players.some((player) => player.name === name)) {
      if (room.players.length >= 15) return json({ error: "room_full" }, 409);
      room.players.push({ name, host: false });
    }
    return json(await this.save(room));
  }

  async state() {
    const room = await this.data();
    if (!room) return json({ error: "room_not_found" }, 404);
    return json(room);
  }

  async ask(body) {
    const room = await this.data();
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const question = text(body.question, 180);
    const target = text(body.target, 16);
    const host = room.players.some((player) => player.name === name && player.host);
    const targetPlayer = room.players.some((player) => player.name === target);
    if (!host) return json({ error: "host_only" }, 403);
    if (!question || !targetPlayer) return json({ error: "bad_question" }, 400);
    room.active = { question, target };
    return json(await this.save(room));
  }

  async answer(body) {
    const room = await this.data();
    if (!room) return json({ error: "room_not_found" }, 404);
    const name = text(body.name, 16);
    const reply = text(body.text, 300);
    if (!room.active || room.active.target !== name) return json({ error: "target_only" }, 403);
    if (!reply) return json({ error: "empty_answer" }, 400);
    room.history.push(`${room.active.target} 질문: ${room.active.question}`);
    room.history.push(`답변: ${reply}`);
    room.active = null;
    return json(await this.save(room));
  }
}
