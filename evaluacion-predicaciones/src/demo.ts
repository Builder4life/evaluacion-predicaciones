// Solo se importa con import.meta.env.DEV. Nunca hay una recuperación a este modo
// después de iniciar una sesión real. Los datos desaparecen al recargar.
// Implementación de muestra independiente del servidor.
const quarter = (d: string) =>
  `${d.slice(0, 4)}-T${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const previous = (q: string) => {
  const [y, t] = q.split("-T").map(Number);
  return t === 1 ? `${y - 1}-T4` : `${y}-T${t - 1}`;
};
const averages = (es: Evaluation[]) =>
  keys.map((k) =>
    es.length ? es.reduce((n, e) => n + e[k], 0) / es.length : null,
  );
const windowFor = (s: Sermon) => {
  const remaining = Math.floor(
    (Date.parse(s.fecha + "T00:00:00Z") +
      7 * 86400000 -
      Date.parse(new Date().toLocaleDateString("en-CA") + "T00:00:00Z")) /
      86400000,
  );
  return {
    editable: remaining >= 0 || !!s.reabierta_hasta,
    dias_restantes: Math.max(0, remaining),
  };
};
const evaluation = (b: Evaluation, old: Evaluation | null): Evaluation => ({
  ...b,
  creada_en: old?.creada_en || new Date().toISOString(),
  actualizada_en: new Date().toISOString(),
});
import { keys, type Sermon, type Evaluation, type User } from "../shared/model";
const usuarios: User[] = Array.from({ length: 4 }, (_, i) => ({
  id: `u${i + 1}`,
  nombre: [
    "Tommy · demostración",
    "Samuel · demostración",
    "David · demostración",
    "Luis · demostración",
  ][i],
  admin: i === 0,
}));
let user: User | undefined;
const date = new Date().toLocaleDateString("en-CA");
let sermons: Sermon[] = [
  {
    id: "demo1",
    fecha: date,
    predicador_id: "u1",
    titulo: "La gracia que nos enseña a vivir",
    pasaje: "Tito 2:11–14",
    minutos: 44,
    creada_por: "u1",
  },
  {
    id: "demo2",
    fecha: date,
    predicador_id: "u2",
    titulo: "Una vida arraigada en Cristo",
    pasaje: "Colosenses 2:6–7",
    minutos: 46,
    creada_por: "u1",
  },
];
const es: Record<string, Evaluation> = {};
for (const id of ["u2", "u3"])
  es[`demo1:${id}`] = {
    c1: 4,
    c2: 4,
    c3: 3,
    c4: 3,
    c5: 4,
    c6: 3,
    c7: 4,
    lo_que_mas_ayudo:
      id === "u2"
        ? "La explicación del pasaje fue cercana y clara."
        : "Relacionar la gracia con la vida cotidiana.",
    un_ajuste:
      id === "u2"
        ? "Dejar una pausa después de la idea central."
        : "Reducir la introducción para ampliar la aplicación.",
    creada_en: new Date().toISOString(),
    actualizada_en: new Date().toISOString(),
  };
export async function demo(action: string, o: any = {}): Promise<any> {
  if (action === "users") return { usuarios };
  if (action === "demo-enter") {
    user = usuarios[0];
    return { usuario: user };
  }
  if (action === "login") {
    if (!/^\d{6}$/.test(o.body.pin))
      throw new Error("Usa seis dígitos de prueba.");
    user = usuarios.find((u) => u.id === o.body.id);
    return { usuario: user };
  }
  if (action === "session") return { usuario: user };
  if (!user) throw new Error("Inicia sesión en la demostración.");
  if (action === "logout") {
    user = undefined;
    return { ok: true };
  }
  const s = sermons.find((s) => s.id === o.id);
  const external = (s: Sermon) =>
    usuarios
      .filter((u) => u.id !== s.predicador_id)
      .map((u) => es[`${s.id}:${u.id}`])
      .filter(Boolean);
  if (action === "sermons" && !o.method)
    return {
      predicaciones: sermons.map((s) => ({
        ...s,
        ...windowFor(s),
        estado:
          s.predicador_id === user!.id && external(s).length >= 2
            ? "Reporte listo"
            : es[`${s.id}:${user!.id}`]
              ? "Evaluada"
              : "Por evaluar",
        reporte_listo: s.predicador_id === user!.id && external(s).length >= 2,
        evaluada_por_mi: !!es[`${s.id}:${user!.id}`],
        ...(user!.admin
          ? {
              completadas: usuarios
                .filter((u) => es[`${s.id}:${u.id}`])
                .map((u) => u.id),
            }
          : {}),
      })),
    };
  if (action === "sermons" && o.method === "POST") {
    sermons.unshift({
      ...o.body,
      id: crypto.randomUUID(),
      creada_por: user.id,
    });
    return { ok: true };
  }
  if (action === "patterns") {
    const q = o.quarter || quarter(date);
    const current = sermons.filter(
      (s) => quarter(s.fecha) === q && external(s).length >= 2,
    );
    const avg = (ss: Sermon[]) =>
      keys.map((_, i) =>
        ss.length
          ? ss.reduce((n, s) => n + averages(external(s))[i]!, 0) / ss.length
          : null,
      );
    return {
      trimestre: q,
      anterior: previous(q),
      equipo: avg(current),
      propios: avg(current.filter((s) => s.predicador_id === user!.id)),
      cambio: keys.map(() => null),
      cantidad: current.length,
    };
  }
  if (!s) throw new Error("Predicación no encontrada.");
  if (action === "evaluation") {
    if (o.method === "PUT") {
      es[`${s.id}:${user.id}`] = evaluation(
        o.body,
        es[`${s.id}:${user.id}`] || null,
      );
      return { ok: true };
    }
    return { evaluacion: es[`${s.id}:${user.id}`] || null, ...windowFor(s) };
  }
  if (action === "report") {
    if (s.predicador_id !== user.id || external(s).length < 2)
      throw new Error("Reporte no disponible.");
    return {
      predicacion: s,
      predicador: user.nombre,
      promedios: averages(external(s)),
      autoevaluacion: keys.map((k) => es[`${s.id}:${user!.id}`]?.[k] ?? null),
      cantidad: external(s).length,
      lo_que_mas_ayudo: external(s).map((e) => e.lo_que_mas_ayudo),
      un_ajuste: external(s).map((e) => e.un_ajuste),
    };
  }
  if (!user.admin) throw new Error("Acceso restringido.");
  if (action === "reopen") {
    s.reabierta_hasta = new Date(Date.now() + 7 * 86400000).toISOString();
    return { ok: true };
  }
  if (action === "sermon") {
    if (o.method === "DELETE") sermons = sermons.filter((x) => x.id !== s.id);
    else Object.assign(s, o.body);
    return { ok: true };
  }
  throw new Error("Operación no disponible.");
}
