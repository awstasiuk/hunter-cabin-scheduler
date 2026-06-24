import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Hunter Cabin Scheduler",
  description: "Reserve bedrooms and shared spaces at the cabin.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-lg font-semibold text-reserved">
              🏔️ Hunter Cabin Scheduler
            </span>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <a href="/" className="hover:text-reserved">Calendar</a>
              <a href="/book" className="hover:text-reserved">Book</a>
              <a href="/requests" className="hover:text-reserved">Requests</a>
              <a href="/my-bookings" className="hover:text-reserved">My bookings</a>
              <a href="/admin" className="hover:text-reserved">Admin</a>
              {userData.user ? (
                <form action={signOut} className="flex items-center gap-2">
                  <span className="hidden text-gray-400 sm:inline">{userData.user.email}</span>
                  <button type="submit" className="hover:text-reserved">Sign out</button>
                </form>
              ) : (
                <a href="/login" className="hover:text-reserved">Sign in</a>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
