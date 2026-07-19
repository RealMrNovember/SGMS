import Store from 'electron-store';
import { apiRequest } from './api-client';
import type { ReceptionConfig } from '../shared/types';

/**
 * Faz 19.4 — offline-first kuyruk. Yalnızca `/api/v1/check-in` için: bu uç nokta
 * sunucu tarafında zaten debounce/idempotent (Faz 36.11 — aynı org+kişi+yön için 8sn
 * Redis kilidi), bu yüzden ağ hatası sonrası güvenle yeniden denenebilir. POS/finans
 * yazma işlemleri (`/api/v1/transactions`, `/api/v1/expenses`) BİLİNÇLİ OLARAK kuyruğa
 * alınmıyor — bu uçlarda istemci tarafı bir idempotency-key mekanizması olmadan körlemesine
 * yeniden denemek çifte tahsilat/çifte kayıt riski taşır (bkz. roadmap.md Faz 36.7).
 */

export type QueuedCheckIn = {
  id: string;
  gymMemberId: string;
  direction: 'ENTRY' | 'EXIT';
  createdAt: string;
  attempts: number;
};

export type QueueStatus = {
  pending: number;
  lastFlushAt: string | null;
  lastFlushError: string | null;
};

const store = new Store<{ queue: QueuedCheckIn[] }>({ name: 'sgms-reception-offline-queue' });
const MAX_ATTEMPTS = 20;

let lastFlushAt: string | null = null;
let lastFlushError: string | null = null;
let onStatusChange: ((status: QueueStatus) => void) | null = null;
let flushing = false;

function getQueue(): QueuedCheckIn[] {
  return store.get('queue', []);
}

function setQueue(queue: QueuedCheckIn[]) {
  store.set('queue', queue);
  emitStatus();
}

function emitStatus() {
  onStatusChange?.({
    pending: getQueue().length,
    lastFlushAt,
    lastFlushError,
  });
}

export function onQueueStatusChange(handler: (status: QueueStatus) => void): void {
  onStatusChange = handler;
}

export function getQueueStatus(): QueueStatus {
  return { pending: getQueue().length, lastFlushAt, lastFlushError };
}

/** Bağlantı hatası nedeniyle başarısız olan bir check-in'i kalıcı kuyruğa ekler. */
export function enqueueCheckIn(gymMemberId: string, direction: 'ENTRY' | 'EXIT'): void {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    gymMemberId,
    direction,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  setQueue(queue);
}

/**
 * Kuyruktaki tüm bekleyen check-in'leri sırayla göndermeyi dener. Ağ hatası (status 0)
 * veya 5xx alan kayıtlar kuyrukta kalır (üstel geri çekilme: her deneme arasında en az
 * bir flush döngüsü geçmesi gerekir — `attempts` sayacı bunun için tutuluyor, ayrıca
 * MAX_ATTEMPTS aşılırsa kayıt düşürülür ki bozuk bir kayıt sonsuza kadar birikmesin).
 * 4xx (ör. üye bulunamadı) alan kayıtlar hiçbir zaman başarılı olmayacağı için hemen
 * düşürülür.
 */
export async function flushQueue(config: ReceptionConfig): Promise<void> {
  if (flushing) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  flushing = true;
  const remaining: QueuedCheckIn[] = [];
  let sawNetworkError = false;

  for (const item of queue) {
    if (sawNetworkError) {
      // Ağ zaten kesikse sıradaki kayıtları denemenin anlamı yok — sırayı bozmadan bekle.
      remaining.push(item);
      continue;
    }

    const result = await apiRequest(config, 'POST', '/api/v1/check-in', {
      gymMemberId: item.gymMemberId,
      direction: item.direction,
    });

    if (result.ok) {
      continue; // başarılı — kuyruktan düşer
    }

    if (result.status === 0) {
      // Ağ hatası — hâlâ çevrimdışıyız, kayıt kuyrukta kalır.
      sawNetworkError = true;
      lastFlushError = result.error ?? 'Ağ hatası';
      remaining.push({ ...item, attempts: item.attempts + 1 });
      continue;
    }

    if (result.status >= 500) {
      // Sunucu hatası — geçici olabilir, yeniden denenir.
      const attempts = item.attempts + 1;
      lastFlushError = result.error ?? `Sunucu hatası (${result.status})`;
      if (attempts < MAX_ATTEMPTS) {
        remaining.push({ ...item, attempts });
      }
      continue;
    }

    // 4xx: bu kayıt hiçbir zaman başarılı olmayacak (ör. üye artık yok) — düşürülür,
    // sessizce kaybolmaması için loglanır.
    console.error('[offline-queue] check-in kalıcı olarak reddedildi, kuyruktan düşürüldü:', item, result.error);
  }

  if (!sawNetworkError) {
    lastFlushError = null;
  }
  lastFlushAt = new Date().toISOString();
  setQueue(remaining);
  flushing = false;
}
