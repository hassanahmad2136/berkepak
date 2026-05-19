/**
 * Lightweight Saleor GraphQL client.
 *
 * Uses the native `fetch` so Next.js can apply its caching / revalidation
 * layer transparently. No external dependencies.
 */

const SALEOR_API_URL = process.env.NEXT_PUBLIC_SALEOR_API_URL ?? "";
const SALEOR_APP_TOKEN = process.env.SALEOR_APP_TOKEN ?? "";

export class SaleorError extends Error {
  constructor(
    message: string,
    public graphqlErrors?: Array<{ message: string }>,
  ) {
    super(message);
    this.name = "SaleorError";
  }
}

/**
 * Send a GraphQL request to the Saleor API.
 *
 * @param query   - GraphQL query/mutation string
 * @param variables - Query variables
 * @param options - Extra fetch options (e.g. revalidate, cache, tags)
 * @returns The `data` portion of the GraphQL response, typed as `T`.
 */
export async function saleorFetch<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number; cache?: RequestCache; tags?: string[] } = {},
): Promise<T> {
  if (!SALEOR_API_URL) {
    throw new SaleorError(
      "NEXT_PUBLIC_SALEOR_API_URL is not set. Saleor integration is disabled.",
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (SALEOR_APP_TOKEN) {
    headers["Authorization"] = `Bearer ${SALEOR_APP_TOKEN}`;
  }

  const res = await fetch(SALEOR_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    next: {
      revalidate: options.revalidate ?? 60, // ISR: refetch every 60 s
      tags: options.tags,
    },
    cache: options.cache,
  });

  if (!res.ok) {
    throw new SaleorError(
      `Saleor HTTP ${res.status}: ${res.statusText}`,
    );
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new SaleorError(
      `Saleor GraphQL error: ${json.errors[0].message}`,
      json.errors,
    );
  }

  return json.data as T;
}

/** Returns `true` when the Saleor env vars are configured. */
export function isSaleorConfigured(): boolean {
  return Boolean(SALEOR_API_URL);
}
