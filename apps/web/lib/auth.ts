/**
 * Email whitelist removed - now open registration.
 * This function is kept for backward compatibility but always returns true
 * for any valid email. Will be removed in future cleanup.
 * @deprecated Open registration enabled - this check is no longer needed
 */
export function isAllowedEmail(email?: string | null): boolean {
  // Open registration: any valid email is allowed
  return Boolean(email && email.includes("@"));
}
