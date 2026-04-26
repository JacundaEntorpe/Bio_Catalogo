"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AuthPanel() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="auth-panel auth-panel--muted">Checking session...</div>;
  }

  if (!session?.user) {
    return (
      <div className="auth-panel auth-panel--muted">
        <p>Use the demo account to create and edit entries.</p>
        <Link className="button button--ghost button--small" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <p className="auth-panel__eyebrow">Signed in</p>
      <strong>{session.user.name ?? session.user.email}</strong>
      <button className="button button--ghost button--small" onClick={() => signOut({ callbackUrl: "/" })} type="button">
        Sign out
      </button>
    </div>
  );
}