import { CreatePartnerForm } from '@/components/admin/create-partner-form';
import { PartnerActiveToggle } from '@/components/admin/partner-active-toggle';
import { auth } from '@/lib/auth';
import { listAllPartners } from '@/lib/admin/queries';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminPartnersPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const partners = await listAllPartners();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Temsilciler (Partners)</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          Referans/satış temsilcileri, kendilerine atanmış organizasyonların üyelik süresi, özel
          indirimi ve ek kapasitesini sınırlı yetkiyle yönetebilir. Atama işlemi her organizasyonun
          detay sayfasından yapılır.
        </p>
      </section>

      <CreatePartnerForm />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <p className="muted text-sm">{partners.length} temsilci</p>
        </div>
        {partners.length === 0 ? (
          <p className="muted p-6 text-sm">Henüz temsilci eklenmedi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 font-medium">Ad</th>
                  <th className="px-6 py-3 font-medium">Kod</th>
                  <th className="px-6 py-3 font-medium">Komisyon</th>
                  <th className="px-6 py-3 font-medium">Atanmış salonlar</th>
                  <th className="px-6 py-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">
                      <p className="font-medium">{partner.name}</p>
                      <p className="muted text-xs">{partner.user.email}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{partner.code}</td>
                    <td className="px-6 py-4">%{partner.commissionRate.toString()}</td>
                    <td className="px-6 py-4">
                      {partner.organizations.length === 0 ? (
                        <span className="muted text-xs">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {partner.organizations.map((org) => (
                            <li key={org.id}>
                              <Link
                                href={`/admin/organizations/${org.id}`}
                                className="text-xs hover:underline"
                              >
                                {org.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <PartnerActiveToggle partnerId={partner.id} isActive={partner.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
