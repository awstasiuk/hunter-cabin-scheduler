import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hunter Cabin Scheduler",
  description: "Reserve bedrooms and shared spaces at the cabin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <span className="text-lg font-semibold text-reserved">
              🏔️ Hunter Cabin Scheduler
            </span>
            <nav className="flex gap-4 text-sm text-gray-600">
              <a href="/" className="hover:text-reserved">Calendar</a>
              <a href="/requests" className="hover:text-reserved">Requests</a>
              <a href="/my-bookings" className="hover:text-reserved">My bookings</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
