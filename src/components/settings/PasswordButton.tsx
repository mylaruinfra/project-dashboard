"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useApiForm } from "@/components/forms/useApiForm";

/** Own password (needs current) or, for admins, reset someone else's. */
export function PasswordButton({ userId, label = "Change password" }: { userId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const init = { current: "", password: "" };
  const f = useApiForm(init);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { f.reset(init); setOpen(true); }}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = userId ? await f.submit(`/api/users/${userId}/password`, { body: { password: f.values.password }, success: "Password reset" }) : await f.submit("/api/auth/password", { success: "Password changed" });
                if (ok) setOpen(false);
              }}
            >
              Save password
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {!userId ? (
            <Field label="Current password" htmlFor="pw-current" required error={f.errors.current}>
              <Input id="pw-current" type="password" autoComplete="current-password" value={f.values.current} onChange={(e) => f.set("current")(e.target.value)} />
            </Field>
          ) : null}
          <Field label="New password" htmlFor="pw-new" required error={f.errors.password} hint="At least 8 characters">
            <Input id="pw-new" type="password" autoComplete="new-password" value={f.values.password} onChange={(e) => f.set("password")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
