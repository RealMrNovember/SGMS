'use client';

import { createTrainingProgram, type CreateProgramState } from '@/actions/programs';
import { useActionState } from 'react';

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
  const [state, formAction, pending] = useActionState(createTrainingProgram, initialState);

  if (!canManage) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">
          Program oluşturmak için TRAINER, ADMIN veya OWNER rolü gerekir.
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Yeni Program</h3>
        <p className="muted mt-1 text-sm">Antrenman veya beslenme programı atayın.</p>
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

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="gymMemberId" className="muted text-sm">
            Sporcu
          </label>
          <select id="gymMemberId" name="gymMemberId" className="input" required>
            <option value="">Seçin</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="type" className="muted text-sm">
            Program Türü
          </label>
          <select id="type" name="type" className="input" required>
            <option value="WORKOUT">Antrenman</option>
            <option value="NUTRITION">Beslenme</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="muted text-sm">
            Başlık
          </label>
          <input id="title" name="title" className="input" required />
        </div>

        {showTrainerSelect ? (
          <div className="space-y-2">
            <label htmlFor="trainerId" className="muted text-sm">
              Antrenör
            </label>
            <select id="trainerId" name="trainerId" className="input">
              <option value="">Varsayılan</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="startDate" className="muted text-sm">
            Başlangıç
          </label>
          <input id="startDate" name="startDate" type="date" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="endDate" className="muted text-sm">
            Bitiş (opsiyonel)
          </label>
          <input id="endDate" name="endDate" type="date" className="input" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="content" className="muted text-sm">
            İçerik (JSON veya metin)
          </label>
          <textarea
            id="content"
            name="content"
            rows={4}
            className="input font-mono text-xs"
            placeholder='{"days":[{"name":"Pazartesi","exercises":["Squat"]}]}'
          />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-5 py-2.5" disabled={pending}>
            {pending ? 'Oluşturuluyor…' : 'Program Oluştur'}
          </button>
        </div>
      </form>
    </section>
  );
}
