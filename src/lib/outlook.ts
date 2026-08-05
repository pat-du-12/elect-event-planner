/**
 * Génération de messages ouvrables directement dans le client Outlook
 * installé sur le poste de l'administrateur (fichiers .eml) ou via mailto:.
 * Aucun envoi serveur : c'est Outlook qui envoie le message.
 */

function encodeHeader(value: string) {
  // RFC 2047 pour les accents dans les en-têtes
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  return `=?UTF-8?B?${b64}?=`;
}

function base64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function wrap(b64: string) {
  return (b64.match(/.{1,76}/g) ?? []).join("\r\n");
}

export type EmlAttachment = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

export function buildEml(options: {
  to: string;
  subject: string;
  body: string;
  attachment?: EmlAttachment | null;
}) {
  const { to, subject, body, attachment } = options;
  const boundary = `----ird-${Math.random().toString(36).slice(2)}`;
  const headers = [
    "MIME-Version: 1.0",
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "X-Unsent: 1", // ouvre le message en brouillon éditable dans Outlook
  ];

  const textPart = [
    `Content-Type: text/plain; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap(base64(new TextEncoder().encode(body))),
  ].join("\r\n");

  if (!attachment) {
    return [...headers, textPart].join("\r\n");
  }

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    textPart,
    "",
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    "",
    wrap(base64(attachment.bytes)),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function safeName(value: string) {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 60);
}

export function downloadEml(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "message/rfc822" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(filename)}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function openInOutlook(options: {
  to: string;
  subject: string;
  body: string;
  attachment?: EmlAttachment | null;
  filename?: string;
}) {
  downloadEml(
    options.filename ?? `${options.subject}-${options.to}`,
    buildEml(options),
  );
}

export function openMailto(to: string, subject: string, body: string) {
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
