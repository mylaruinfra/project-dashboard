"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useApiForm } from "@/components/forms/useApiForm";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/domain";

const ROLE_HINT: Record<Role, string> = {
  ADMIN: "Everything, including users and settings",
  MANAGER: "Everything except users",
  ENGINEER: "Field work on assigned projects; never sees money",
  VIEWER: "Read-only",
};

export function UserButton({ user }: { user?: { id: string; name: string; email: string; phone: string | null; role: Role } }) {
  const [open, setOpen] = useState(false);
  const init = { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", role: (user?.role ?? "ENGINEER") as string, password: "" };
  const f = useApiForm(init);
  return (
    <>
      <Button variant={user ? "secondary" : "primary"} size={user ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {user ? "Edit" : "Add user"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={user ? "Edit user" : "Add user"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = user ? await f.submit(`/api/users/${user.id}`, { method: "PUT", success: "User saved" }) : await f.submit("/api/users", { success: "User added" });
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Name" htmlFor="us-name" required error={f.errors.name}>
            <Input id="us-name" value={f.values.name} onChange={(e) => f.set("name")(e.target.value)} />
          </Field>
          <Field label="Email (sign-in)" htmlFor="us-email" required error={f.errors.email}>
            <Input id="us-email" type="email" autoComplete="off" value={f.values.email} onChange={(e) => f.set("email")(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="us-phone" error={f.errors.phone}>
            <Input id="us-phone" type="tel" value={f.values.phone} onChange={(e) => f.set("phone")(e.target.value)} />
          </Field>
          <Field label="Role" htmlFor="us-role" required error={f.errors.role} hint={ROLE_HINT[f.values.role as Role]}>
            <Select id="us-role" value={f.values.role} onChange={(e) => f.set("role")(e.target.value)} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          </Field>
          {!user ? (
            <Field label="Starting password" htmlFor="us-pass" required error={f.errors.password} hint="At least 8 characters. Ask them to change it after signing in.">
              <Input id="us-pass" type="password" autoComplete="new-password" value={f.values.password} onChange={(e) => f.set("password")(e.target.value)} />
            </Field>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
