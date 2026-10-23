import { getStore } from "@netlify/blobs";
export interface Storage {
  get<T>(store: string, key: string): Promise<T | null>;
  put(store: string, key: string, value: unknown): Promise<void>;
  list<T>(store: string, prefix?: string): Promise<{ key: string; data: T }[]>;
  reserve(userId: string, now: number): Promise<string | null>;
  release(key: string): Promise<void>;
}
// Cinco plazas independientes: la reserva condicional impide que solicitudes
// simultáneas superen el límite. Cada fallo ocupa una plaza durante 15 minutos.
export const storage: Storage = {
  async get<T>(name: string, key: string) {
    return getStore({ name, consistency: "strong" }).get(key, {
      type: "json",
    }) as Promise<T | null>;
  },
  async put(name, key, value) {
    await getStore({ name, consistency: "strong" }).setJSON(key, value);
  },
  async list<T>(name: string, prefix = "") {
    const store = getStore({ name, consistency: "strong" });
    const result: { key: string; data: T }[] = [];
    for await (const page of store.list({ prefix, paginate: true })) {
      for (const blob of page.blobs) {
        const data = (await store.get(blob.key, { type: "json" })) as T | null;
        if (data) result.push({ key: blob.key, data });
      }
    }
    return result;
  },
  async reserve(userId, now) {
    const store = getStore({ name: "intentos", consistency: "strong" });
    for (let i = 0; i < 5; i++) {
      const key = `${userId}:${i}`;
      const old = await store.getWithMetadata(key, { type: "json" });
      if (old && old.data.expires > now) continue;
      const { modified } = await store.setJSON(
        key,
        { expires: now + 15 * 60 * 1000 },
        old ? { onlyIfMatch: old.etag } : { onlyIfNew: true },
      );
      if (modified) return key;
    }
    return null;
  },
  async release(key) {
    await getStore({ name: "intentos", consistency: "strong" }).delete(key);
  },
};
