import { CopyEmailBlock } from '@/components/admin/copy-email-block';
import { auth } from '@/lib/auth';
import { adminEmailTemplates, fillEmailTemplate } from '@/lib/admin/email-templates';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const categoryLabels: Record<string, string> = {
  onboarding: 'Karşılama',
  billing: 'Faturalama',
  support: 'Destek',
  retention: 'Elde tutma',
};

const sampleVars = {
  salonAdi: 'Örnek Fitness',
  sahipAdi: 'Ahmet Yılmaz',
  denemeGun: '14',
  denemeBitis: '15 Tem 2026',
  kalanGun: '5',
  mevcutPlan: 'Starter',
  planAdi: 'Pro',
  not: 'Turnike entegrasyonu kurulumu bekleniyor.',
  sebep: 'Deneme süresi doldu',
};

export default async function AdminCommunicationsPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const tAdmin = await getTranslations('admin');

  const grouped = adminEmailTemplates.reduce<Record<string, typeof adminEmailTemplates>>((acc, tpl) => {
    acc[tpl.category] = acc[tpl.category] ?? [];
    acc[tpl.category].push(tpl);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('communicationsTitle')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">{tAdmin('communicationsSubtitle')}</p>
        <p className="muted mt-4 text-sm">
          Gönderim: <a href="mailto:support@cicibyte.com" className="hover:underline">support@cicibyte.com</a>
          {' · '}
          <a href="mailto:info@cicibyte.com" className="hover:underline">info@cicibyte.com</a>
        </p>
      </section>

      {Object.entries(grouped).map(([category, templates]) => (
        <section key={category} className="space-y-4">
          <h3 className="admin-kicker">{categoryLabels[category] ?? category}</h3>
          {templates.map((template) => {
            const filled = fillEmailTemplate(template, sampleVars);
            return (
              <article key={template.id} className="card space-y-4 p-6">
                <div>
                  <h4 className="text-lg font-medium">{template.title}</h4>
                  <p className="muted text-xs">Şablon: {template.id}</p>
                </div>
                <CopyEmailBlock
                  to="musteri@ornek.com"
                  subject={filled.subject}
                  body={filled.body}
                />
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
