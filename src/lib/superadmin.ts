export const DEFAULT_SUPER_ADMIN_EMAIL = "bhaibiz2026@gmail.com";

export function getSuperAdminEmail(): string {
  // Check process.env (Node / SSR / Server functions)
  if (typeof process !== "undefined" && process?.env) {
    const fromEnv = process.env["SUPER_ADMIN_EMAIL"] || process.env["VITE_SUPER_ADMIN_EMAIL"];
    if (fromEnv && fromEnv.trim()) return fromEnv.trim().toLowerCase();
  }
  // Check import.meta.env (Vite client)
  if (typeof import.meta !== "undefined" && import.meta?.env) {
    const fromVite =
      (import.meta.env["VITE_SUPER_ADMIN_EMAIL"] as string | undefined) ||
      (import.meta.env["SUPER_ADMIN_EMAIL"] as string | undefined);
    if (fromVite && fromVite.trim()) return fromVite.trim().toLowerCase();
  }
  return DEFAULT_SUPER_ADMIN_EMAIL.toLowerCase();
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const target = getSuperAdminEmail();
  return email.trim().toLowerCase() === target;
}
