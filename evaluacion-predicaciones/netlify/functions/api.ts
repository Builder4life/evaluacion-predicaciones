import { randomInt, randomUUID } from "node:crypto";
import {
  authenticate,
  cookie,
  equal,
  issue,
  publicUser,
  users,
} from "./lib/auth";
import {
  HttpError,
  averages,
  evaluation,
  previous,
  quarter,
  text,
  today,
  validDate,
  windowFor,
} from "./lib/domain";
import { storage, type Storage } from "./lib/storage";
import { keys, type Evaluation, type Sermon } from "../../shared/model";
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
function shuffle<T>(input: T[]): T[] {
  const list = [...input];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
async function body(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Se requiere contenido JSON.");
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 12000)
    throw new HttpError(413, "La solicitud es demasiado larga.");
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw 0;
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "La solicitud no es válida.");
  }
}
export function createHandler(db: Storage) {
  return async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const action = url.searchParams.get("action") || "session";
      if (!["GET", "POST", "PUT", "DELETE"].includes(req.method))
        throw new HttpError(405, "Método no permitido.");
      if (req.method !== "GET") {
        const origin = req.headers.get("origin");
        if (
          origin !== url.origin ||
          req.headers.get("sec-fetch-site") === "cross-site"
        )
          throw new HttpError(
            403,
            "La solicitud debe proceder de esta aplicación.",
          );
      }
      if (action === "users" && req.method === "GET")
        return json({ usuarios: users().map(publicUser) });
      if (action === "login" && req.method === "POST") {
        const b = await body(req);
        if (
          typeof b.id !== "string" ||
          typeof b.pin !== "string" ||
          !/^\d{6}$/.test(b.pin)
        )
          throw new HttpError(400, "Escribe un PIN de seis dígitos.");
        const u = users().find((u) => u.id === b.id);
        if (!u)
          throw new HttpError(401, "El nombre o el PIN no son correctos.");
        const slot = await db.reserve(u.id, Date.now());
        if (!slot)
          return json(
            {
              error:
                "Se alcanzó el límite de cinco intentos. Espera 15 minutos e inténtalo de nuevo.",
            },
            429,
            { "Retry-After": "900" },
          );
        if (!equal(b.pin, u.pin))
          throw new HttpError(401, "El PIN no es correcto.");
        const token = issue(u);
        await db.release(slot);
        return json({ usuario: publicUser(u) }, 200, {
          "Set-Cookie": cookie(token),
        });
      }
      const user = authenticate(req);
      const allUsers = users();
      const requireAdmin = () => {
        if (!user.admin)
          throw new HttpError(403, "Esta acción corresponde al administrador.");
      };
      const getSermon = async () => {
        const id = url.searchParams.get("id") || "";
        if (!/^[\w-]{1,80}$/.test(id))
          throw new HttpError(400, "La predicación no es válida.");
        const s = await db.get<Sermon>("predicaciones", id);
        if (!s || s.eliminada)
          throw new HttpError(404, "No se encontró esta predicación.");
        return s;
      };
      const getEvaluations = async (s: Sermon) =>
        Promise.all(
          allUsers.map(async (u) => ({
            id: u.id,
            data: await db.get<Evaluation>("evaluaciones", `${s.id}:${u.id}`),
          })),
        );
      if (action === "session" && req.method === "GET")
        return json({ usuario: publicUser(user), hoy: today() });
      if (action === "logout" && req.method === "POST")
        return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
      if (action === "sermons" && req.method === "GET") {
        const sermons = (await db.list<Sermon>("predicaciones"))
          .map((e) => e.data)
          .filter((s) => !s.eliminada)
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
        const result = await Promise.all(
          sermons.map(async (s) => {
            const es = await getEvaluations(s);
            const mine = es.find((e) => e.id === user.id)?.data;
            const ready =
              s.predicador_id === user.id &&
              es.filter((e) => e.id !== s.predicador_id && e.data).length >= 2;
            return {
              ...s,
              ...windowFor(s),
              estado: ready
                ? "Reporte listo"
                : mine
                  ? "Evaluada"
                  : "Por evaluar",
              reporte_listo: ready,
              evaluada_por_mi: !!mine,
              ...(user.admin
                ? { completadas: es.filter((e) => e.data).map((e) => e.id) }
                : {}),
            };
          }),
        );
        return json({ predicaciones: result });
      }
      if (action === "sermons" && req.method === "POST") {
        const b = await body(req);
        const s = validateSermon(
          b,
          allUsers.map((u) => u.id),
        );
        const id = randomUUID();
        const data = { ...s, id, creada_por: user.id };
        await db.put("predicaciones", id, data);
        return json({ predicacion: data }, 201);
      }
      if (action === "sermon" && ["PUT", "DELETE"].includes(req.method)) {
        requireAdmin();
        const s = await getSermon();
        if (req.method === "DELETE") {
          // Una lápida mantiene inaccesibles los datos incluso ante escrituras concurrentes.
          await db.put("predicaciones", s.id, { ...s, eliminada: true });
          return json({ ok: true });
        }
        const b = await body(req);
        const updated = validateSermon(
          b,
          allUsers.map((u) => u.id),
        );
        if (
          updated.predicador_id !== s.predicador_id &&
          (await getEvaluations(s)).some((e) => e.data)
        )
          throw new HttpError(
            409,
            "Ya hay evaluaciones. Conserva el predicador o elimina y vuelve a crear la predicación.",
          );
        await db.put("predicaciones", s.id, {
          ...s,
          ...updated,
          minutos: updated.minutos,
        });
        return json({ ok: true });
      }
      if (action === "reopen" && req.method === "POST") {
        requireAdmin();
        const s = await getSermon();
        await db.put("predicaciones", s.id, {
          ...s,
          reabierta_hasta: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
        return json({ ok: true });
      }
      if (action === "evaluation" && ["GET", "PUT"].includes(req.method)) {
        const s = await getSermon();
        const key = `${s.id}:${user.id}`;
        const old = await db.get<Evaluation>("evaluaciones", key);
        if (req.method === "GET")
          return json({ evaluacion: old, ...windowFor(s) });
        if (!windowFor(s).editable)
          throw new HttpError(
            403,
            "El período para evaluar está cerrado. Solicita la reapertura al administrador.",
          );
        const data = evaluation(await body(req), old);
        await db.put("evaluaciones", key, data);
        return json({ ok: true });
      }
      if (action === "report" && req.method === "GET") {
        const s = await getSermon();
        if (s.predicador_id !== user.id)
          throw new HttpError(
            403,
            "Solo quien predicó puede consultar este reporte.",
          );
        const es = await getEvaluations(s);
        const others = es
          .filter((e) => e.id !== user.id && e.data)
          .map((e) => e.data!);
        if (others.length < 2)
          throw new HttpError(
            409,
            "El reporte estará disponible cuando al menos dos compañeros hayan evaluado.",
          );
        const own = es.find((e) => e.id === user.id)?.data;
        return json({
          predicacion: s,
          predicador: user.nombre,
          promedios: averages(others),
          autoevaluacion: own ? keys.map((k) => own[k]) : keys.map(() => null),
          cantidad: others.length,
          lo_que_mas_ayudo: shuffle(others.map((e) => e.lo_que_mas_ayudo)),
          un_ajuste: shuffle(others.map((e) => e.un_ajuste)),
        });
      }
      if (action === "patterns" && req.method === "GET") {
        const q = url.searchParams.get("quarter") || quarter(today());
        if (!/^20\d{2}-T[1-4]$/.test(q))
          throw new HttpError(400, "El trimestre no es válido.");
        const prev = previous(q);
        const sermons = (await db.list<Sermon>("predicaciones"))
          .map((e) => e.data)
          .filter((s) => !s.eliminada && [q, prev].includes(quarter(s.fecha)));
        // Solo mensajes con dos evaluaciones externas. La unidad del promedio es
        // la predicación: cada mensaje pesa lo mismo, tenga dos o tres evaluadores.
        const rows = await Promise.all(
          sermons.map(async (s) => {
            const es = (await getEvaluations(s))
              .filter((e) => e.id !== s.predicador_id && e.data)
              .map((e) => e.data!);
            return { s, n: es.length, avg: averages(es) };
          }),
        );
        const eligible = rows.filter((r) => r.n >= 2);
        const mean = (rs: typeof rows) =>
          keys.map((_, i) =>
            rs.length
              ? rs.reduce((n, r) => n + r.avg[i]!, 0) / rs.length
              : null,
          );
        const current = eligible.filter((r) => quarter(r.s.fecha) === q);
        const team = mean(current);
        const prior = mean(eligible.filter((r) => quarter(r.s.fecha) === prev));
        return json({
          trimestre: q,
          anterior: prev,
          equipo: team,
          cambio: team.map((v, i) =>
            v !== null && prior[i] !== null ? v - prior[i]! : null,
          ),
          propios: mean(current.filter((r) => r.s.predicador_id === user.id)),
          cantidad: current.length,
        });
      }
      throw new HttpError(404, "Esta operación no está disponible.");
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      return json(
        {
          error:
            "No se pudo completar la operación. Inténtalo de nuevo en unos momentos.",
        },
        503,
      );
    }
  };
}
function validateSermon(b: Record<string, unknown>, ids: string[]) {
  if (typeof b.predicador_id !== "string" || !ids.includes(b.predicador_id))
    throw new HttpError(400, "Selecciona un predicador válido.");
  if (
    b.minutos !== undefined &&
    (!Number.isInteger(b.minutos) ||
      Number(b.minutos) < 1 ||
      Number(b.minutos) > 300)
  )
    throw new HttpError(
      400,
      "El tiempo debe ser un número entero entre 1 y 300 minutos.",
    );
  return {
    fecha: validDate(b.fecha),
    predicador_id: b.predicador_id,
    titulo: text(b.titulo, 140, "Título"),
    pasaje: text(b.pasaje, 160, "Pasaje"),
    ...(b.minutos === undefined ? {} : { minutos: Number(b.minutos) }),
  };
}
export default createHandler(storage);
