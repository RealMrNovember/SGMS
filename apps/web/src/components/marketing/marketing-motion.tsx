'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type RevealVariant = 'fade-up' | 'fade-in' | 'scale-in' | 'slide-right';

type MarketingRevealProps = {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  delay?: number;
  immediate?: boolean;
  as?: 'div' | 'section' | 'article' | 'li' | 'p' | 'span';
  'data-step'?: string;
};

export function MarketingReveal({
  children,
  className = '',
  variant = 'fade-up',
  delay = 0,
  immediate = false,
  as: Tag = 'div',
  'data-step': dataStep,
}: MarketingRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (immediate) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('mkt-reveal--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  const style = { '--mkt-delay': `${delay}ms` } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      className={`mkt-reveal mkt-reveal--${variant}${immediate ? ' mkt-reveal--immediate' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-step={dataStep}
    >
      {children}
    </Tag>
  );
}

type MarketingStaggerProps = {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
  immediate?: boolean;
};

export function MarketingStagger({
  children,
  className = '',
  staggerMs = 90,
  immediate = false,
}: MarketingStaggerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (immediate) {
      ref.current?.classList.add('mkt-stagger--visible');
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('mkt-stagger--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  const style = { '--mkt-stagger': `${staggerMs}ms` } as CSSProperties;

  return (
    <div
      ref={ref}
      className={`mkt-stagger${immediate ? ' mkt-stagger--visible' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}

const SECTION_IDS = ['features', 'how-it-works', 'why-sgms', 'reception-desktop', 'contact'] as const;

export function MarketingScrollBridge() {
  useEffect(() => {
    const header = document.querySelector('.marketing-header');
    const dockItems = document.querySelectorAll<HTMLAnchorElement>('.marketing-mobile-dock-item');

    const onScroll = () => {
      header?.classList.toggle('marketing-header--scrolled', window.scrollY > 48);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          dockItems.forEach((item) => {
            const href = item.getAttribute('href') ?? '';
            const isActive = href === `/#${id}` || href === `#${id}`;
            item.classList.toggle('marketing-mobile-dock-item--active', isActive);
          });
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      sectionObserver.disconnect();
    };
  }, []);

  return null;
}

export function MarketingHeroScene() {
  return (
    <div className="marketing-hero-scene" aria-hidden>
      <svg className="marketing-hero-scene__dumbbell marketing-hero-float-a" viewBox="0 0 120 32" fill="none">
        <rect x="4" y="10" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <rect x="98" y="10" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1="16" x2="98" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <svg className="marketing-hero-scene__pulse marketing-hero-float-b" viewBox="0 0 200 48" fill="none">
        <path
          d="M0 24 H40 L52 8 L64 40 L76 24 H120 L132 14 L144 34 L156 24 H200"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="marketing-hero-scene__ekg-path"
        />
      </svg>

      <div className="marketing-hero-scene__ring marketing-hero-float-c">
        <span />
        <span />
      </div>

      <svg className="marketing-hero-scene__kettlebell marketing-hero-float-d" viewBox="0 0 48 56" fill="none">
        <path
          d="M24 4 C32 4 38 10 38 18 C38 22 36 25 33 27 L33 32 C40 34 44 40 44 48 C44 52 40 54 24 54 C8 54 4 52 4 48 C4 40 8 34 15 32 L15 27 C12 25 10 22 10 18 C10 10 16 4 24 4 Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>

      <div className="marketing-hero-scene__orb marketing-hero-scene__orb--gold" />
      <div className="marketing-hero-scene__orb marketing-hero-scene__orb--cyan" />
    </div>
  );
}
