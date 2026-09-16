import "server-only";
import { mockProvider } from "./providers/mock";
import { oneLinkProvider } from "./providers/onelink";
import { payFastProvider } from "./providers/payfast";
import { PaymentConfigError, type PaymentProvider } from "./types";

/**
 * Which gateway is live. Swapping provider is an env change, not a code change
 * — that is the entire point of the abstraction.
 */
const PROVIDERS: Record<string, PaymentProvider> = {
  [mockProvider.name]: mockProvider,
  [oneLinkProvider.name]: oneLinkProvider,
  [payFastProvider.name]: payFastProvider,
};

export function getProvider(name?: string): PaymentProvider {
  const configured = name ?? process.env.PAYMENTS_PROVIDER ?? "mock";
  const provider = PROVIDERS[configured];

  if (!provider) {
    throw new PaymentConfigError(
      `Unknown payments provider "${configured}". Known: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }

  // The simulator settles payments without money moving. Reaching production
  // with it enabled would mark orders paid for free, so refuse outright rather
  // than trusting a deployment checklist.
  if (provider.name === "mock" && process.env.NODE_ENV === "production") {
    throw new PaymentConfigError(
      "The mock payments provider cannot run in production. Set PAYMENTS_PROVIDER to a real gateway.",
    );
  }

  return provider;
}

export function isOnlinePaymentEnabled(): boolean {
  try {
    getProvider();
    return true;
  } catch {
    return false;
  }
}

/** The name checkout shows for the online option. */
export function onlinePaymentLabel(): string {
  try {
    return getProvider().displayName;
  } catch {
    return "Pay online";
  }
}
