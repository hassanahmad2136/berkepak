/**
 * Single source for the details that appear in several places (checkout, order
 * lookup, help pages, emails). Change them here, not in the markup.
 */
export const SITE = {
  brand: "Berke Pak Fabrics",
  email: "info@berkepakfabrics.com",
  whatsapp: {
    display: "+92 316 4015442",
    // wa.me wants the number without punctuation.
    href: "https://wa.me/923164015442/?text=Hello%20BerkePak!%20I%20have%20a%20question%20about%20your%20fabrics.",
  },
  shipsFrom: "Lahore, Pakistan",
  freeShippingThresholdPKR: 10_000,
  flatShippingPKR: 350,
  metresPerSuit: 2.75,
  payments: {
    /**
     * PayFast's fee. Listed prices are grossed up by it so the gateway's cut
     * leaves the stored catalog price intact: at 5%, a PKR 3,000 suit lists at
     * PKR 3,158 and PayFast keeps PKR 157.90. Direct bank transfer pays no fee
     * and is charged the stored price. PLACEHOLDER: set it to the rate in your
     * PayFast merchant agreement.
     */
    gatewayFeePercent: 5,
    gatewayName: "PayFast",
  },
  bank: {
    name: "Meezan Bank",
    accountTitle: "BZ Enterprises",
    accountNumber: "02140102913486",
  },
} as const;
