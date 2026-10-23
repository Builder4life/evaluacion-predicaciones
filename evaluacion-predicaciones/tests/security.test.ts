import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../netlify/functions/api";
import { type Storage } from "../netlify/functions/lib/storage";
import {
  authenticate,
  issue,
  users,
  cookie,
} from "../netlify/functions/lib/auth";
import {
  validDate,
  windowFor,
  evaluation,
  previous,
} from "../netlify/functions/lib/domain";
import { type Sermon, type Evaluation } from "../shared/model";
process.env.JWT_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
process.env.APP_TIMEZONE = "America/New_York";
process.env.APP_USERS = JSON.stringify(
  Array.from({ length: 4 }, (_, i) => ({
    id: `u${i + 1}`,
    nombre: `Persona ${i + 1}`,
    pin: `12345${i + 1}`,
    admin: i === 0,
  })),
);
class Memory implements Storage {
  data = new Map<string, unknown>();
  slots = new Map<string, number>();
  async get<T>(store: string, key: string) {
    return (this.data.get(`${store}/${key}`) || null) as T | null;
  }
  async put(store: string, key: string, data: unknown) {
    this.data.set(`${store}/${key}`, data);
  }
  async list<T>(store: string, prefix = "") {
    return [...this.data.entries()]
      .filter(([k]) => k.startsWith(store + "/" + prefix))
      .map(([k, data]) => ({
        key: k.slice(store.length + 1),
        data: data as T,
      }));
  }
  async reserve(user: string, now: number) {
    for (let i = 0; i < 5; i++) {
      const key = user + ":" + i;
      if ((this.slots.get(key) || 0) > now) continue;
      this.slots.set(key, now + 900000);
      return key;
    }
    return null;
  }
  async release(key: string) {
    this.slots.delete(key);
  }
}
let db: Memory;
let handler: ReturnType<typeof createHandler>;
beforeEach(() => {
  db = new Memory();
  handler = createHandler(db);
});
const s: Sermon = {
  id: "sermon1",
  fecha: new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date()),
  predicador_id: "u2",
  titulo: "Mensaje de prueba",
  pasaje: "Efesios 2:1–10",
  creada_por: "u1",
};
const ev: Evaluation = {
  c1: 4,
  c2: 3,
  c3: 2,
  c4: 1,
  c5: 4,
  c6: 3,
  c7: 2,
  lo_que_mas_ayudo: "Una explicación clara.",
  un_ajuste: "Una pausa al concluir.",
  creada_en: "2026-01-01",
  actualizada_en: "2026-01-01",
};
function request(
  action: string,
  userId?: string,
  method = "GET",
  body?: unknown,
  id = "sermon1",
) {
  const u = users().find((u) => u.id === userId);
  return new Request(
    `https://test.netlify.app/.netlify/functions/api?action=${action}&id=${id}`,
    {
      method,
      headers: {
        ...(u ? { cookie: cookie(issue(u)).split(";")[0] } : {}),
        origin: "https://test.netlify.app",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
}
async function seed(n = 2) {
  await db.put("predicaciones", s.id, s);
  for (const id of ["u1", "u3", "u4"].slice(0, n))
    await db.put("evaluaciones", `${s.id}:${id}`, ev);
}
test("Solo lista nombres y roles: ningún PIN sale del servidor", async () => {
  const response = await handler(request("users"));
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes("pin"));
});
test("Todas las operaciones privadas requieren cookie, incluso logout", async () => {
  for (const a of [
    "session",
    "sermons",
    "evaluation",
    "report",
    "patterns",
    "reopen",
    "sermon",
    "logout",
  ])
    assert.equal((await handler(request(a))).status, 401, a);
});
test("PIN incorrecto cinco veces: sexto intento bloqueado aun siendo correcto", async () => {
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await handler(
          request("login", undefined, "POST", { id: "u2", pin: "000000" }),
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await handler(
        request("login", undefined, "POST", { id: "u2", pin: "123452" }),
      )
    ).status,
    429,
  );
});
test("Intentos simultáneos reservan solo cinco plazas", async () => {
  const responses = await Promise.all(
    Array.from({ length: 12 }, () =>
      handler(request("login", undefined, "POST", { id: "u2", pin: "000000" })),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 401).length, 5);
  assert.equal(responses.filter((r) => r.status === 429).length, 7);
});
test("Bloqueo expira después de quince minutos y es por usuario", async () => {
  for (let i = 0; i < 5; i++) await db.reserve("u2", Date.now() - 900001);
  assert.equal(
    (
      await handler(
        request("login", undefined, "POST", { id: "u2", pin: "123452" }),
      )
    ).status,
    200,
  );
  for (let i = 0; i < 5; i++) await db.reserve("u2", Date.now());
  assert.equal(
    (
      await handler(
        request("login", undefined, "POST", { id: "u3", pin: "123453" }),
      )
    ).status,
    200,
  );
});
test("Sesión segura por treinta días; firma manipulada se rechaza", async () => {
  const r = await handler(
    request("login", undefined, "POST", { id: "u1", pin: "123451" }),
  );
  const c = r.headers.get("set-cookie")!;
  for (const flag of [
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=2592000",
  ])
    assert.ok(c.includes(flag));
  const bad = new Request("https://test.netlify.app/", {
    headers: { cookie: c.replace(/vr_session=./, "vr_session=X") },
  });
  assert.throws(() => authenticate(bad));
});
test("Cambiar el PIN invalida las sesiones anteriores", () => {
  const token = issue(users()[0]);
  const old = process.env.APP_USERS!;
  process.env.APP_USERS = old.replace("123451", "654321");
  assert.throws(() =>
    authenticate(
      new Request("https://test.netlify.app/", {
        headers: { cookie: cookie(token) },
      }),
    ),
  );
  process.env.APP_USERS = old;
});
test("El administrador nunca puede leer el reporte ajeno", async () => {
  await seed();
  assert.equal((await handler(request("report", "u1"))).status, 403);
  assert.equal((await handler(request("report", "u3"))).status, 403);
});
test("Reporte requiere dos compañeros y omite identificadores", async () => {
  await seed(1);
  assert.equal((await handler(request("report", "u2"))).status, 409);
  await db.put("evaluaciones", "sermon1:u3", ev);
  const r = await handler(request("report", "u2"));
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.cantidad, 2);
  assert.deepEqual(data.promedios, [4, 3, 2, 1, 4, 3, 2]);
  assert.deepEqual(data.autoevaluacion, [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  assert.ok(!JSON.stringify(data).includes("evaluador"));
  assert.ok(!JSON.stringify(data).includes("creada_en"));
});
test("Cada usuario lee solo su evaluación y no puede falsificar su id", async () => {
  await seed();
  const response = await handler(request("evaluation", "u4"));
  assert.equal((await response.json()).evaluacion, null);
  await handler(
    request("evaluation", "u4", "PUT", { ...ev, evaluador_id: "u1" }),
  );
  assert.deepEqual(await db.get("evaluaciones", "sermon1:u1"), ev);
  assert.ok(await db.get("evaluaciones", "sermon1:u4"));
});
test("Inicio del admin entrega estados pero nunca comentarios ni puntuaciones", async () => {
  await seed();
  const r = await handler(request("sermons", "u1"));
  const data = await r.json();
  assert.deepEqual(data.predicaciones[0].completadas, ["u1", "u3"]);
  const raw = JSON.stringify(data);
  assert.ok(!raw.includes("lo_que_mas_ayudo"));
  assert.ok(!raw.includes("c1"));
  const normal = await handler(request("sermons", "u2"));
  assert.ok(!JSON.stringify(await normal.json()).includes("completadas"));
});
test("Solo el admin reabre, edita y elimina", async () => {
  await seed();
  for (const [a, m] of [
    ["reopen", "POST"],
    ["sermon", "PUT"],
    ["sermon", "DELETE"],
  ])
    assert.equal((await handler(request(a, "u2", m, {}))).status, 403);
});
test("Cierre a siete días, reapertura y predicaciones futuras", async () => {
  await db.put("predicaciones", s.id, { ...s, fecha: "2020-01-01" });
  assert.equal(
    (await handler(request("evaluation", "u2", "PUT", ev))).status,
    403,
  );
  assert.equal((await handler(request("reopen", "u1", "POST"))).status, 200);
  assert.equal(
    (await handler(request("evaluation", "u2", "PUT", ev))).status,
    200,
  );
  assert.equal(windowFor({ ...s, fecha: "2099-01-01" }).editable, false);
  assert.equal(
    windowFor({ ...s, fecha: "2026-01-01" }, new Date("2026-01-09T12:00:00Z"))
      .editable,
    false,
  );
  assert.equal(
    windowFor({ ...s, fecha: "2026-01-01" }, new Date("2026-01-08T23:00:00Z"))
      .editable,
    true,
  );
});
test("Servidor valida rangos, fechas, líneas y límites de texto", async () => {
  assert.throws(() => validDate("2026-02-30"));
  assert.throws(() => validDate("bad"));
  for (const v of [0, 5, 1.5, "4", null])
    assert.throws(() => evaluation({ ...ev, c1: v }, null));
  assert.throws(() => evaluation({ ...ev, un_ajuste: "x".repeat(181) }, null));
  assert.throws(() => evaluation({ ...ev, un_ajuste: "a\nb" }, null));
  assert.equal(
    (await handler(request("sermons", "u1", "POST", { ...s, minutos: 301 })))
      .status,
    400,
  );
});
test("No se puede cambiar el predicador tras recibir evaluaciones", async () => {
  await seed();
  assert.equal(
    (
      await handler(
        request("sermon", "u1", "PUT", { ...s, predicador_id: "u3" }),
      )
    ).status,
    409,
  );
});
test("Eliminación deja el mensaje inaccesible y fuera de promedios", async () => {
  await seed();
  assert.equal((await handler(request("sermon", "u1", "DELETE"))).status, 200);
  assert.equal((await handler(request("report", "u2"))).status, 404);
  assert.equal((await handler(request("evaluation", "u1"))).status, 404);
  assert.deepEqual(
    (await (await handler(request("sermons", "u1"))).json()).predicaciones,
    [],
  );
});
test("Promedios del trimestre sin comentarios, sin autoevaluaciones y mismo peso por mensaje", async () => {
  await seed();
  await db.put("evaluaciones", "sermon1:u2", { ...ev, c1: 1 });
  const second = { ...s, id: "sermon2" };
  await db.put("predicaciones", "sermon2", second);
  for (const id of ["u1", "u3", "u4"])
    await db.put("evaluaciones", `sermon2:${id}`, { ...ev, c1: 2 });
  const r = await handler(request("patterns", "u2"));
  const data = await r.json();
  assert.equal(data.equipo[0], 3);
  assert.equal(data.propios[0], 3);
  assert.equal(data.cantidad, 2);
  assert.ok(!JSON.stringify(data).includes("Una pausa"));
  assert.ok(!JSON.stringify(data).includes("u1"));
  assert.equal(previous("2026-T1"), "2025-T4");
});
test("Solicitudes de escritura de otro origen se rechazan", async () => {
  const r = new Request(
    "https://test.netlify.app/.netlify/functions/api?action=login",
    {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "u1", pin: "123451" }),
    },
  );
  assert.equal((await handler(r)).status, 403);
});

test("Permite añadir participantes y conserva un único administrador", () => {
  const original = process.env.APP_USERS!;
  try {
    const config = JSON.parse(original);
    config.push({
      id: "u5",
      nombre: "Participante adicional",
      pin: "654321",
      admin: false,
    });
    process.env.APP_USERS = JSON.stringify(config);
    assert.equal(users().length, 5);
    config[4].admin = true;
    process.env.APP_USERS = JSON.stringify(config);
    assert.throws(() => users());
  } finally {
    process.env.APP_USERS = original;
  }
});
