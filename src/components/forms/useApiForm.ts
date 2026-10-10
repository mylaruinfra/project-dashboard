"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormValues = { [key: string]: any };

/**
 * Minimal form state for modal forms: values, field errors from the server envelope,
 * busy flag, and submit() that toasts, refreshes server data and returns the result.
 */
export function useApiForm<V extends FormValues>(initial: V) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const set = useCallback(
    <K extends keyof V>(key: K) =>
      (value: V[K]) => {
        setValues((v) => ({ ...v, [key]: value }));
        setErrors((e) => {
          if (!e[key as string]) return e;
          const { [key as string]: _drop, ...rest } = e;
          return rest;
        });
      },
    [],
  );

  const submit = useCallback(
    async <T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData; success?: string; refresh?: boolean } = {}): Promise<T | null> => {
      setBusy(true);
      const res = await api<T>(url, { method: opts.method ?? "POST", body: opts.form ? undefined : (opts.body ?? values), form: opts.form });
      setBusy(false);
      if (!res.ok) {
        setErrors(res.error.fields ?? {});
        toast(res.error.message, "error");
        return null;
      }
      setErrors({});
      if (opts.success) toast(opts.success);
      if (opts.refresh !== false) router.refresh();
      return res.data;
    },
    [values, toast, router],
  );

  const reset = useCallback((v: V) => {
    setValues(v);
    setErrors({});
  }, []);

  return { values, setValues, set, errors, setErrors, busy, submit, reset };
}

/** For one-off actions (void, archive, status) outside a form. */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  return useCallback(
    async <T = unknown>(url: string, body?: unknown, opts: { method?: string; success?: string } = {}): Promise<T | null> => {
      const res = await api<T>(url, { method: opts.method ?? "POST", body });
      if (!res.ok) {
        toast(res.error.message, "error");
        return null;
      }
      if (opts.success) toast(opts.success);
      router.refresh();
      return res.data;
    },
    [toast, router],
  );
}
