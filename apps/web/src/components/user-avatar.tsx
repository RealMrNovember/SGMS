import Image from 'next/image';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'user-avatar user-avatar-sm',
  md: 'user-avatar user-avatar-md',
  lg: 'user-avatar user-avatar-lg',
  xl: 'user-avatar user-avatar-xl',
};

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
};

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const initials = initialsFromName(name);
  const sizeClass = SIZE_CLASS[size];
  const px = SIZE_PX[size];

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={px}
        height={px}
        className={`${sizeClass} ${className}`.trim()}
        unoptimized
      />
    );
  }

  return (
    <span
      className={`${sizeClass} user-avatar-fallback ${className}`.trim()}
      aria-hidden={!name}
      title={name}
    >
      {initials}
    </span>
  );
}
