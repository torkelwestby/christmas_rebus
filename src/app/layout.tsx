import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Idébank - BAMA",
  description: "Send inn og utforsk nye ideer",
  manifest: "/manifest.json",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            <Header />

            {/* Main content */}
            <main className="flex-1">
              {children}
            </main>

            {/* Footer */}
            <footer className="bg-white/50 backdrop-blur-sm border-t border-gray-200/50 mt-auto">
              <div className="max-w-7xl mx-auto container-padding py-4 text-center text-xs text-gray-600">
                © {new Date().getFullYear()} BAMA • Alle rettigheter reservert
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}