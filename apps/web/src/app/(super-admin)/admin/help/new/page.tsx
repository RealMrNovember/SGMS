import { HelpArticleForm } from '@/components/admin/help-article-form';
import Link from 'next/link';

export default function AdminHelpNewPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/help" className="muted text-sm hover:text-white">
          ← Kılavuz listesi
        </Link>
        <h2 className="mt-3 text-2xl font-semibold">Yeni kılavuz makalesi</h2>
      </div>
      <HelpArticleForm />
    </div>
  );
}
