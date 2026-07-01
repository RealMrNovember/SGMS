import { requireMemberScopedApiContext } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { consumeTypingRateLimit } from '@/lib/rate-limit';
import { publishTypingEvent } from '@/lib/realtime/hub';

export async function POST(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const receiverId = typeof body.receiverId === 'string' ? body.receiverId : '';
  if (!receiverId || receiverId === context.userId) {
    return apiErrorI18n('invalidInput', 400, request);
  }

  const rate = await consumeTypingRateLimit(context.userId, context.organizationId);
  if (!rate.allowed) {
    return apiOk({ ok: true, throttled: true });
  }

  publishTypingEvent({
    type: 'message.typing',
    organizationId: context.organizationId,
    userIds: [receiverId],
    senderId: context.userId,
    receiverId,
  });

  return apiOk({ ok: true });
}
