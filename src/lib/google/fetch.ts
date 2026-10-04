import { GoogleReauthRequiredError } from "./tokens";

// Calls a Google REST API with the user's access token and returns the
// parsed JSON. `apiName` only shows up in error messages.
export async function googleFetch<T>(
  apiName: string,
  url: string,
  accessToken: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new GoogleReauthRequiredError(
      `${apiName} rejected the access token.`
    );
  }
  if (!res.ok) {
    // 403s are usually "API not enabled" or a missing scope — Google's
    // message says which, so pass it through.
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `${apiName} request failed (${res.status}): ${body.error?.message ?? "unknown error"}`
    );
  }

  return res.json();
}
