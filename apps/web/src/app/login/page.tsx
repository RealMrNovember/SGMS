import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card w-full max-w-md p-8">
        <span className="badge">SGMS Admin</span>
        <h1 className="mt-4 text-2xl font-semibold">Yönetim Paneli</h1>
        <p className="muted mt-2 mb-6 text-sm leading-6">
          Spor salonu yönetim paneline giriş yapın. Merkezi lisans doğrulaması organizasyon
          düzeyinde yürütülür.
        </p>

        <Suspense fallback={<div className="muted text-sm">Form yükleniyor…</div>}>
          <LoginForm />
        </Suspense>

        <p className="muted mt-6 text-xs leading-5">
          Super Admin: <strong>admin@demo.sgms.local</strong> / <strong>Admin123!</strong> → /admin
          <br />
          Gym Sahibi: <strong>owner@demo-gym.local</strong> / <strong>Owner123!</strong> → /dashboard
        </p>
      </div>
    </main>
  );
}
