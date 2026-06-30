import { requireMemberScopedApiContext } from '@/lib/api/guard';
import { heartbeatChunk, subscribeUserMessages } from '@/lib/realtime/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { userId } = authResult.context;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      send(`: connected user=${userId}\n\n`);
      const unsubscribe = subscribeUserMessages(userId, send);

      const heartbeat = setInterval(() => {
        try {
          send(heartbeatChunk());
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const abort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', abort);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
