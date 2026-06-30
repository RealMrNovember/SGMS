import type { CheckInNotificationPayload } from '../../../shared/types';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type Props = {
  item: CheckInNotificationPayload;
  isNew?: boolean;
};

export function CheckInCard({ item, isNew }: Props) {
  const isEntry = item.direction === 'ENTRY';
  const isStaff = item.subjectType === 'STAFF';

  return (
    <article className={`checkin-card ${isNew ? 'checkin-card--new' : ''}`}>
      <div className={`checkin-accent checkin-accent--${isEntry ? 'entry' : 'exit'}`} />
      <div className="checkin-avatar">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" />
        ) : (
          <span>{initials(item.personName)}</span>
        )}
      </div>
      <div className="checkin-body">
        <div className="checkin-top">
          <span className={`checkin-badge checkin-badge--${isEntry ? 'entry' : 'exit'}`}>
            {isEntry ? 'Giriş' : 'Çıkış'}
          </span>
          <time>{formatTime(item.checkedInAt)}</time>
        </div>
        <h3>{item.personName}</h3>
        <p>{item.subtitle}</p>
        <div className="checkin-meta">
          <span className={isStaff ? 'pill pill--staff' : 'pill pill--member'}>
            {isStaff ? 'Personel' : 'Üye'}
          </span>
          {item.deviceName ? <span className="pill pill--device">{item.deviceName}</span> : null}
        </div>
      </div>
    </article>
  );
}
