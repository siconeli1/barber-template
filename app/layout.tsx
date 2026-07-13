import type { Metadata } from "next";
import "./globals.css";
import { CustomerAccountBar } from "@/app/_components/CustomerAccountBar";
import { CustomerSessionProvider } from "@/lib/use-customer-session";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imperio-ferreira.vercel.app";
const metadataBase = new URL(siteUrl);

export const metadata: Metadata = {
  metadataBase,
  title: "Imperio Ferreira",
  description: "Agendamento online e area administrativa da Imperio Ferreira",
  openGraph: {
    title: "Imperio Ferreira",
    description: "Agendamento online e area administrativa da Imperio Ferreira",
    url: "/",
    siteName: "Imperio Ferreira",
    images: [
      {
        url: "/imperio-logo.jpg",
        width: 1200,
        height: 630,
        alt: "Imperio Ferreira",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imperio Ferreira",
    description: "Agendamento online e area administrativa da Imperio Ferreira",
    images: ["/imperio-logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <CustomerSessionProvider>
          <CustomerAccountBar />
          {children}
        </CustomerSessionProvider>
      </body>
    </html>
  );
}
