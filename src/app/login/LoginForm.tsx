"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api-client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await api("/api/auth/login", { body: { email, password } });
        setBusy(false);
        if (!res.ok) return setError(res.error.message);
        window.location.assign(next); // full load so the server layout picks up the new session
      }}
    >
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" error={error}>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required invalid={Boolean(error)} />
      </Field>
      <Button type="submit" loading={busy} full>
        Sign in
      </Button>
    </form>
  );
}
