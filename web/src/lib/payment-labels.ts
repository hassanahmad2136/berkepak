import { SITE } from "./site";

/** One set of labels, so the account area, order page and admin never disagree. */

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on Delivery",
  bank_transfer: "Direct Bank Transfer",
  online: SITE.payments.gatewayName,
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  awaiting_receipt: "Awaiting transfer details",
  awaiting_review: "Awaiting our review",
  approved: "Approved",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};
