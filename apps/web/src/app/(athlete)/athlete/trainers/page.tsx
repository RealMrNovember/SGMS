import { TrainerRequestForm } from '@/components/trainers/trainer-request-form';
import { UserAvatar } from '@/components/user-avatar';
import { auth } from '@/lib/auth';
import { listActiveTrainerProfiles } from '@/lib/trainers/profiles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteTrainersPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const gymMemberId = session.user.gymMemberId;
  const t = await getTranslations('faz42');

  const [member, trainers, pendingRequest] = await Promise.all([
    prisma.gymMember.findFirst({
      where: { id: gymMemberId, organizationId },
      include: { trainer: { select: { id: true, name: true, email: true } } },
    }),
    listActiveTrainerProfiles(organizationId),
    prisma.trainerRequest.findFirst({
      where: { gymMemberId, status: 'PENDING' },
      include: { preferredTrainer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!member) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {t('athleteBack')}
        </Link>
        <h2 className="mt-4 text-xl font-semibold">{t('athleteTitle')}</h2>
        <p className="muted mt-2 text-sm">{t('athleteSubtitle')}</p>
      </div>

      {member.trainer ? (
        <section className="card p-5">
          <p className="muted text-xs">{t('currentTrainer')}</p>
          <p className="mt-1 font-medium">{member.trainer.name ?? member.trainer.email}</p>
        </section>
      ) : null}

      <TrainerRequestForm
        gymMemberId={gymMemberId}
        hasTrainer={Boolean(member.trainerId)}
        trainers={trainers.map((trainer) => ({
          userId: trainer.userId,
          name: trainer.name,
          isAtCapacity: trainer.isAtCapacity,
        }))}
        pendingRequest={
          pendingRequest
            ? {
                id: pendingRequest.id,
                requestType: pendingRequest.requestType,
                status: pendingRequest.status,
                preferredTrainerName: pendingRequest.preferredTrainer?.name ?? null,
              }
            : null
        }
      />

      <section className="space-y-3">
        <h3 className="font-semibold">{t('listTitle')}</h3>
        {trainers.length === 0 ? (
          <p className="muted text-sm">{t('listEmpty')}</p>
        ) : (
          trainers.map((trainer) => (
            <article key={trainer.userId} className="card flex gap-4 p-4">
              <UserAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{trainer.name}</p>
                  {trainer.isAtCapacity ? (
                    <span className="badge text-[10px]">{t('atCapacityBadge')}</span>
                  ) : null}
                  {trainer.maxMembers != null ? (
                    <span className="badge text-[10px]">
                      {t('capacity', { count: trainer.memberCount, max: trainer.maxMembers })}
                    </span>
                  ) : null}
                </div>
                {trainer.specialties.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {trainer.specialties.map((tag) => (
                      <span key={tag} className="badge text-[10px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {trainer.bio ? <p className="muted mt-2 text-sm leading-6">{trainer.bio}</p> : null}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
