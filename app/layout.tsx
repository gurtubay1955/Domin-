import type { Metadata } from "next";
import { Patrick_Hand } from "next/font/google";
import "./globals.css";

const patrickHand = Patrick_Hand({
  weight: "400",
  variable: "--font-patrick-hand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Torneo de Dominó",
  description: "Sistema de gestión de torneos de dominó",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dominó",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  }
};

export const viewport = {
  themeColor: "#1B5E20",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${patrickHand.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
