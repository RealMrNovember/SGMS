import Image from 'next/image';
import Link from 'next/link';

type SgmsLogoProps = {
  href?: string | null;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: { icon: 28, text: 'text-sm' },
  md: { icon: 36, text: 'text-base' },
  lg: { icon: 48, text: 'text-lg' },
};

export function SgmsLogo({
  href = '/',
  showWordmark = true,
  size = 'md',
  className = '',
}: SgmsLogoProps) {
  const dim = sizes[size];

  const content = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Image src="/logo.svg" alt="" width={dim.icon} height={dim.icon} priority />
      {showWordmark ? (
        <span className="flex flex-col leading-tight">
          <span className={`font-semibold tracking-tight text-white ${dim.text}`}>CiCiByte SGMS</span>
          <span className="text-[10px] tracking-[0.18em] text-[#c9a962] uppercase">Smart Gym OS</span>
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}
