# Bnafsaji marketplace reference analysis

The supplied 1536 × 1024 image is a presentation collage of separate responsive and role-specific views. Its panel coordinates below are approximate visual bounds measured from the image; they are not production CSS measurements.

## Screen inventory

| Approximate panel | Intended view | Existing route |
| --- | --- | --- |
| x 328–1066, y 2–750 | Desktop marketplace: compact header, wide photo-led hero, category tiles, six featured shops, six product cards | `/ar` or `/en` |
| x 13–309, y 203–756 | Mobile marketplace with a stacked hero, two-column products, and bottom navigation | Responsive `/ar` or `/en` |
| x 1073–1526, y 2–320 | Product detail: thumbnail rail, large image, price and variants | `/:locale/p/:shopSlug/:slug` |
| x 1073–1526, y 328–562 | Cart grouped by seller with line items, total, and checkout action | `/:locale/cart` |
| x 1073–1526, y 571–750 | Order status timeline and delivery progress | No order-tracking route is implemented in this project |
| x 411–830, y 765–1015 | Public seller storefront: identity header, store details, product grid | `/:locale/s/:slug` |
| x 10–403, y 765–1015 | Seller workspace with compact sidebar, sales summary, chart, orders, products | `/:locale/seller` |
| x 842–1011, y 765–1015 | Sign-in / account panel | `/:locale/account` |

The lower-right process diagrams explain buyer and seller flows; they are explanatory panels rather than application screens. The supplied image includes a checkout button and order tracking, but this checkout is currently unavailable and there is no tracking route. Those commerce capabilities were not fabricated as part of the visual pass.

## Visual system

- Page background `#080c17`, dark surfaces `#111625` and `#151b2c`, thin blue-violet borders, lavender text accents, and purple primary actions.
- Arabic is the default locale, set with document `lang="ar"` and `dir="rtl"`; English remains available through the existing locale switch. Prices use the existing JOD formatter.
- Keep the desktop header and controls short, with dense cards, roughly square product photography, 6 columns on wide screens, and 2 columns on narrow screens.
- Use small rectangular category tiles and cards with modest radii. Avoid oversized headings, bright page backgrounds, and decorative gradients that compete with product photography.
- At mobile widths, the header and search stack above the catalog and a persistent five-item navigation bar anchors the bottom edge.

## Implementation notes

The storefront retains its existing data and behavior. The local `?showcase=1` preview uses six example products whose image crops come from the user-provided reference, keeping the product photography aligned with the collage without using the collage as a page background. Production catalog records and their uploaded images are unchanged. The visual tokens and route styling are shared through `apps/web/app/showcase.css`.
