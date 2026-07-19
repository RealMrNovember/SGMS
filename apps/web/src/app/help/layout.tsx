import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

/** Help sayfaları kendi kabuğunu kullanır; oturum zorunlu. */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return <div className="app-shell min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</div>;
}
