# Bedesi website and order desk

The main website uses the user-supplied restaurant interior as its colour reference: a navy/ivory palette with orange accents, serif hero headline, layered restaurant-menu photography, readable dark text, and no ornamental badge or star graphics.

## Entry points

- `/` — restaurant homepage.
- `/delivery.html` — delivery menu, portion choices, separate basket and address checkout.
- `/table-menu.html?table=07` — existing table menu.
- `/?table=07` and `/index.html?table=07` — backward-compatible QR links; the server serves the table menu.
- `/admin.html` — order desk. For this local preview it is restricted to the restaurant computer: `http://127.0.0.1:8083/admin.html`. LAN requests to the admin page/API receive 403.

Run `python server.py --host 0.0.0.0 --port 8083` for phone access on the same Wi-Fi. `python server.py` defaults to loopback port 8081. Keep the server running while using the preview.

## Delivery requests

Orders go to the local SQLite `delivery_orders` table, not WhatsApp. The server validates customer details, calculates prices from the catalogue, and deduplicates retries using the request UUID. Existing table orders remain in the original `orders` table.

Requests start at `received`. The customer sees that restaurant confirmation is pending. The admin confirms delivery availability and the delivery charge before accepting, then can move an order through preparing, out for delivery and delivered. Declining is supported before preparation. The server rejects invalid state jumps and records status history.

The site does not collect payment, dispatch a driver, or send automated SMS/WhatsApp messages. Call/WhatsApp contact links use the user-supplied number 9394683474. Delivery service area/charges and the full street address have not been supplied; the website identifies the location as Kokrajhar and avoids promising delivery coverage or timing.

## Validation

`python output/verify-restaurant.py` runs API regression checks against a disposable temporary SQLite database. Add `--serve` to retain an isolated QA server on `127.0.0.1:8085` for the browser script at `output/playwright/verify-main-site.js`.

Checked: homepage menu discovery, delivery search/cart/checkout, delivery-to-admin visibility, full status progression and persistence, retry deduplication, server prices, request validation, origin checks, QR compatibility, existing table checkout/back navigation, and responsive widths from 320px through desktop. Browser QA fixtures were written only to the temporary database.

## Before public launch

GitHub Pages serves a public static website/menu preview. Python ordering/admin remain local; Google indexing has not been verified. Production needs hosting/domain/HTTPS, authenticated admin access, durable storage/backups, restaurant delivery operations and confirmed street address/coverage. Replace the loopback admin restriction with an authenticated production access model before enabling remote administration. No public-indexing or live-fulfillment claim has been made.

The user-supplied interior photograph is saved at `assets/bedesi-kokrajhar-interior.png` and used in the contact/visit section. Primary action orange is #bc4c16; navy text is #152841; page ivory is #fffaf3. The QR table-menu palette remains separate.

Final user-approved exact palette: Navy #102443, Ivory #FBF6ED, Terracotta #C94F1D and Brass gold #D7AC62. This supersedes the approximate colours above.

Typography/design refinement: consolidated `website.css`; local Fraunces 700 for restaurant headings and Jakarta 500/600/700 for readable body/UI text. Menu discovery now uses underline selection and larger add actions; the delivery explainer uses navy with ivory text. Homepage and delivery layouts checked at 320, 393, 768, 1024 and 1440px without horizontal overflow.

GitHub Pages uses `pages-runtime.js` to preserve project-subdirectory links and QR redirects. Public checkout is disabled explicitly, and the public admin URL opens a status page without order data. Local Python-backed functionality remains enabled.
