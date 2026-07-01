export type ReceptionTab = 'feed' | 'members' | 'checkin' | 'pos' | 'settings';

const ITEMS: { id: ReceptionTab; label: string; hint: string }[] = [
  { id: 'feed', label: 'Canlı Akış', hint: 'Turnike olayları' },
  { id: 'members', label: 'Üyeler', hint: 'Arama ve kayıt' },
  { id: 'checkin', label: 'Giriş Kaydı', hint: 'Manuel giriş/çıkış' },
  { id: 'pos', label: 'Kasa', hint: 'Borç ve tahsilat' },
  { id: 'settings', label: 'Ayarlar', hint: 'Uygulama tercihleri' },
];

type Props = {
  active: ReceptionTab;
  onChange: (tab: ReceptionTab) => void;
};

export function SidebarNav({ active, onChange }: Props) {
  return (
    <nav className="sidebar-nav" aria-label="Resepsiyon menüsü">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sidebar-nav__item ${active === item.id ? 'sidebar-nav__item--active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="sidebar-nav__label">{item.label}</span>
          <span className="sidebar-nav__hint">{item.hint}</span>
        </button>
      ))}
    </nav>
  );
}
