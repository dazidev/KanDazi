import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Kanba · Tu proceso, en perspectiva', description: 'Tableros Kanban libres para organizar tu investigación y exportarla a tu tesis.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
