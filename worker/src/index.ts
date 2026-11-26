import type { InferEnv } from 'cf/config';
import type config from '../cloudflare.config.ts';

type Env = InferEnv<typeof config.worker>;

function artifactPath(raw: string): string | undefined {
  try {
    const segments = raw.split('/').map(decodeURIComponent);
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[/\\%\x00-\x1f\x7f]/.test(segment))) {
      return;
    }
    return segments.join('/');
  } catch {
    return;
  }
}

function contentType(path: string): string {
  if (path.endsWith('.list')) return 'text/plain; charset=utf-8';
  if (path.endsWith('.yaml')) return 'text/yaml; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function errorResponse(method: string, status: 404 | 405): Response {
  const message = status === 404 ? 'Not found' : 'Method not allowed';
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  if (status === 405) headers.set('Allow', 'GET, HEAD');
  return new Response(method === 'HEAD' ? null : message, { status, headers });
}

export default {
  async fetch(request, env) {
    const { method } = request;
    if (method !== 'GET' && method !== 'HEAD') return errorResponse(method, 405);

    const route = /^https?:\/\/[^/?#]+\/latest\/([^?#]+)/.exec(request.url);
    if (!route) return errorResponse(method, 404);
    const path = artifactPath(route[1]);
    if (!path) return errorResponse(method, 404);

    const asset = await env.ASSETS.fetch(request);
    if (!asset.ok && asset.status !== 304) return errorResponse(method, 404);
    const response = new Response(asset.body, asset);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Cache-Control', 'public, max-age=300');
    response.headers.set('Content-Type', contentType(path));
    return response;
  },
} satisfies ExportedHandler<Env>;
