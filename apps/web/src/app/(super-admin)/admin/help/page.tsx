import { listAllHelpArticlesAdmin } from '@/lib/help/queries';
import Link from 'next/link';

export default async function AdminHelpListPage() {
  const articles = await listAllHelpArticlesAdmin();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Kullanım kılavuzu</h2>
          <p className="muted mt-2 text-sm leading-6">
            HelpArticle içeriklerini kod değiştirmeden yönetin. Çeviriler locale bazlıdır (tr/en + it/pt
            dahil 8 dil).
          </p>
        </div>
        <Link href="/admin/help/new" className="button button-gold px-4 py-2 text-sm">
          Yeni makale
        </Link>
      </section>

      <section className="card overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Kitle</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{article.slug}</td>
                  <td className="px-4 py-3">{article.category}</td>
                  <td className="px-4 py-3 text-xs">{article.audiences.join(', ')}</td>
                  <td className="px-4 py-3">
                    {article.isPublished ? 'Yayında' : 'Taslak'}
                    {article.isOnboardingGuide ? ' · Rehber' : ''}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/help/${article.id}`} className="text-[var(--gold)] hover:underline">
                      Düzenle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="data-card-list md:hidden">
          {articles.map((article) => (
            <div key={article.id} className="data-card">
              <p className="font-medium">{article.slug}</p>
              <p className="muted text-xs">
                {article.category} · {article.audiences.join(', ')}
              </p>
              <Link href={`/admin/help/${article.id}`} className="mt-2 inline-block text-sm text-[var(--gold)]">
                Düzenle
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
