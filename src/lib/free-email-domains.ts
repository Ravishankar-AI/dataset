/**
 * Common free/personal email providers -- registration rejects these to cut
 * down on throwaway/bot signups, on the assumption that a real prospective
 * customer registers with their company email. Not exhaustive (there's no
 * way to enumerate every provider), just the handful that account for the
 * overwhelming majority of free-mail signups.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.us",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "rediffmail.com",
  "qq.com",
  "163.com",
  "126.com",
  "naver.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
]);

export function isFreeEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop();
  return Boolean(domain && FREE_EMAIL_DOMAINS.has(domain));
}
