/**
 * Utilities for Gmail and communication actions across all Jarvis CRM dashboards.
 * Direct Gmail compose URL standard:
 * https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...
 */

export const getGmailUrl = (
  to?: string | null,
  subject?: string,
  body?: string,
  fromEmail?: string | null
): string => {
  // Determine sender ("From") email of the currently logged in user
  let senderEmail = fromEmail;
  if (!senderEmail) {
    try {
      const stored = localStorage.getItem("jarvis_user");
      if (stored) {
        const u = JSON.parse(stored);
        senderEmail = u?.email;
      }
    } catch {}
  }

  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  params.set("tf", "cm");

  // "To" must strictly be the recipient lead's or company's email
  const cleanTo = (to || "").trim();
  const cleanFrom = (senderEmail || "").trim();

  if (cleanTo && !cleanTo.includes("*")) {
    params.set("to", cleanTo);
  }

  // "From" in Google Mail compose is chosen via `authuser`
  if (cleanFrom) {
    params.set("authuser", cleanFrom);
  }

  if (subject) {
    params.set("su", subject.trim());
  }
  if (body) {
    params.set("body", body.trim());
  }
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const getMailtoUrl = (
  to?: string | null,
  subject?: string,
  body?: string
): string => {
  const cleanTo = (to || "").trim();
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject.trim());
  if (body) params.set("body", body.trim());
  const queryString = params.toString();
  return `mailto:${cleanTo}${queryString ? "?" + queryString : ""}`;
};

export const openMailto = (
  to?: string | null,
  subject?: string,
  body?: string
): void => {
  const url = getMailtoUrl(to, subject, body);
  window.location.href = url;
};

export const openGmail = (
  to?: string | null,
  subject?: string,
  body?: string,
  fromEmail?: string | null
): Window | null => {
  const url = getGmailUrl(to, subject, body, fromEmail);
  return window.open(url, "_blank", "noopener,noreferrer");
};

import { getWhatsAppDigits } from "./phoneHelper";

export const getWhatsAppUrl = (
  phone?: string | null,
  text?: string
): string => {
  if (!phone) return "https://web.whatsapp.com";
  const params = new URLSearchParams();
  if (!phone.includes("*")) {
    const waDigits = getWhatsAppDigits(phone);
    if (waDigits) {
      params.set("phone", waDigits);
    }
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
