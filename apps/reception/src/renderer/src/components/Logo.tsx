import logoUrl from '../assets/logo.svg';

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      alt="CiCiByte SGMS"
      width={size}
      height={size}
      draggable={false}
      className="logo-mark"
    />
  );
}
