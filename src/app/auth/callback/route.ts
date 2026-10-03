import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Google's OAuth token rides along on the Supabase session right after
      // the redirect. Stash it so Phase 3/4 (Calendar + Tasks) can call
      // Google's APIs later without sending you through sign-in again.
      const { provider_token, provider_refresh_token, user } = data.session;

      if (provider_token && user) {
        const row: {
          user_id: string;
          access_token: string;
          refresh_token?: string;
          expires_at: string;
          updated_at: string;
        } = {
          user_id: user.id,
          access_token: provider_token,
          // Google access tokens last ~1 hour; this is an estimate used to
          // decide when Phase 3/4 code should refresh it.
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Google only sends a refresh token on first consent — omit the key
        // (rather than send null) so a later sign-in never erases a stored one.
        if (provider_refresh_token) {
          row.refresh_token = provider_refresh_token;
        }

        await supabase.from("google_tokens").upsert(row, {
          onConflict: "user_id",
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
