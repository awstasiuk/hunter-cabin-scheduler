"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <section className="max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-4 text-gray-600">We&apos;ll email you a magic link — no password needed.</p>

      {status === "sent" ? (
        <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Check your inbox for a sign-in link.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded bg-reserved px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "sending" ? "Sending..." : "Send magic link"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
