'use client';

import { createTrainingProgram, type CreateProgramState } from '@/actions/programs';
import { FormWizard } from '@/components/form-wizard';
import { ProgramContentBuilder } from '@/components/program-content-builder';
import type { ProgramType } from '@sgms/database';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const initialState: CreateProgramState = {};

type MemberOption = { id: string; label: string };
type TrainerOption = { id: string; label: string };

export function CreateProgramForm({
  canManage,
  members,
  trainers,
  showTrainerSelect,
}: {
  canManage: boolean;
  members: MemberOption[];
  trainers: TrainerOption[];
  showTrainerSelect: boolean;
}) {
  const t = useTranslations('programs.add');
  const tTypes = useTranslations('programs.types');
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(createTrainingProgram, initialState);
  const [programType, setProgramType] = useState<ProgramType>('WORKOUT');

  if (!canManage) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">{t('noPermission')}</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={formAction}>
        <FormWizard
          backLabel={tCommon('back')}
          nextLabel={tCommon('next')}
          submitSlot={
            <button type="submit" className="button px-5 py-2.5" disabled={pending}>
              {pending ? t('saving') : t('submit')}
            </button>
          }
          steps={[
            {
              title: t('step1'),
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="gymMemberId" className="muted text-sm">
                      {t('athlete')}
                    </label>
                    <select id="gymMemberId" name="gymMemberId" className="input" required>
                      <option value="">{tCommon('select')}</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="type" className="muted text-sm">
                      {t('type')}
                    </label>
                    <select
                      id="type"
                      name="type"
                      className="input"
                      required
                      value={programType}
                      onChange={(e) => setProgramType(e.target.value as ProgramType)}
                    >
                      <option value="WORKOUT">{tTypes('workout')}</option>
                      <option value="NUTRITION">{tTypes('nutrition')}</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="title" className="muted text-sm">
                      {t('programTitle')}
                    </label>
                    <input id="title" name="title" className="input" required />
                  </div>

                  {showTrainerSelect ? (
                    <div className="space-y-2">
                      <label htmlFor="trainerId" className="muted text-sm">
                        {t('trainer')}
                      </label>
                      <select id="trainerId" name="trainerId" className="input">
                        <option value="">{t('trainerDefault')}</option>
                        {trainers.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label htmlFor="startDate" className="muted text-sm">
                      {t('startDate')}
                    </label>
                    <input id="startDate" name="startDate" type="date" className="input" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="endDate" className="muted text-sm">
                      {t('endDate')}
                    </label>
                    <input id="endDate" name="endDate" type="date" className="input" />
                  </div>
                </div>
              ),
            },
            {
              title: t('step2'),
              content: <ProgramContentBuilder programType={programType} />,
            },
          ]}
        />
      </form>
    </section>
  );
}
