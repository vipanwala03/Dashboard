import type { SupabaseClient } from "@supabase/supabase-js";

// Requests allowed per rolling 24 hours. Every Ask costs real money on the
// owner's Anthropic key, so this caps the worst case (a bug, or someone else
// signing in) at roughly 50 × 1¢.
export const DAILY_LIMIT = 50;

// Claude Sonnet 5.5 list price, in dollars per million tokens. An estimate:
// a refusal fallback to another model would bill at that model's rates.
const INPUT_PER_MILLION = 2;
const OUTPUT_PER_MILLION = 10;

export type AiUsage = {
  requestsLast24h: number;
  // Estimated spend since the start of this month (UTC), in dollars.
  costThisMonth: number;
};

export function estimateCost(inputTokens: number, outputTokens: number) {
  return (
    (inputTokens * INPUT_PER_MILLION + outputTokens * OUTPUT_PER_MILLION) /
    1_000_000
  );
}

// The signed-in user's AI usage (RLS scopes the queries to their own rows).
export async function getAiUsage(supabase: SupabaseClient): Promise<AiUsage> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const [recent, month] = await Promise.all([
    supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
    supabase
      .from("ai_usage")
      .select("input_tokens, output_tokens")
      .gte("created_at", monthStart)
      .limit(10000),
  ]);
  if (recent.error) throw new Error(recent.error.message);
  if (month.error) throw new Error(month.error.message);

  return {
    requestsLast24h: recent.count ?? 0,
    costThisMonth: month.data.reduce(
      (sum, r) => sum + estimateCost(r.input_tokens, r.output_tokens),
      0
    ),
  };
}
