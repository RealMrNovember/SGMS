import { requireMemberScopedApiContext } from '@/lib/api/guard';
import { isStaffContext } from '@/lib/api/auth-context';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError } from '@/lib/api/response';
import { authorizeRealtimeChannel, getPusherServer } from '@/lib/realtime/pusher-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return apiError('Anlık mesaj servisi yapılandırılmamış.', 503);
  }

  let socketId: string | null = null;
  let channelName: string | null = null;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { socket_id?: string; channel_name?: string };
    socketId = body.socket_id ?? null;
    channelName = body.channel_name ?? null;
  } else {
    const form = await request.formData();
    socketId = form.get('socket_id')?.toString() ?? null;
    channelName = form.get('channel_name')?.toString() ?? null;
  }

  if (!socketId || !channelName) {
    return apiErrorI18n('invalidInput', 400, request);
  }

  const { organizationId, userId } = authResult.context;
  const authorized = authorizeRealtimeChannel(
    socketId,
    channelName,
    organizationId,
    userId,
    isStaffContext(authResult.context),
  );

  if (!authorized) {
    return apiErrorI18n('forbidden', 403, request);
  }

  return Response.json(authorized);
}
