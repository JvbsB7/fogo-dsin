import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppShell } from '@/components/fogo/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'F.O.G.O. — Central de Operações', template: '%s · F.O.G.O.' },
  description: 'Ferramenta Onisciente de Gestão e Operações: inventário, monitoramento em tempo real e previsões para a mobilidade urbana.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
