import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingMobileDock } from '@/components/marketing/marketing-mobile-dock';
import { MarketingScrollBridge } from '@/components/marketing/marketing-motion';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-shell">
      <MarketingScrollBridge />
      <MarketingHeader />
      <main className="marketing-main">{children}</main>
      <MarketingFooter />
      <MarketingMobileDock />
    </div>
  );
}
