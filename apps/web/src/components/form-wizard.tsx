'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

export type WizardStep = {
  title: string;
  content: ReactNode;
};

type Props = {
  steps: WizardStep[];
  submitSlot: ReactNode;
  backLabel: string;
  nextLabel: string;
};

export function FormWizard({ steps, submitSlot, backLabel, nextLabel }: Props) {
  const [current, setCurrent] = useState(0);
  const isLast = current === steps.length - 1;

  function goNext() {
    const stepEl = document.getElementById(`wizard-step-${current}`);
    const invalid = stepEl?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(':invalid');
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setCurrent((c) => Math.min(c + 1, steps.length - 1));
  }

  function goBack() {
    setCurrent((c) => Math.max(c - 1, 0));
  }

  return (
    <div className="space-y-5">
      <div className="wizard-progress">
        {steps.map((step, index) => (
          <div key={step.title} className="wizard-progress-step" data-active={index === current} data-done={index < current}>
            <span className="wizard-progress-index">{index < current ? <Check size={13} /> : index + 1}</span>
            <span className="wizard-progress-title">{step.title}</span>
          </div>
        ))}
      </div>

      {steps.map((step, index) => (
        <div key={step.title} id={`wizard-step-${index}`} style={{ display: index === current ? 'block' : 'none' }}>
          {step.content}
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        {current > 0 ? (
          <button type="button" onClick={goBack} className="button px-5 py-2.5 text-sm">
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        {!isLast ? (
          <button type="button" onClick={goNext} className="button button-gold px-5 py-2.5 text-sm">
            {nextLabel}
          </button>
        ) : (
          submitSlot
        )}
      </div>
    </div>
  );
}
