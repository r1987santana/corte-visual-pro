import type { Metadata } from "next";
import "./globals.css";
import SaaSLayoutShell from "@/components/saas/SaaSLayoutShell";
import ProtectedRoute from "@/components/saas/ProtectedRoute";

export const metadata: Metadata = {
  title: "RD Wood System",
  description: "ERP Profesional SaaS",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://rdwoodsystem.com"),
  applicationName: "RD Wood System Pro",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RD Wood",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/rdwood-icon.svg",
    shortcut: "/rdwood-icon.svg",
    apple: "/rdwood-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <ProtectedRoute>
          <SaaSLayoutShell>{children}</SaaSLayoutShell>
        </ProtectedRoute>
      </body>
    </html>
  );
}
