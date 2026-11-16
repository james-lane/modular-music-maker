import { CONFIG } from '../src/config';
import express from 'express';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { ProjectRepository } from './repository';
import { localAccess } from './local-access';

/** The API is intentionally local-first and unauthenticated. Keep the listener on loopback.
 * Add identity and ownership checks before exposing this Node service on a public network.
 */
export function createApp(dataDirectory = path.resolve(process.env.PATCHWORK_DATA_DIR ?? '.data')) {
  const app = express();
  const repository = new ProjectRepository(dataDirectory);
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.set(CONFIG.securityHeaders);
    next();
  });
  app.use(localAccess);
  app.use(express.json({ limit: CONFIG.maxPatchBytes }));
  app.get('/api/health', (_request, response) =>
    response.json({ status: 'ok', application: 'patchwork' }),
  );
  app.get('/api/projects', async (_request, response) => response.json(await repository.list()));
  app.put('/api/projects/:id', async (request, response) => {
    if (request.params.id !== request.body?.id) {
      response.status(400).json({ error: 'The project ID must match the URL.' });
      return;
    }
    response.json(await repository.save(request.body));
  });
  app.delete('/api/projects/:id', async (request, response) => {
    const id = z.uuid().parse(request.params.id);
    await repository.delete(id);
    response.status(204).end();
  });
  app.use('/api', (_request, response) =>
    response.status(404).json({ error: 'Unknown API endpoint.' }),
  );
  app.use(
    express.static(path.resolve('dist'), {
      setHeaders(response, file) {
        if (
          ['service-worker.js', 'index.html', 'manifest.webmanifest'].includes(path.basename(file))
        )
          response.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        response.status(400).json({ error: 'The patch file is invalid or unsupported.' });
        return;
      }
      console.error('Patchwork server error:', error);
      response.status(500).json({
        error: 'The local server could not complete this patch request.',
      });
    },
  );
  return app;
}
