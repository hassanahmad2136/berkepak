/**
 * Saleor GraphQL queries for the storefront.
 *
 * All queries target the `default-channel` (configurable via variable).
 * Attribute slugs must match the ones created in the Saleor dashboard —
 * see the seed script / README for the canonical list.
 */

// ---------------------------------------------------------------------------
// All products (used by Homepage, Shop/PLP, generateStaticParams)
// ---------------------------------------------------------------------------
export const PRODUCTS_QUERY = /* GraphQL */ `
  query AllProducts($channel: String!, $first: Int!) {
    products(first: $first, channel: $channel, sortBy: { field: NAME, direction: ASC }) {
      edges {
        node {
          id
          name
          slug
          description
          seoDescription
          isAvailableForPurchase
          media {
            url
            alt
          }
          attributes {
            attribute {
              slug
            }
            values {
              name
              value
            }
          }
          variants {
            id
            name
            sku
            quantityAvailable
            pricing {
              price {
                gross {
                  amount
                  currency
                }
              }
            }
          }
          productType {
            slug
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Single product by slug (used by PDP)
// ---------------------------------------------------------------------------
export const PRODUCT_BY_SLUG_QUERY = /* GraphQL */ `
  query ProductBySlug($slug: String!, $channel: String!) {
    product(slug: $slug, channel: $channel) {
      id
      name
      slug
      description
      seoDescription
      isAvailableForPurchase
      media {
        url
        alt
      }
      attributes {
        attribute {
          slug
        }
        values {
          name
          value
        }
      }
      variants {
        id
        name
        sku
        quantityAvailable
        pricing {
          price {
            gross {
              amount
              currency
            }
          }
        }
      }
      productType {
        slug
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Checkout mutations (Phase 4 — Saleor inventory sync)
// ---------------------------------------------------------------------------

export const CHECKOUT_CREATE_MUTATION = /* GraphQL */ `
  mutation CheckoutCreate($channel: String!, $lines: [CheckoutLineInput!]!, $email: String!) {
    checkoutCreate(input: { channel: $channel, lines: $lines, email: $email }) {
      checkout {
        id
        shippingMethods {
          id
          name
        }
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const CHECKOUT_SHIPPING_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  mutation CheckoutShippingAddressUpdate(
    $id: ID!
    $shippingAddress: AddressInput!
  ) {
    checkoutShippingAddressUpdate(
      id: $id
      shippingAddress: $shippingAddress
    ) {
      checkout {
        id
        shippingMethods {
          id
          name
        }
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const CHECKOUT_BILLING_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  mutation CheckoutBillingAddressUpdate(
    $id: ID!
    $billingAddress: AddressInput!
  ) {
    checkoutBillingAddressUpdate(
      id: $id
      billingAddress: $billingAddress
    ) {
      checkout {
        id
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const CHECKOUT_DELIVERY_METHOD_UPDATE_MUTATION = /* GraphQL */ `
  mutation CheckoutDeliveryMethodUpdate(
    $id: ID!
    $deliveryMethodId: ID!
  ) {
    checkoutDeliveryMethodUpdate(
      id: $id
      deliveryMethodId: $deliveryMethodId
    ) {
      checkout {
        id
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const CHECKOUT_COMPLETE_MUTATION = /* GraphQL */ `
  mutation CheckoutComplete($id: ID!) {
    checkoutComplete(id: $id) {
      order {
        id
        number
      }
      errors {
        field
        message
        code
      }
    }
  }
`;
