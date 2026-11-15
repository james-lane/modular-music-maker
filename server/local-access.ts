import type { RequestHandler } from 'express';
import { CONFIG } from '../src/config';

/** Loopback binding is not a DNS-rebinding defense: the request's authority must
 * also be local. Never trust forwarded headers on this unauthenticated adapter.
 */
export const localAccess: RequestHandler = (request, response, next) => {
  const host = request.headers.host;
  const port = request.socket.localPort;
  const authorities = CONFIG.localApi.hosts.flatMap((name) => [
    `${name}:${port}`,
    ...(port === 80 ? [name] : []),
  ]);
  if (!host || !authorities.includes(host.toLowerCase())) {
    response.status(403).json({ error: 'This server only accepts local Patchwork requests.' });
    return;
  }
  const origin = request.headers.origin;
  const origins = CONFIG.localApi.hosts.flatMap((name) => [
    `http://${name}${port === 80 ? '' : `:${port}`}`,
    `http://${name}:${CONFIG.localApi.developmentPort}`,
  ]);
  // Origin-less CLI requests are intentional; browsers additionally supply fetch
  // metadata, which blocks cross-site requests even when Origin is absent.
  if (
    (origin !== undefined && !origins.includes(origin)) ||
    request.headers['sec-fetch-site'] === 'cross-site'
  ) {
    response.status(403).json({ error: 'Requests from other sites are not allowed.' });
    return;
  }
  next();
};
