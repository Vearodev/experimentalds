import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Plugin } from 'vite';
import { ApiError, MockEngine, type ApiResult } from './mock-engine.ts';
import type { CloudState } from './domain';

export function cloudApiPlugin(databasePath: string): Plugin {
  let engine: MockEngine | undefined,
    queue = Promise.resolve();
  const load = async () => {
    if (engine) return engine;
    try {
      const data: CloudState = JSON.parse(await readFile(databasePath, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.vms))
        throw new Error('Неподдерживаемый формат базы демо.');
      engine = new MockEngine(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      engine = new MockEngine();
    }
    return engine;
  };
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/demo/')) return next();
    const execute = async () => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      try {
        const db = await load(),
          path = new URL(req.url!, 'http://127.0.0.1').pathname.slice('/api/demo'.length);
        if (
          req.method !== 'GET' &&
          req.headers.origin &&
          ![
            'http://127.0.0.1:5173',
            'http://localhost:5173',
            'http://127.0.0.1:4173',
            'http://localhost:4173',
          ].includes(req.headers.origin)
        )
          throw new ApiError('Недопустимый источник запроса.', 403);
        let source = '';
        for await (const chunk of req) {
          source += String(chunk);
          if (source.length > 65536) throw new ApiError('Слишком большой запрос.', 413);
        }
        let body: unknown = {};
        try {
          if (source) body = JSON.parse(source);
        } catch {
          throw new ApiError('Некорректный JSON.', 400);
        }
        await new Promise((resolve) => setTimeout(resolve, db.state.simulation.latency));
        const previous = structuredClone(db.state);
        let result: ApiResult;
        try {
          result = db.dispatch(req.method || 'GET', path, body);
        } finally {
          try {
            await mkdir(dirname(databasePath), { recursive: true });
            await writeFile(`${databasePath}.tmp`, JSON.stringify(db.state, null, 2));
            await rename(`${databasePath}.tmp`, databasePath);
          } catch (error) {
            db.state = previous;
            throw error;
          }
        }
        res.statusCode = req.method === 'POST' && result.id ? 201 : 200;
        res.end(JSON.stringify(result));
      } catch (error) {
        if (res.writableEnded) return;
        res.statusCode = error instanceof ApiError ? error.status : 500;
        res.end(
          JSON.stringify({
            message: error instanceof Error ? error.message : 'Ошибка сервера.',
            fields: error instanceof ApiError ? error.fields : {},
          }),
        );
      }
    };
    queue = queue.then(execute, execute);
  };
  return {
    name: 'basis-cloud-mock-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
