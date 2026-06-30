import { requireTenantApiContext } from '@/lib/api/guard';
import { heartbeatChunk, subscribeOrgCheckIns } from '@/lib/realtime/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext(request, {
    roles: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'],
  });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId } = authResult.context;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      send(`: connected org=${organizationId}\n\n`);
      const unsubscribe = subscribeOrgCheckIns(organizationId, send);

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
