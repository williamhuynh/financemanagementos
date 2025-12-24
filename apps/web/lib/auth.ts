const allowedEmails = new Set(
  ["william.huynh12@gmail.com", "ppkw18@gmail.com"].map((email) =>
    email.trim().toLowerCase()
  )
);

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  return allowedEmails.has(email.trim().toLowerCase());
}
