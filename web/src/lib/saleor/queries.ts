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
