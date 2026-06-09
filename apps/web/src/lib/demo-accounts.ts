export type DemoAccountKey = 'admin' | 'owner' | 'staff' | 'athlete';

export type DemoAccount = {
  key: DemoAccountKey;
  email: string;
  password: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: 'admin', email: 'admin@demo.sgms.local', password: 'Admin123!' },
  { key: 'owner', email: 'owner@demo-gym.local', password: 'Owner123!' },
  { key: 'staff', email: 'staff@demo-gym.local', password: 'Staff123!' },
  { key: 'athlete', email: 'athlete@demo-gym.local', password: 'Athlete123!' },
];
