let mock: typeof import("./demo") | undefined;
export let isDemo = false;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  action: string,
  options: {
    method?: string;
    body?: unknown;
    id?: string;
    quarter?: string;
  } = {},
): Promise<T> {
  if (mock) return mock.demo(action, options) as Promise<T>;
  const params = new URLSearchParams({
    action,
    ...(options.id ? { id: options.id } : {}),
    ...(options.quarter ? { quarter: options.quarter } : {}),
  });
  let response: Response;
  try {
    response = await fetch("/.netlify/functions/api?" + params, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    if (import.meta.env.DEV && action === "users")
      return startDemo(action, options);
    throw new ApiError(
      "No hay conexión. Revisa tu acceso a internet e inténtalo de nuevo.",
      0,
    );
  }
  if (
    import.meta.env.DEV &&
    action === "users" &&
    (!response.headers.get("content-type")?.includes("application/json") ||
      response.status === 404 ||
      response.status === 502)
  )
    return startDemo(action, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "El servidor no está disponible. Inténtalo de nuevo.",
      503,
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error || "No se pudo completar la operación.",
      response.status,
    );
  return data;
}
async function startDemo(action: string, options: Parameters<typeof api>[1]) {
  mock = await import("./demo");
  isDemo = true;
  return mock.demo(action, options);
}
