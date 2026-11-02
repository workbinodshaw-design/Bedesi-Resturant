# Bedesi Restaurant

Restaurant website, home-delivery requests, table QR menu, and a local order-management panel for Bedesi in Kokrajhar.

The main website uses Navy `#102443`, Ivory `#FBF6ED`, Terracotta `#C94F1D` and Brass `#D7AC62`, local Fraunces/Jakarta fonts, restaurant-menu photography, and the supplied interior photo.

## Public GitHub Pages website

- Homepage: https://workbinodshaw-design.github.io/Bedesi-Resturant/
- Menu preview: https://workbinodshaw-design.github.io/Bedesi-Resturant/delivery.html
- Table 07 QR preview: https://workbinodshaw-design.github.io/Bedesi-Resturant/?table=07

The GitHub Pages deployment is a static website/menu preview. It does not submit orders, collect checkout details, or expose the local admin database. Checkout is explicitly disabled there; the Python-backed flows below remain available locally.

## Run

Python 3 is required. The application uses only Python's standard library; no npm installation is needed.

```sh
git clone https://github.com/workbinodshaw-design/Bedesi-Resturant.git
cd Bedesi-Resturant
python server.py --host 0.0.0.0 --port 8083
```

For computer-only access, run `python server.py --port 8083`; this binds to `127.0.0.1`. Keep the server running while using the website. A fresh `orders.sqlite3` is created automatically; existing local order data is deliberately excluded from this repository.

## Every page and link

These links work while the server is running on the restaurant computer.

| Flow | On the restaurant computer | On a phone using the same Wi-Fi |
| --- | --- | --- |
| Main homepage | [Open](http://127.0.0.1:8083/) | [Open](http://192.168.1.36:8083/) |
| Home-delivery menu and checkout | [Open](http://127.0.0.1:8083/delivery.html) | [Open](http://192.168.1.36:8083/delivery.html) |
| QR menu — Table 07 | [Open](http://127.0.0.1:8083/?table=07) | [Open](http://192.168.1.36:8083/?table=07) |
| Direct table-menu page — Table 07 | [Open](http://127.0.0.1:8083/table-menu.html?table=07) | [Open](http://192.168.1.36:8083/table-menu.html?table=07) |
| Table-order preview / checkout | [Open](http://127.0.0.1:8083/order.html?table=07) | [Open](http://192.168.1.36:8083/order.html?table=07) |
| Orders saved in the customer's browser | [Open](http://127.0.0.1:8083/orders.html?table=07) | [Open](http://192.168.1.36:8083/orders.html?table=07) |
| Admin order desk | [Open on restaurant computer](http://127.0.0.1:8083/admin.html) | Restricted to the restaurant computer |

The current phone links use the computer's Wi-Fi address `192.168.1.36`. Replace it if the router assigns another address. For each physical table, put its own `?table=` link in that table's QR code. A URL with no table parameter opens the main homepage; `/?table=07` and `/index.html?table=07` preserve the QR-menu flow.

These are **local preview links**, not publicly hosted URLs. Pushing this repository to GitHub does not publish the Python application. GitHub Pages alone cannot run its order APIs or database.

## Ordering

- Delivery requests are saved to `delivery_orders` and appear in the admin desk. They are **not sent to WhatsApp**.
- Prices and quantities are validated by the server. Retrying the same request does not create another order.
- Delivery starts at **restaurant confirmation pending**. The admin confirms the delivery charge before accepting, then moves the request through preparing, out for delivery and delivered.
- Dine-in orders remain in the original `orders` table. Existing table ordering and browser order history remain separate from the delivery basket.
- Payment is not collected by the website. There is no automatic driver dispatch, SMS, or WhatsApp notification.
- Call and WhatsApp contact links use the supplied number **9394683474**. The supplied location is **Kokrajhar**; a full street address and a delivery-coverage policy have not been supplied.

## Admin access

Open `http://127.0.0.1:8083/admin.html` on the computer running the server. The local preview restricts admin pages and APIs to loopback requests. An IP-based phone link to the admin page returns 403 by design. Do not remove this restriction for public hosting without implementing authenticated access.

## Order desk features

- Daily received/completed counts and confirmed order value, computed for the India calendar day across all stored orders. This value is not a payment-received report.
- Date/channel/status/search filters, waiting-time display, oldest/newest sorting and clickable queue summaries.
- Persistent internal staff notes, with unsaved drafts retained while switching orders or refreshing.
- Selected-order print tickets and CSV export of the filtered list. Customer address/phone and internal notes are excluded from CSV. Formula-like cell values are escaped.
- Pause/resume auto-refresh and retained last-loaded orders during connection errors.
- The working list includes the latest 100 orders per channel; daily overview totals are computed separately across all orders for today.

## Checks

```sh
python output/verify-restaurant.py
```

This runs against an isolated temporary SQLite database. Add `--serve` to retain a disposable browser-QA server at `127.0.0.1:8085`. Browser workflows are in `output/playwright/verify-main-site.js` and `verify-delivery-recovery.js`. The admin desk workflow is covered by `output/playwright/verify-admin-desk.js`.

Validated locally: routing, canonical server prices, delivery validation, retry deduplication, status transitions and persistence, delivery/admin end-to-end flow, network-error recovery, portion selection, QR ordering, and responsive layouts.

Before public launch, configure a domain, HTTPS hosting, durable storage/backups, authenticated admin access, and the restaurant's real delivery operations. See [WEBSITE_HANDOFF.md](WEBSITE_HANDOFF.md) for implementation details and [MENU_SOURCE.md](MENU_SOURCE.md) for menu provenance.
