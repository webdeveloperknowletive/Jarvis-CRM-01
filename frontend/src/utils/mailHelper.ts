/**
 * Utilities for Gmail and communication actions across all Jarvis CRM dashboards.
 * Direct Gmail compose URL standard:
 * https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...
 */

export const getGmailUrl = (
  to?: string | null,
  subject?: string,
  body?: string
): string => {
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  if (to && !to.includes("*")) {
    params.set("to", to.trim());
  }
  if (subject) {
    params.set("su", subject.trim());
  }
  if (body) {
    params.set("body", body.trim());
  }
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const openGmail = (
  to?: string | null,
  subject?: string,
  body?: string
): Window | null => {
  const url = getGmailUrl(to, subject, body);
  return window.open(url, "_blank", "noopener,noreferrer");
};

export const getWhatsAppUrl = (
  phone?: string | null,
  text?: string
): string => {
  if (!phone) return "https://web.whatsapp.com";
  // Remove non-digit characters except leading plus
  const cleanDigits = phone.replace(/[^\d]/g, "");
  const params = new URLSearchParams();
  if (cleanDigits && !phone.includes("*")) {
    params.set("phone", cleanDigits);
  }
  if (text) {
    params.set("text", text);
  }
  return `https://api.whatsapp.com/send?${params.toString()}`;
};

export const openWhatsApp = (
  phone?: string | null,
  text?: string
): Window | null => {
  const url = getWhatsAppUrl(phone, text);
  return window.open(url, "_blank", "noopener,noreferrer");
};
