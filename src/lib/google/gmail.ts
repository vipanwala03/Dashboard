import { googleFetch } from "./fetch";

// One address, no whitespace or header-breaking characters. Deliberately
// simple — Gmail does the real validation when it sends.
export const EMAIL_PATTERN = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

// Non-ASCII header text (subjects with accents, emoji) has to be wrapped as
// an RFC 2047 "encoded word" or Gmail shows garbage.
function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// Sends a plain-text email from the signed-in user's Gmail account (needs the
// gmail.send scope). Callers must validate `to` with EMAIL_PATTERN first —
// that check is also what keeps CR/LF out of the headers.
export async function sendEmail(
  accessToken: string,
  { to, subject, body }: { to: string; subject: string; body: string }
): Promise<{ id: string }> {
  if (!EMAIL_PATTERN.test(to) || /[\r\n]/.test(subject)) {
    throw new Error("Invalid recipient or subject.");
  }

  const message = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    // Base64 body wrapped at 76 characters, per the MIME spec.
    (
      Buffer.from(body, "utf8")
        .toString("base64")
        .match(/.{1,76}/g) ?? []
    ).join("\r\n"),
  ].join("\r\n");

  return googleFetch(
    "Gmail",
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    accessToken,
    {
      method: "POST",
      body: { raw: Buffer.from(message, "utf8").toString("base64url") },
    }
  );
}
