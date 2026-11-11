import { z } from 'zod';
import { generateReply } from './ai.provider';
import type { AiEnvironment } from './ai.tools';

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(1200),
});

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  conversationId: z.string().trim().min(1).max(100).optional(),
  history: z.array(historyMessageSchema).max(10).default([]),
}).superRefine((value, context) => {
  const historySize = value.history.reduce((total, item) => total + item.content.length, 0);
  if (historySize > 8000) {
    context.addIssue({ code: 'custom', message: 'Lịch sử hội thoại vượt quá giới hạn.' });
  }
});

async function readJsonBody(request: Request, maxBytes: number): Promise<{ body?: unknown; invalid?: boolean; tooLarge?: boolean }> {
  const declaredSize = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredSize > maxBytes) return { tooLarge: true };
  if (!request.body) return { invalid: true };

  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { body: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { invalid: true };
  }
}

function corsHeaders(request: Request, env: AiEnvironment): Headers {
  const origin = request.headers.get('Origin');
  const configuredOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const allowed = !origin || origin === new URL(request.url).origin || [...configuredOrigins, ...localOrigins].includes(origin);
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (origin && allowed) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function jsonResponse(request: Request, env: AiEnvironment, body: unknown, status = 200): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

async function isApiHealthy(env: AiEnvironment): Promise<boolean> {
  const base = env.API_BASE_URL.trim().replace(/\/+$/, '');
  try {
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function handleChat(request: Request, env: AiEnvironment): Promise<Response> {
  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLocaleLowerCase();
  if (contentType !== 'application/json') {
    return jsonResponse(request, env, { message: 'Yêu cầu cần có Content-Type application/json.' }, 415);
  }

  const payload = await readJsonBody(request, 24 * 1024);
  if (payload.tooLarge) {
    return jsonResponse(request, env, { message: 'Yêu cầu vượt quá dung lượng cho phép.' }, 413);
  }
  if (payload.invalid) {
    return jsonResponse(request, env, { message: 'Nội dung gửi lên chưa phải JSON hợp lệ.' }, 400);
  }

  const parsed = chatRequestSchema.safeParse(payload.body);
  if (!parsed.success) {
    return jsonResponse(request, env, {
      message: 'Tin nhắn hoặc lịch sử hội thoại chưa hợp lệ.',
      issues: parsed.error.flatten(),
    }, 400);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'local';
  let limit: { success: boolean };
  try {
    limit = await env.CHAT_RATE_LIMITER.limit({ key: clientIp });
  } catch {
    return jsonResponse(request, env, { message: 'Không thể xác thực giới hạn yêu cầu. Vui lòng thử lại sau.' }, 503);
  }
  if (!limit.success) {
    return jsonResponse(request, env, { message: 'Bạn đã gửi nhiều tin nhắn trong thời gian ngắn. Vui lòng thử lại sau một phút.' }, 429);
  }

  try {
    const response = await generateReply(
      env,
      parsed.data.message,
      parsed.data.history,
      request.headers.get('Authorization') ?? undefined,
    );
    return jsonResponse(request, env, {
      conversationId: parsed.data.conversationId ?? crypto.randomUUID(),
      answer: response.answer,
      results: response.results,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'AI request timed out.';
    return jsonResponse(request, env, {
      message: timedOut
        ? 'Trợ lý AI đang mất nhiều thời gian phản hồi. Vui lòng thử lại.'
        : 'Trợ lý AI tạm thời chưa khả dụng. Vui lòng thử lại sau.',
    }, timedOut ? 504 : 502);
  }
}

export default {
  async fetch(request: Request, env: AiEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (url.pathname.endsWith('/health') && request.method === 'GET') {
      const databaseApi = await isApiHealthy(env);
      return jsonResponse(request, env, {
        ok: databaseApi,
        provider: 'Cloudflare Workers AI',
        model: env.AI_MODEL?.trim() || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        databaseApi,
      }, databaseApi ? 200 : 503);
    }
    if (url.pathname.endsWith('/chat') && request.method === 'POST') return handleChat(request, env);
    return jsonResponse(request, env, { message: 'AI route not found.' }, 404);
  },
};
