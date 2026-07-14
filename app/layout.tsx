import type { Metadata } from "next";
import "./globals.css";
import { CustomerAccountBar } from "@/app/_components/CustomerAccountBar";
import { CustomerSessionProvider } from "@/lib/use-customer-session";
import { buildThemeStyle } from "@/lib/theme";
import barbershop from "@/barbershop.config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? barbershop.siteUrl;
const metadataBase = new URL(siteUrl);

export const metadata: Metadata = {
  metadataBase,
  title: barbershop.nome,
  description: barbershop.descricao,
  icons: {
    icon: barbershop.logo,
  },
  openGraph: {
    title: barbershop.nome,
    description: barbershop.descricao,
    url: "/",
    siteName: barbershop.nome,
    images: [
      {
        url: barbershop.ogImage,
        width: 1200,
        height: 630,
        alt: barbershop.nome,
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: barbershop.nome,
    description: barbershop.descricao,
    images: [barbershop.ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" style={buildThemeStyle(barbershop.tema)}>
      <body className="antialiased">
        <CustomerSessionProvider>
          <CustomerAccountBar />
          {children}
        </CustomerSessionProvider>
      </body>
    </html>
  );
}
