import type { SupabaseClient } from "@supabase/supabase-js";

// Thrown when the stored Google tokens can't be used or refreshed (never
// stored, refresh token missing, or revoked). The fix is always the same:
// sign in with Google again so the auth callback stores fresh tokens.
export class GoogleReauthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleReauthRequiredError";
  }
}

// Refresh a minute early so a token never expires mid-request.
const EXPIRY_MARGIN_MS = 60 * 1000;

// Returns a usable Google access token for the signed-in user, refreshing it
// through Google's token endpoint (and saving the new one) when it's expired.
// Shared by Calendar (Phase 3) and Tasks (Phase 4).
export async function getGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: row, error } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Couldn't read Google tokens: ${error.message}`);
  }
  if (!row) {
    throw new GoogleReauthRequiredError("No Google tokens stored yet.");
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return row.access_token;
  }

  if (!row.refresh_token) {
    throw new GoogleReauthRequiredError("No Google refresh token stored.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set — they're needed to refresh Google access tokens."
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // invalid_grant = the refresh token was revoked or expired (e.g. access
    // was removed in the Google account settings).
    if (body.error === "invalid_grant") {
      throw new GoogleReauthRequiredError("Google refresh token was revoked.");
    }
    throw new Error(
      `Google token refresh failed (${res.status}): ${body.error ?? "unknown error"}`
    );
  }

  const token: { access_token: string; expires_in: number } = await res.json();

  await supabase
    .from("google_tokens")
    .update({
      access_token: token.access_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return token.access_token;
}
