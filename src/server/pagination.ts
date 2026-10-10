import { PAGE_SIZE } from "@/lib/validation";

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function pageWindow(page: number, pageSize = PAGE_SIZE) {
  const p = Math.max(1, Math.floor(page) || 1);
  return { limit: pageSize, offset: (p - 1) * pageSize, page: p, pageSize };
}

export function paged<T>(rows: T[], total: number, page: number, pageSize = PAGE_SIZE): Paged<T> {
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
