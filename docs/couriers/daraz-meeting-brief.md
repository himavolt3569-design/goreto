# Daraz Express (DEX): meeting brief

_For the Goreto.store owner, before meeting Daraz on 2026-10-07. Plain language. The technical reference is [daraz.md](daraz.md)._

## 1. What we are setting up

**Daraz Express (DEX)** is Daraz's own delivery company. Since November 2025 it also delivers parcels for shops that don't sell on daraz.com.np, which is our case. Goreto sells on its own website and through WhatsApp, and DEX will carry our parcels and collect the cash (Cash on Delivery).

We connect Goreto to DEX through Daraz's **Logistics API**. Once connected, staff work entirely inside Goreto's admin:

1. A customer orders on the website or on WhatsApp, and staff accept the order. This is the same as today.
2. Staff click **Book with Daraz**. Goreto sends the parcel details to DEX and gets back a **tracking number**.
3. Staff print the **shipping label (AWB)**, stick it on the parcel, and click **Ready to ship**.
4. DEX picks up the parcel. Goreto checks DEX's tracking regularly and records each step: picked up, in transit, out for delivery, delivered. Customers see these steps on their tracking page.
5. DEX collects the cash from the customer. DEX pays it to the store's bank account **several times a week, about 3–5 business days after delivery**. Goreto keeps a record of which orders each payment covered.
6. If a delivery fails, Goreto alerts staff, who choose **try again** or **return to store**.

We are **not** listing products on the Daraz marketplace. That would be a separate project.

## 2. There are two Daraz accounts

| Account | What it is | Who creates it | Where |
| --- | --- | --- | --- |
| **DEX merchant account ("OMS")** | The store's delivery account. DEX's own dashboard for the store: shipments, COD payouts, bills. It's also where the store generates the **link code (OTP)** that lets Goreto ship on its behalf. | **The client (store owner)**, with Daraz's sales team | `oms.dex.com.np` |
| **Daraz Open Platform developer account and app** | The technical account. It gives Goreto an **App Key** and **App Secret** to call the DEX API. | The client owns it. We (the developers) set up the app. | `open.daraz.com` (sign-up: `iopaccount.daraz.com/register`) |

## 3. What the client should bring

DEX asks merchants for the following (based on DEX's merchant pages; confirm the exact list for Nepal):

- Business registration certificate and PAN/VAT (or citizenship for an individual).
- Bank account details: account name, number, bank and branch, or a cheque copy. COD payouts go here.
- **Pickup address** (where DEX collects parcels) with a contact name and phone number.
- **Return address**, if different (where failed parcels come back).
- Expected parcel volume (per day or week), typical parcel size and weight, and product types. DEX refuses some items, such as liquor, currency and hazardous goods.
- A contact person for DEX operations and one for technical matters.

## 4. What we give Daraz

| Item | Value |
| --- | --- |
| Store / platform name | Goreto.store |
| Website | https://goreto-kappa.vercel.app (a custom domain is planned) |
| How we integrate | Our own system calls the DEX Logistics API (EPIS): create package → label → ready to ship → tracking → cancel. COD only. |
| App category we request | **Logistics** (or whichever category Daraz says covers DEX partner integrations) |
| Workflow diagram (the app form asks for one) | [daraz-workflow.svg](daraz-workflow.svg). Open it in a browser and save it as PNG. |
| Callback URL (app form field) | https://goreto-kappa.vercel.app/admin/daraz |
| Webhook URL (push notifications) | https://goreto-kappa.vercel.app/api/courier/webhooks/daraz |
| Pickup and return address | From section 3 |
| Expected volume | From section 3 |
| Technical contact | The developer |

## 5. What Daraz must give us

Ask Daraz for each of these and write the answer down:

- [ ] **App Key** and **App Secret** for our Open Platform app, with the **Logistics API (EPIS)** permission switched on for Nepal.
- [ ] Our **platform name** (`platformName`) as Daraz has registered it.
- [ ] The **external seller ID** convention (`externalSellerId`): do we choose it, or do they?
- [ ] How to generate the **OTP / bundle code** in the DEX merchant account (OMS), and confirmation that the client's OMS account is active.
- [ ] Nepal **solution codes** (`solutionCodes`) for COD delivery. Pakistan's example is `DARAZ_STANDARD_PK`.
- [ ] The **Daraz location ID (R-code)** for our pickup and return addresses, and the **full Nepal location list** (a spreadsheet is fine).
- [ ] A **test (sandbox) environment** or a test account, if one exists.
- [ ] **Price list** (per weight slab, COD fee, return fee) and how the **monthly bill** works.
- [ ] A sample **COD settlement statement**.
- [ ] Contacts: technical support (API), operations (pickups, failed deliveries), finance (payouts).

## 6. Questions to ask Daraz

**Account and approval**

1. Which app category should we choose for a DEX partner integration? Is there an approval step, and does the "1,000 API calls a day for 2 weeks" test rule apply to us?
2. Is there a sandbox URL and test account for Nepal, or do we test on live with test parcels we cancel?
3. Do you require us to call from fixed IP addresses (an **IP whitelist**)? Our servers don't have fixed IPs unless we pay extra for them.
4. When you say "dashboard", which one do you mean? See section 8. Do you need to see a demo of our admin screen before go-live?

**Booking**

5. Should we book with "create package" (`/logistics/epis/packages`) or "consign" (`/packages/consign`)? Does "create" return the tracking number immediately?
6. Which delivery options exist in Nepal (`standard`, `economy`)? What are the transit times?
7. Phone number format: `98XXXXXXXX` or `+97798XXXXXXXX`? Currency code `NPR`?
8. Must every address carry a Daraz location ID (R-code), or is a full text address enough?
9. Should we declare an insurance amount? What does it cost, and how do claims work?
10. Are the "delivery options" and "estimate shipping fee" APIs enabled in Nepal? (Then staff can see the DEX fee before booking.)
11. Label (AWB) format: PDF and/or thermal (ZPL)? What label size?
12. Pickup: what's the daily pickup cutoff time? Is pickup automatic after "ready to ship", or do we schedule it? Can we drop parcels at a hub instead?

**Tracking and webhooks**

13. Please send the full list of **parcel statuses** and **failure reason codes** used in Nepal.
14. Do you send **webhook (push) notifications** for DEX parcels, and what does the message look like? Which message type do we subscribe to in the App Console?
15. Your docs require the webhook address to have an **OV or EV SSL certificate**. Our current address has a standard (DV) certificate. Is this enforced for DEX partners? If so, we will either rely on regular status checks or set up a certified address.
16. Is there a public tracking page for Nepal we can link customers to (for example `…/tracking?no=TRACKING`)?
17. Any API rate limits?

**Failed deliveries and returns**

18. How many delivery attempts are made, and how long do you hold a parcel before returning it?
19. Do failed deliveries or returns cost anything?

**Money**

20. How often is COD paid out, and how many days after delivery?
21. Are DEX fees deducted from COD payouts, or billed monthly?
22. Can we download settlement statements (CSV/Excel) from OMS, and what columns do they have?

**Support**

23. How do we raise a support case (lost or damaged parcel, wrong status)? Your API has support tickets (XSpace). Which case template and category IDs should we use?

## 7. How the money moves

```
Customer pays cash to the DEX rider
        │
        ▼
DEX holds the cash (Goreto shows the order as "COD with Daraz")
        │  3–5 business days, several payouts a week
        ▼
DEX pays the store's bank account (Goreto: record the settlement, matched to orders)
        │
        ▼
DEX fees: deducted from payouts or billed monthly (to confirm)
```

- Goreto still works only in **Cash on Delivery**. No online payments.
- An order shows **"Collected"** in Goreto when DEX reports it delivered: the customer has paid the rider. It shows **"Settled"** once staff record the DEX payout that included it.
- The "COD with Daraz" figure on the Daraz dashboard is the cash DEX holds for us that hasn't been paid out yet.

## 8. What "dashboard" can mean

Daraz may use the word for any of three things. We cover all three:

1. **The DEX merchant dashboard (OMS, `oms.dex.com.np`)**, Daraz's own screen for the store. The client logs in to see shipments, payouts and bills, and to generate the link code. **The client signs up for this.**
2. **The Daraz Open Platform App Console**, the developer screen where the app, keys, API permissions, webhook URL and API statistics live. **We set this up**, under the client's account.
3. **Goreto's own Daraz Express dashboard**, the screen inside Goreto's admin where staff book parcels, print labels, track deliveries, handle failed deliveries, raise support cases and match COD payouts. Partner platforms are expected to have one; Daraz's own Shopify app is exactly this. **We built this**, and can demo it to Daraz.

## 9. What happens after the meeting

1. The client creates or activates the DEX merchant account (OMS) and the Daraz Open Platform account.
2. We create the app, request the Logistics API permission, and put the App Key and App Secret into Goreto. They're never shared in chat or email; we enter them directly in the hosting settings.
3. In Goreto: **Admin › Daraz Express › Setup**:
   - **Test connection**;
   - enter the platform name and seller ID;
   - paste the OMS link code (**Link account**);
   - save the pickup and return warehouses.
4. Mark "Daraz Express" as the courier (Admin › Delivery & Courier) and set delivery prices.
5. Book one real test parcel, print the label, then cancel it. Then go live.
6. Add Daraz's answers (statuses, phone format, location list) to Goreto. These are settings, not new development.
