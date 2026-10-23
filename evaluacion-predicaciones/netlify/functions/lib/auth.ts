import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "../../../shared/model";
import { HttpError } from "./domain";
type PrivateUser = User & { pin: string };
export function users(): PrivateUser[] {
  let data: PrivateUser[];
  try {
    data = JSON.parse(process.env.APP_USERS || "");
  } catch {
    throw new HttpError(503, "Falta configurar el acceso de la aplicación.");
  }
  if (
    !Array.isArray(data) ||
    data.length < 1 ||
    data.filter((u) => u.admin === true).length !== 1 ||
    new Set(data.map((u) => u.id)).size !== data.length ||
    data.some(
      (u) =>
        !/^[-\w]{1,40}$/.test(u.id) ||
        typeof u.nombre !== "string" ||
        !u.nombre.trim() ||
        u.nombre.length > 80 ||
        !/^\d{6}$/.test(u.pin) ||
        typeof u.admin !== "boolean",
    )
  )
    throw new HttpError(503, "La configuración de usuarios no es válida.");
  return data;
}
export function publicUser(u: PrivateUser): User {
  return { id: u.id, nombre: u.nombre, admin: u.admin };
}
function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32)
    throw new HttpError(503, "Falta configurar la clave segura de sesión.");
  return s;
}
export function equal(a: string, b: string) {
  const hash = (s: string) => createHmac("sha256", secret()).update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
export function issue(u: PrivateUser) {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      sub: u.id,
      exp: Math.floor(Date.now() / 1000) + 30 * 86400,
      v: createHmac("sha256", secret())
        .update(JSON.stringify(u))
        .digest("base64url"),
    }),
  ).toString("base64url");
  const payload = head + "." + body;
  return (
    payload +
    "." +
    createHmac("sha256", secret()).update(payload).digest("base64url")
  );
}
export function authenticate(req: Request): PrivateUser {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("__Host-vr_session="))
    ?.slice("__Host-vr_session=".length);
  if (!token || token.length > 2048)
    throw new HttpError(401, "Inicia sesión para continuar.");
  try {
    const [h, b, s, ...extra] = token.split(".");
    if (
      extra.length ||
      !s ||
      !equal(
        s,
        createHmac("sha256", secret())
          .update(h + "." + b)
          .digest("base64url"),
      )
    )
      throw 0;
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(b, "base64url").toString());
    const u = users().find((u) => u.id === payload.sub);
    if (
      header.alg !== "HS256" ||
      !u ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000 ||
      !equal(
        payload.v || "",
        createHmac("sha256", secret())
          .update(JSON.stringify(u))
          .digest("base64url"),
      )
    )
      throw 0;
    return u;
  } catch {
    throw new HttpError(401, "Tu sesión venció. Vuelve a iniciar sesión.");
  }
}
export function cookie(token: string, maxAge = 30 * 86400) {
  return `__Host-vr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
