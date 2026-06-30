import { Providers } from '@/components/providers';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CiCiByte SGMS — Smart Gym Management System',
    template: '%s · CiCiByte SGMS',
  },
  description:
    'Premium digital gym operating system — CRM, PT programs, POS, athlete portal and 6-language SaaS.',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
  openGraph: {
    title: 'CiCiByte SGMS',
    description: 'Run your gym on one international, premium platform.',
    url: 'https://sgms.cicibyte.com',
    siteName: 'CiCiByte SGMS',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
