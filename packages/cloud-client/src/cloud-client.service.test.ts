import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudClientService } from './cloud-client.service.js';

type FakePrisma = {
  organization: { findUniqueOrThrow: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

function fakePrisma(): FakePrisma {
  return {
    organization: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
}

describe('CloudClientService — mail relay & commerce', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('CLOUD_API_KEY', 'cbcloud_test');
    vi.stubEnv('CLOUD_PRODUCT_SLUG', 'sgms');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('sendMail posts to the v2 mail relay endpoint with the X-Api-Key header', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ success: true, data: { id: 1, status: 'queued' } }), {
        status: 202,
      });
    }) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new CloudClientService(fakePrisma() as any);
    const result = await client.sendMail({
      to: 'owner@demo-gym.local',
      subject: 'Parolanızı sıfırlayın',
      html: '<p>Merhaba</p>',
      category: 'password_reset',
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://cloud.cicibyte.com/api/v2/sgms/mail/send');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['X-Api-Key']).toBe('cbcloud_test');

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.category).toBe('password_reset');
  });

  it('startCheckout posts to the v2 commerce checkout endpoint with buyer details flattened to snake_case', async () => {
    let capturedBody: Record<string, unknown> = {};
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          success: true,
          data: { payment_id: 42, checkout_url: 'https://sandbox-cpp.iyzipay.com/x', status: 'pending' },
        }),
        { status: 201 },
      );
    }) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new CloudClientService(fakePrisma() as any);
    const result = await client.startCheckout({
      tenantSlug: 'pilates-studio',
      tenantName: 'Pilates Studio',
      amount: 499.9,
      returnUrl: 'https://sgms.cicibyte.com/dashboard/billing',
      buyer: { name: 'Ayşe', surname: 'Yılmaz', gsmNumber: '+905551112233' },
    });

    expect(result.ok).toBe(true);
    expect(result.payload?.checkout_url).toBe('https://sandbox-cpp.iyzipay.com/x');
    expect(capturedBody.buyer).toMatchObject({ name: 'Ayşe', surname: 'Yılmaz', gsm_number: '+905551112233' });
    expect(capturedBody.return_url).toBe('https://sgms.cicibyte.com/dashboard/billing');
  });

  it('checkPaymentStatus reports a failure result when the API responds with an error', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, message: 'Ödeme bulunamadı.' }), { status: 404 }),
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new CloudClientService(fakePrisma() as any);
    const result = await client.checkPaymentStatus(999);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Ödeme bulunamadı.');
  });
});
