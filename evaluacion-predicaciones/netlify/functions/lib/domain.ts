import { keys, type Evaluation, type Sermon } from "../../../shared/model";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function text(
  value: unknown,
  max: number,
  label: string,
  required = true,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim()) ||
    /[\r\n\x00-\x08]/.test(value)
  )
    throw new HttpError(
      400,
      `${label}: revisa el texto (máximo ${max} caracteres, una línea).`,
    );
  return value.trim();
}
export function validDate(x: unknown): string {
  if (
    typeof x !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
    !Number.isFinite(Date.parse(x + "T00:00:00Z")) ||
    new Date(x + "T00:00:00Z").toISOString().slice(0, 10) !== x ||
    x < "2000-01-01" ||
    x > "2100-12-31"
  )
    throw new HttpError(400, "La fecha no es válida.");
  return x;
}
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function windowFor(s: Sermon, now = new Date()) {
  const days = Math.floor(
    (Date.parse(s.fecha + "T00:00:00Z") +
      7 * 86400000 -
      Date.parse(today(now) + "T00:00:00Z")) /
      86400000,
  );
  const reopened =
    !!s.reabierta_hasta && Date.parse(s.reabierta_hasta) > now.getTime();
  return {
    editable: today(now) >= s.fecha && (days >= 0 || reopened),
    dias_restantes: reopened
      ? Math.ceil((Date.parse(s.reabierta_hasta!) - now.getTime()) / 86400000)
      : Math.max(0, days),
  };
}
export function evaluation(
  body: Record<string, unknown>,
  old: Evaluation | null,
): Evaluation {
  const result = {} as Evaluation;
  for (const k of keys) {
    if (
      !Number.isInteger(body[k]) ||
      Number(body[k]) < 1 ||
      Number(body[k]) > 4
    )
      throw new HttpError(
        400,
        "Selecciona una puntuación del 1 al 4 en cada criterio.",
      );
    result[k] = Number(body[k]);
  }
  return {
    ...result,
    lo_que_mas_ayudo: text(body.lo_que_mas_ayudo, 180, "Lo que más ayudó"),
    un_ajuste: text(body.un_ajuste, 180, "Un solo ajuste"),
    creada_en: old?.creada_en || new Date().toISOString(),
    actualizada_en: new Date().toISOString(),
  };
}
export function averages(es: Evaluation[]): (number | null)[] {
  return keys.map((k) =>
    es.length ? es.reduce((n, e) => n + e[k], 0) / es.length : null,
  );
}
export function quarter(date: string) {
  return `${date.slice(0, 4)}-T${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
}
export function previous(q: string) {
  const [y, t] = q.split("-T").map(Number);
  return t === 1 ? `${y - 1}-T4` : `${y}-T${t - 1}`;
}
