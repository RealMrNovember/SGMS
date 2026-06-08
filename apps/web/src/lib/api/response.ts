import { NextResponse } from 'next/server';

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}
