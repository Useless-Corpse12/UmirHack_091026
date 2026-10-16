import http from "node:http";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DomainError,
  fail,
  seedState,
  restaurantOf,
  membershipOf,
  domainNow,
  snapshot,
  createSupply,
  decideSupply,
  makeOrder,
  saveProducts,
  productShelfLifeSeconds,
  productUnit,
  menuDocument,
  saveMenu,
  approveExpiry,
} from "./domain.mjs";

const hash = (value) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(String(value), salt, 32).toString("hex");
};
const verifyHash = (value, encoded) => {
  const [salt, digest] = String(encoded || "").split(":");
  if (!salt || !digest) return false;
  const computed = scryptSync(String(value), salt, 32);
  const expected = Buffer.from(digest, "hex");
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
};
const publicUser = (u) => ({ id: u.id, email: u.email });
const ADMIN = ["owner", "admin"];
export function createDemoServer(options = {}) {
  const now = options.now || Date.now;
  const filename = options.filename;
  let state =
    filename && existsSync(filename)
      ? JSON.parse(readFileSync(filename, "utf8"))
      : seedState(hash, now());
  for (const r of state.restaurants) {
    r.expiryApprovals ||= [];
    r.menuVersion ??= 1;
    // Migrate old day-based catalogs without changing existing batch dates.
    for (const product of r.products) {
      product.shelfLifeSeconds = productShelfLifeSeconds(product);
      delete product.shelfLifeDays;
      product.unit = productUnit(product.unit);
    }
    for (const batch of r.batches) delete batch.unit;
    for (const supply of r.supplies)
      for (const item of supply.items) delete item.unit;
    for (const approval of r.expiryApprovals) delete approval.unit;
  }
  state.sessions = state.sessions.map(({ sid, userId, expiresAt }) => ({
    sid,
    userId,
    expiresAt,
  }));
  const clients = new Set();
  const ttl = options.accessTtlSeconds || 300;
  const origins = new Set(
    options.origins || ["http://localhost:5173", "http://127.0.0.1:5173"],
  );
  const persist = () => {
    if (!filename) return;
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename + ".tmp", JSON.stringify(state), { mode: 0o600 });
    renameSync(filename + ".tmp", filename);
  };
  const jwt = (user, sid) => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        UserId: user.id,
        Email: user.email,
        sid,
        exp: Math.floor(now() / 1000) + ttl,
        iat: Math.floor(now() / 1000),
      }),
    ).toString("base64url");
    const signature = createHmac("sha256", state.jwtSecret)
      .update(header + "." + payload)
      .digest("base64url");
    return header + "." + payload + "." + signature;
  };
  const tokenUser = (token) => {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) fail(401, "UNAUTHENTICATED", "Войдите в аккаунт");
    const expected = createHmac("sha256", state.jwtSecret)
      .update(parts[0] + "." + parts[1])
      .digest();
    const supplied = Buffer.from(parts[2], "base64url");
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    )
      fail(401, "UNAUTHENTICATED", "Сессия недействительна");
    let claims;
    try {
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    } catch {
      fail(401, "UNAUTHENTICATED", "Сессия недействительна");
    }
    const session = state.sessions.find(
      (s) =>
        s.sid === claims.sid &&
        s.userId === claims.UserId &&
        s.expiresAt > now(),
    );
    const user = state.users.find(
      (u) => u.id === claims.UserId && u.isVerified,
    );
    if (!user || !session || claims.exp <= now() / 1000)
      fail(401, "TOKEN_EXPIRED", "Сессия истекла");
    return user;
  };
  const auth = (req) =>
    tokenUser(String(req.headers.authorization || "").replace(/^Bearer /i, ""));
  const issueSession = (user) => {
    const session = {
      sid: randomUUID(),
      userId: user.id,
      expiresAt: now() + ttl * 1000,
    };
    state.sessions.push(session);
    persist();
    return { accessToken: jwt(user, session.sid), user: publicUser(user) };
  };
  const reply = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(value === undefined ? "" : JSON.stringify(value));
  };
  function sendFrame(socket, payload, opcode = 1) {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    let prefix;
    if (body.length < 126) prefix = Buffer.from([0x80 | opcode, body.length]);
    else if (body.length <= 65535) {
      prefix = Buffer.alloc(4);
      prefix[0] = 0x80 | opcode;
      prefix[1] = 126;
      prefix.writeUInt16BE(body.length, 2);
    } else {
      prefix = Buffer.alloc(10);
      prefix[0] = 0x80 | opcode;
      prefix[1] = 127;
      prefix.writeBigUInt64BE(BigInt(body.length), 2);
    }
    if (!socket.destroyed) socket.write(Buffer.concat([prefix, body]));
  }
  const broadcast = () => {
    for (const c of clients) {
      try {
        const user = tokenUser(c.token);
        membershipOf(state, user.id, c.restaurantId);
        const r = restaurantOf(state, c.restaurantId);
        sendFrame(
          c.socket,
          JSON.stringify({
            type: "restaurant.snapshot",
            data: snapshot(r, state, now()),
          }),
        );
      } catch {
        sendFrame(c.socket, Buffer.from([0x03, 0xf0]), 8);
        c.socket.end();
      }
    }
  };
  // All domain mutations are synchronous transactions in this local demo process.
  const transaction = (fn) => {
    const next = structuredClone(state);
    const result = fn(next);
    state = next;
    persist();
    broadcast();
    return result;
  };
  const readBody = async (req) => {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1048576) fail(413, "BODY_TOO_LARGE", "Запрос слишком большой");
      chunks.push(chunk);
    }
    if (!size) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      fail(400, "VALIDATION", "Неверный JSON");
    }
  };
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !origins.has(origin))
      return reply(res, 403, { code: "ORIGIN", message: "Origin не разрешён" });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Idempotency-Key",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname.toLowerCase();
    try {
      if (path === "/health")
        return reply(res, 200, { mode: "demo", ok: true });
      const body = ["POST", "PUT"].includes(req.method)
        ? await readBody(req)
        : {};
      if (path === "/api/authority/registeruser" && req.method === "POST") {
        const email = String(body.email || "")
          .trim()
          .toLowerCase();
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          email.length > 254 ||
          String(body.password || "").length < 6
        )
          fail(400, "VALIDATION", "Проверьте email и пароль");
        const existing = state.users.find((u) => u.email === email);
        if (existing?.isVerified)
          fail(409, "EMAIL_EXISTS", "Email уже зарегистрирован");
        const code = String(100000 + Math.floor(Math.random() * 900000));
        const user = existing || { id: randomUUID(), email, isVerified: false };
        user.passwordHash = hash(body.password);
        user.verification = { code, expiresAt: now() + 600000 };
        if (!existing) state.users.push(user);
        persist();
        console.log("[DEMO] Код для " + email + ": " + code);
        return reply(res, 200, {
          userId: user.id,
          message: "Код создан в демо-сервисе",
          devVerificationCode: code,
        });
      }
      if (path === "/api/authority/resendcode" && req.method === "POST") {
        const user = state.users.find(
          (u) => u.email === String(body.email || "").toLowerCase(),
        );
        if (!user || user.isVerified)
          fail(400, "VALIDATION", "Аккаунт не ожидает подтверждения");
        const code = String(100000 + Math.floor(Math.random() * 900000));
        user.verification = { code, expiresAt: now() + 600000 };
        persist();
        console.log("[DEMO] Код для " + user.email + ": " + code);
        return reply(res, 200, {
          devVerificationCode: code,
          message: "Новый демокод создан",
        });
      }
      if (path === "/api/authority/verifyuser" && req.method === "POST") {
        const user = state.users.find(
          (u) => u.email === String(body.email || "").toLowerCase(),
        );
        if (
          !user?.verification ||
          user.verification.expiresAt <= now() ||
          user.verification.code !== String(body.verificationCode)
        )
          fail(400, "INVALID_CODE", "Код неверен или истёк");
        user.isVerified = true;
        delete user.verification;
        persist();
        return reply(res, 200, {
          userId: user.id,
          message: "Аккаунт подтверждён",
        });
      }
      if (path === "/api/authority/authorizeuser" && req.method === "POST") {
        const user = state.users.find(
          (u) =>
            u.email ===
            String(body.email || "")
              .trim()
              .toLowerCase(),
        );
        if (!user || !verifyHash(body.password, user.passwordHash))
          fail(401, "INVALID_CREDENTIALS", "Неверный email или пароль");
        if (!user.isVerified)
          fail(403, "EMAIL_UNVERIFIED", "Подтвердите email");
        return reply(res, 200, issueSession(user));
      }
      if (path === "/api/authority/logout" && req.method === "POST") {
        auth(req);
        const token = String(req.headers.authorization || "").replace(
          /^Bearer /i,
          "",
        );
        const claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        );
        state.sessions = state.sessions.filter((s) => s.sid !== claims.sid);
        persist();
        broadcast();
        return reply(res, 200, { message: "Вы вышли" });
      }
      if (path === "/api/supply/getproducts" && req.method === "GET") {
        const r = restaurantOf(
          state,
          url.searchParams.get("RestaurantId") ||
            url.searchParams.get("restaurantId"),
        );
        if (
          !verifyHash(
            url.searchParams.get("ApiKey") || url.searchParams.get("apiKey"),
            r.apiSecretHash,
          )
        )
          fail(403, "INVALID_KEY", "Неверный ключ поставщика");
        return reply(
          res,
          200,
          r.products.map((p) => ({
            ...p,
            productName: p.name,
            expiresAt: new Date(
              domainNow(state, now()) + p.shelfLifeSeconds * 1000,
            ).toISOString(),
          })),
        );
      }
      if (path === "/api/supply/incoming" && req.method === "POST") {
        const r = restaurantOf(state, body.restaurantId);
        if (!verifyHash(body.apiKey, r.apiSecretHash))
          fail(403, "INVALID_KEY", "Неверный ключ поставщика");
        return reply(
          res,
          200,
          transaction((s) =>
            createSupply(restaurantOf(s, r.id), body, domainNow(s, now())),
          ),
        );
      }
      const user = auth(req);
      if (path === "/api/authority/profile")
        return reply(res, 200, publicUser(user));
      if (path === "/api/restaurant/my" && req.method === "GET") {
        return reply(
          res,
          200,
          state.memberships
            .filter((m) => m.userId === user.id)
            .map((m) => ({
              restaurantId: m.restaurantId,
              name: restaurantOf(state, m.restaurantId).name,
              role: m.role,
            })),
        );
      }
      if (path === "/api/restaurant/create" && req.method === "POST") {
        const name = String(body.restaurantName || "").trim();
        if (!name || name.length > 100)
          fail(400, "VALIDATION", "Название: 1–100 символов");
        const apiKey = randomBytes(24).toString("hex");
        const id = randomUUID();
        transaction((s) => {
          s.restaurants.push({
            id,
            name,
            apiSecretHash: hash(apiKey),
            products: [],
            batches: [],
            supplies: [],
            dishes: [],
            menuVersion: 1,
            orders: [],
            writeOffs: [],
            expiryApprovals: [],
            revision: 1,
          });
          s.memberships.push({
            userId: user.id,
            restaurantId: id,
            role: "owner",
          });
        });
        return reply(res, 200, {
          restaurantId: id,
          apiKey,
          message: "Ресторан создан",
        });
      }
      const expiryMatch = path.match(
        /^\/api\/restaurant\/([^/]+)\/expiry\/([^/]+)\/approve$/,
      );
      if (expiryMatch && req.method === "POST") {
        const [, id, batchId] = expiryMatch;
        restaurantOf(state, id);
        membershipOf(state, user.id, id);
        return reply(
          res,
          200,
          transaction((s) =>
            approveExpiry(
              restaurantOf(s, id),
              batchId,
              domainNow(s, now()),
              user,
            ),
          ),
        );
      }
      // Same incremental semantics as the ASP.NET API; intentionally no deletion.
      const mergeMatch = path.match(/^\/api\/restaurant\/([^/]+)\/products\/merge$/);
      if (mergeMatch && req.method === "POST") {
        const id = mergeMatch[1];
        restaurantOf(state, id);
        membershipOf(state, user.id, id, ADMIN);
        return reply(res, 200, transaction((s) => saveProducts(restaurantOf(s, id), body)));
      }
      let match = path.match(
        /^\/api\/restaurant\/([^/]+)\/(snapshot|products|menu|employees|invitations|pos)$/,
      );
      if (match) {
        const [, id, action] = match;
        const r = restaurantOf(state, id);
        const membership = membershipOf(
          state,
          user.id,
          id,
          ["products", "menu", "employees", "invitations", "pos"].includes(
            action,
          )
            ? ADMIN
            : undefined,
        );
        if (action === "snapshot" && req.method === "GET")
          return reply(res, 200, snapshot(r, state, now()));
        if (action === "menu" && req.method === "GET")
          return reply(res, 200, menuDocument(r));
        if (action === "menu" && req.method === "PUT")
          return reply(
            res,
            200,
            transaction((s) => saveMenu(restaurantOf(s, id), body)),
          );
        if (action === "products" && req.method === "GET")
          return reply(res, 200, r.products);
        if (action === "products" && req.method === "PUT")
          return reply(
            res,
            200,
            transaction((s) => saveProducts(restaurantOf(s, id), body)),
          );
        if (action === "employees" && req.method === "GET") {
          return reply(
            res,
            200,
            state.memberships
              .filter((m) => m.restaurantId === id)
              .map((m) => ({
                userId: m.userId,
                email: state.users.find((u) => u.id === m.userId)?.email || "",
                role: m.role,
              })),
          );
        }
        if (action === "pos" && req.method === "GET")
          return reply(
            res,
            200,
            state.posPoints
              .filter((p) => p.restaurantId === id)
              .map(({ pinHash: _pinHash, ...p }) => p),
          );
        if (action === "invitations" && req.method === "POST") {
          const role = body.role === undefined ? "manager" : body.role;
          if (!["manager", "admin"].includes(role))
            fail(
              400,
              "VALIDATION",
              "Можно пригласить менеджера или администратора",
            );
          if (role === "admin" && membership.role !== "owner")
            fail(
              403,
              "FORBIDDEN",
              "Пригласить администратора может только владелец",
            );
          const email = String(body.email || "")
            .trim()
            .toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            fail(400, "VALIDATION", "Неверный email");
          const invited = state.users.find((u) => u.email === email);
          if (
            invited &&
            state.memberships.some(
              (m) => m.userId === invited.id && m.restaurantId === id,
            )
          )
            fail(409, "ALREADY_MEMBER", "Пользователь уже в ресторане");
          const invitation = {
            invitationId: randomUUID(),
            code: randomBytes(12).toString("hex"),
            restaurantId: id,
            email,
            role,
            expiresAt: new Date(now() + 604800000).toISOString(),
            accepted: false,
          };
          transaction((s) => {
            s.invitations.push(invitation);
          });
          console.log(
            "[DEMO] Приглашение для " + email + ": /invite/" + invitation.code,
          );
          return reply(res, 200, { message: "Приглашение создано" });
        }
      }
      if (path === "/api/invitation/accept" && req.method === "POST") {
        const invitation = state.invitations.find((i) => i.code === body.code);
        if (!invitation || Date.parse(invitation.expiresAt) <= now())
          fail(404, "INVALID_INVITE", "Приглашение не найдено или истекло");
        if (invitation.email !== user.email)
          fail(403, "INVITE_EMAIL", "Приглашение предназначено другому email");
        if (!invitation.accepted)
          transaction((s) => {
            const i = s.invitations.find((v) => v.code === body.code);
            if (
              !s.memberships.some(
                (m) =>
                  m.userId === user.id && m.restaurantId === i.restaurantId,
              )
            )
              s.memberships.push({
                userId: user.id,
                restaurantId: i.restaurantId,
                role: i.role,
              });
            i.accepted = true;
          });
        return reply(res, 200, {
          restaurantId: invitation.restaurantId,
          name: restaurantOf(state, invitation.restaurantId).name,
          role: membershipOf(state, user.id, invitation.restaurantId).role,
        });
      }
      if (path === "/api/restaurant/createpos" && req.method === "POST") {
        restaurantOf(state, body.restaurantId);
        membershipOf(state, user.id, body.restaurantId, ADMIN);
        if (!/^\d{4,8}$/.test(String(body.pincode)))
          fail(400, "VALIDATION", "PIN: 4–8 цифр");
        if (
          state.posPoints.some(
            (p) =>
              p.restaurantId === body.restaurantId &&
              verifyHash(body.pincode, p.pinHash),
          )
        )
          fail(409, "PIN_EXISTS", "Этот PIN уже используется кассой ресторана");
        const point = {
          posId: randomUUID(),
          restaurantId: body.restaurantId,
          name:
            "Касса " +
            (state.posPoints.filter((p) => p.restaurantId === body.restaurantId)
              .length +
              1),
          status: "active",
          createdAt: new Date(now()).toISOString(),
          pinHash: hash(body.pincode),
        };
        transaction((s) => {
          s.posPoints.push(point);
        });
        const { pinHash: _pinHash, ...result } = point;
        return reply(res, 200, { ...result, message: "Касса создана" });
      }
      match = path.match(/^\/api\/restaurant\/([^/]+)$/);
      if (match && req.method === "DELETE") {
        const id = match[1];
        restaurantOf(state, id);
        membershipOf(state, user.id, id, ["owner"]);
        transaction((s) => {
          s.restaurants = s.restaurants.filter((r) => r.id !== id);
          s.memberships = s.memberships.filter((m) => m.restaurantId !== id);
          s.invitations = s.invitations.filter((i) => i.restaurantId !== id);
          s.posPoints = s.posPoints.filter((p) => p.restaurantId !== id);
        });
        return reply(res, 200, { message: "Ресторан удалён" });
      }
      match = path.match(/^\/api\/supply\/([^/]+)\/(accept|reject)$/);
      if (match && req.method === "POST") {
        const r = state.restaurants.find((r) =>
          r.supplies.some((s) => s.supplyId === match[1]),
        );
        if (!r) fail(404, "NOT_FOUND", "Поставка не найдена");
        membershipOf(state, user.id, r.id);
        if (body.restaurantId !== r.id)
          fail(403, "FORBIDDEN", "Поставка относится к другому ресторану");
        return reply(
          res,
          200,
          transaction((s) =>
            decideSupply(
              restaurantOf(s, r.id),
              match[1],
              match[2] === "accept" ? "accepted" : "rejected",
              domainNow(s, now()),
            ),
          ),
        );
      }
      match = path.match(/^\/api\/demo\/([^/]+)\/(supply|order|advance-time)$/);
      if (match && req.method === "POST") {
        const [, id, action] = match;
        restaurantOf(state, id);
        membershipOf(state, user.id, id);
        if (action === "advance-time") {
          const hours = Number(body.hours);
          if (!Number.isFinite(hours) || hours <= 0 || hours > 168)
            fail(400, "VALIDATION", "Сдвиг времени: 0–168 часов");
          transaction((s) => {
            s.clockOffsetMs += hours * 3600000;
            for (const r of s.restaurants) r.revision += 1;
          });
          return reply(res, 200, { message: "Демо-время изменено" });
        }
        if (action === "supply")
          return reply(
            res,
            200,
            transaction((s) =>
              createSupply(restaurantOf(s, id), body, domainNow(s, now())),
            ),
          );
        const key = String(req.headers["idempotency-key"] || "");
        if (!key || key.length > 100)
          fail(400, "IDEMPOTENCY_KEY", "Нужен Idempotency-Key");
        const scoped = user.id + ":" + id + ":" + key;
        const digest = createHash("sha256")
          .update(JSON.stringify(body))
          .digest("hex");
        const previous = state.idempotency[scoped];
        if (previous) {
          if (previous.digest !== digest)
            fail(409, "KEY_REUSED", "Этот ключ использован для другого заказа");
          return reply(res, 200, previous.result);
        }
        return reply(
          res,
          200,
          transaction((s) => {
            const result = makeOrder(
              restaurantOf(s, id),
              body,
              domainNow(s, now()),
            );
            s.idempotency[scoped] = { digest, result };
            return result;
          }),
        );
      }
      fail(404, "ENDPOINT_MISSING", "Метод не найден");
    } catch (error) {
      if (!(error instanceof DomainError)) console.error(error);
      reply(res, error.status || 500, {
        code: error.code || "INTERNAL",
        message: error.status ? error.message : "Ошибка демо-сервера",
        details: error.details,
      });
    }
  });
  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (
        url.pathname !== "/ws/restaurants" ||
        (req.headers.origin && !origins.has(req.headers.origin))
      )
        fail(403, "FORBIDDEN", "Forbidden");
      const token = url.searchParams.get("access_token");
      const user = tokenUser(token);
      const restaurantId = url.searchParams.get("restaurantId");
      membershipOf(state, user.id, restaurantId);
      restaurantOf(state, restaurantId);
      if (!req.headers["sec-websocket-key"])
        fail(400, "VALIDATION", "Missing key");
      const accept = createHash("sha1")
        .update(
          req.headers["sec-websocket-key"] +
            "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
        )
        .digest("base64");
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
          accept +
          "\r\n\r\n",
      );
      const client = { socket, token, restaurantId };
      clients.add(client);
      socket.on("close", () => clients.delete(client));
      socket.on("error", () => clients.delete(client));
      let buffer = head;
      const consume = () => {
        while (buffer.length >= 2) {
          const opcode = buffer[0] & 15;
          let length = buffer[1] & 127;
          let start = 2;
          if (length === 126) {
            if (buffer.length < 4) return;
            length = buffer.readUInt16BE(2);
            start = 4;
          }
          if (length === 127 || length > 4096 || !(buffer[1] & 128))
            return socket.destroy();
          if (buffer.length < start + 4 + length) return;
          const mask = buffer.subarray(start, start + 4);
          start += 4;
          const data = Buffer.from(buffer.subarray(start, start + length));
          for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
          buffer = buffer.subarray(start + length);
          if (opcode === 8) {
            sendFrame(socket, data, 8);
            return socket.end();
          }
          if (opcode === 9) sendFrame(socket, data, 10);
        }
      };
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        consume();
      });
      consume();
      sendFrame(
        socket,
        JSON.stringify({
          type: "restaurant.snapshot",
          data: snapshot(restaurantOf(state, restaurantId), state, now()),
        }),
      );
    } catch (error) {
      socket.end(
        "HTTP/1.1 " +
          (error.status || 400) +
          " Error\r\nConnection: close\r\n\r\n",
      );
    }
  });
  let lastBucket = Math.floor(domainNow(state, now()) / 60000);
  let lastExpiry = "";
  const timer = setInterval(() => {
    const time = domainNow(state, now());
    const bucket = Math.floor(time / 60000);
    const expiry = state.restaurants
      .flatMap((r) =>
        r.batches
          .filter((b) => b.quantity > 0 && Date.parse(b.expiresAt) <= time)
          .map((b) => b.batchId),
      )
      .sort()
      .join(",");
    if (bucket !== lastBucket || expiry !== lastExpiry) {
      lastBucket = bucket;
      lastExpiry = expiry;
      for (const r of state.restaurants) r.revision += 1;
      persist();
      broadcast();
    }
  }, 1000);
  timer.unref();
  server.on("close", () => {
    clearInterval(timer);
    for (const c of clients) c.socket.destroy();
  });
  persist();
  return {
    server,
    getState: () => structuredClone(state),
    close: async () => {
      clearInterval(timer);
      for (const c of clients) c.socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.DEMO_PORT || 5068);
  const app = createDemoServer({
    filename: resolve(process.env.DEMO_DATA_FILE || ".demo-data/store.json"),
    accessTtlSeconds: Number(process.env.DEMO_ACCESS_TTL_SECONDS || 300),
    origins: (
      process.env.DEMO_ALLOWED_ORIGINS ||
      "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
  });
  app.server.listen(port, "127.0.0.1", () => {
    console.log("[DEMO] HTTP/WebSocket: http://127.0.0.1:" + port);
    console.log(
      "[DEMO] owner@demo.test / admin@demo.test / manager@demo.test; пароль Demo123!",
    );
  });
}
