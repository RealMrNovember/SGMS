import * as PusherModule from 'pusher-js';

type PusherConstructor = typeof PusherModule.Pusher;
export type PusherClient = InstanceType<PusherConstructor>;

function resolvePusherConstructor(): PusherConstructor {
  const mod = PusherModule as typeof PusherModule & {
    default?: typeof PusherModule | PusherConstructor;
  };

  if (typeof mod.Pusher === 'function') {
    return mod.Pusher;
  }

  if (mod.default && typeof mod.default === 'function') {
    return mod.default as PusherConstructor;
  }

  if (mod.default && typeof (mod.default as typeof PusherModule).Pusher === 'function') {
    return (mod.default as typeof PusherModule).Pusher;
  }

  throw new Error('Pusher client could not be loaded');
}

export const Pusher = resolvePusherConstructor();
