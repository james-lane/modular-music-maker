import express from 'express';
import path from 'node:path';
import { ZodError } from 'zod';
import { ProjectRepository } from './repository';

/** The API is intentionally local-first and unauthenticated. Keep the listener on loopback.
 * Add identity and ownership checks before exposing this Node service on a public network.
 */
export function createApp(dataDirectory = path.resolve(process.env.PATCHWORK_DATA_DIR ?? '.data')) {
  const app = express();
  const repository = new ProjectRepository(dataDirectory);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
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
  app.use('/api', (_request, response) =>
    response.status(404).json({ error: 'Unknown API endpoint.' }),
  );
  app.use(express.static(path.resolve('dist')));
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
        error: 'The server could not save this patch. Your browser copy is still available.',
      });
    },
  );
  return app;
}
