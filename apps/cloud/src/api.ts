import { ApiError, MockEngine, type ApiResult } from '../mock-engine';
import type { CloudState } from '../domain';
export const offline =
  location.protocol === 'file:' ||
  document.querySelector('meta[name="basis-demo-transport"]')?.getAttribute('content') ===
    'embedded';
let embedded: MockEngine | undefined;
let queue = Promise.resolve();
function localEngine() {
  if (embedded) return embedded;
  try {
    const raw = localStorage.getItem('basis-cloud-demo-v1');
    if (raw) {
      const state: CloudState = JSON.parse(raw);
      if (state.version === 1) embedded = new MockEngine(state);
    }
  } catch {
    /* Start with clean demo data if browser storage is unavailable. */
  }
  return (embedded ||= new MockEngine());
}
export async function request(path: string, method = 'GET', body?: unknown): Promise<ApiResult> {
  if (offline) {
    const run = async () => {
      const db = localEngine();
      await new Promise((resolve) => setTimeout(resolve, db.state.simulation.latency));
      try {
        return db.dispatch(method, path, body);
      } finally {
        try {
          localStorage.setItem('basis-cloud-demo-v1', JSON.stringify(db.state));
        } catch {
          /* In-memory session remains usable. */
        }
      }
    };
    const result = queue.then(run, run);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  let response: Response;
  try {
    response = await fetch(`/api/demo${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      'Нет связи с локальным сервером. Проверьте, что запущен npm run dev, и повторите запрос.',
      0,
    );
  }
  let data: ApiResult & { message?: string; fields?: Record<string, string> };
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'Сервер не вернул данные демо. Запустите приложение через npm run dev или npm run preview.',
      502,
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.message || 'Не удалось выполнить запрос.',
      response.status,
      data.fields,
    );
  return data;
}
export { ApiError };
