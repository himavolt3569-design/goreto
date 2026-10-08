# Daraz Express: requests, questions and answers

A running record of what was asked during the Daraz Express (DEX) integration, what was decided, and the answers given. Use it to look back, or when something doesn't work.

Related:
- Technical reference: [daraz.md](daraz.md)
- Client handout: [daraz-meeting-brief.md](daraz-meeting-brief.md)
- Approved plan: [`prompts/goreto-daraz-courier.md`](../../prompts/goreto-daraz-courier.md)
- Release steps: [`docs/releasing.md`](../releasing.md), § Daraz Express

Contents:
1. [Requests](#1-requests)
2. [Decisions](#2-decisions)
3. [What the research found](#3-what-the-research-found)
4. [Testing without Daraz keys](#4-testing-without-daraz-keys)
5. [Questions and answers](#5-questions-and-answers)
6. [Troubleshooting](#6-troubleshooting)
7. [Still open](#7-still-open)

---

## 1. Requests

| Date | Request | Outcome |
| --- | --- | --- |
| 2026-10-06 | "Fix the courier option. Go through the entire daraz.com.np courier API platform and apply it to our website. Be prepared for whatever they need and whatever they ask, because the integration of the API or any webhook is scheduled for tomorrow." | Researched the Daraz Open Platform and wrote a first plan. The client had earlier ruled out courier APIs (worklog §4.0); this request reverses that for Daraz only. |
| 2026-10-06 | Re-check all the Daraz information so it's right the first time. Review the code and point out anything missing. No "non-goal" items: build whatever Daraz asks for, including "a dashboard for them". Explain what that dashboard means. Write full documentation: what Daraz requires, what to give them, what to ask, and how tracking, ordering and payments work. | Full re-research, a code review (15 problems found), and a revised plan with no non-goals except the marketplace (see §2). Built and documented. |
| 2026-10-07 | "Continue from where you left off." | Finished lint, tests, build, a live smoke test, the docs, and published the meeting brief as a page. |
| 2026-10-07 | "To test, I got no key or secret. What do I do?" | Use the local mock gateway with made-up keys. See §4. |
| 2026-10-07 | The `curl -x POST …` command failed in PowerShell. "Give the proper command." | See §5, Q3. |
| 2026-10-07 | After refreshing, the status didn't automatically change to delivered. Bug or intentional? | Intentional. See §5, Q4. |
| 2026-10-07 | Put all requests, questions and responses in one separate file. | This file. |
| 2026-10-07 | Make Daraz booking and tracking much easier for the client: one button to enter everything and track it on the same page, or have the system sort every order automatically and route it to the right courier. | Built both: **Send & track** (`/admin/parcels`) and **Autopilot**. Plan: [`prompts/goreto-send-and-track.md`](../../prompts/goreto-send-and-track.md). Client guide: [send-and-track.md](send-and-track.md). |
| 2026-10-07 | "There's no option saying send to Daraz Express. Nepal Can Move, Goreto Valley Riders and Pathao are the only 3 options." | See §5, Q8. Renamed the dev courier to Daraz Express, and Daraz-booked options now carry a "Books through Daraz Express" tag. |

## 2. Decisions

| Question | Answer | Decided by, date |
| --- | --- | --- |
| Courier only, or also sell on the Daraz marketplace (daraz.com.np)? | **DEX courier only.** Goreto books its own website and WhatsApp orders with Daraz Express. Marketplace listing is a possible later phase (see [daraz.md](daraz.md) §12). | Project lead, 2026-10-06 |
| What does Daraz mean by "dashboard"? | Nothing in writing, so cover every meaning, and build Goreto's own Daraz Express dashboard. | Project lead, 2026-10-06 |
| Approve the plan? | Approved twice: the first draft, then the revised plan after re-research. | Project lead, 2026-10-06 |
| Which booking call? | `create` (`/logistics/epis/packages`), because DEX's own merchant page documents it. `consign` is available as a setting. **Confirm with Daraz.** | Research |
| Where do the live Daraz keys go? | Vercel **Production only.** Preview and local use the mock, so a test booking is never a real parcel. | Safety rule |
| Can staff book automatically? | Yes, as an option that's off by default (Setup › "Book automatically when an order is accepted"). Each order is tried once; a failure notifies staff. | Plan |
| Other couriers? | Unchanged: manual tracking plus the WhatsApp handoff. | Plan |
| Simpler flow for the client? | **Both**: Send & track (save, accept, route and book in one click, then track on the same page) and Autopilot (one switch over auto-accept, courier routing and Daraz auto-book). | Project lead, 2026-10-07 |
| Can other couriers be sent automatically too? | No. A free `wa.me` link always needs a tap; sending by itself needs the paid WhatsApp Business API. Send & track shows a one-tap **Send on WhatsApp** button instead. | Plan, 2026-10-07 |
| Products with no weight? | A **usual parcel weight** (Daraz Setup, or the Autopilot card) is used when products have none. Daraz weighs parcels at pickup anyway. | Plan, 2026-10-07 |
| Print label and ready to ship: one step or two? | One button on Send & track (**Print label & call pickup**). The order page keeps them separate. A booking can still be canceled until Daraz picks it up. | Plan, 2026-10-07 |

## 3. What the research found

The short version. The full details are in [daraz.md](daraz.md).

- **Two Daraz systems.**
  - **DEX OMS** (`oms.dex.com.np`) is the store's merchant portal: shipments, COD payouts, bills, and the link code (OTP).
  - **Daraz Open Platform** (`open.daraz.com`) is the developer side: the app, its App Key and App Secret, and the Logistics API ("EPIS").
- **No seller login is needed for the courier API.** Requests are signed with the app key and secret. The store is linked once with the OTP code from OMS.
- **Three meanings of "dashboard":**
  - **DEX OMS:** Daraz's portal for the store.
  - **The App Console:** Daraz's developer screen.
  - **Goreto's Admin › Daraz Express:** built by us, and can be demoed to Daraz.
- **Webhooks:**
  - Daraz requires an **OV/EV certificate**. Our Vercel domain has a **DV** one, and Vercel allows uploading your own certificate only on Enterprise.
  - Daraz documents no push message for DEX parcels. So Goreto **polls** Daraz's tracking history, and a push is just an early trigger.
- **Money:** COD pays out 3–5 business days after delivery, several times a week. There is no payout API, so staff record payouts from the OMS statement.
- **Possible costs:**
  - Fixed IPs, if Daraz requires an IP whitelist: about $100 a month on Vercel Pro.
  - An OV certificate relay, if Daraz enforces OV/EV.
- **App approval:** Daraz's guide requires third-party apps to make 1,000 calls a day for two weeks before going online. Ask whether DEX partners are exempt.

## 4. Testing without Daraz keys

You don't need real keys. `npm run daraz:mock` runs a stand-in Daraz on your computer. It checks signatures the same way Daraz does, so the app and the mock must use the same made-up secret. Both read `.env.local`, so they always match.

**1. Add to `.env.local`** (fake values, local only; never put them in Vercel):

```
DARAZ_APP_KEY=test-key
DARAZ_APP_SECRET=test-secret
DARAZ_API_URL=http://localhost:4010
CRON_SECRET=local-cron-secret-123456
```

**2. Start both, in two terminals:**

```
npm run daraz:mock
npm run dev
```

The mock should print: `Daraz mock gateway on http://localhost:4010 (checking signatures)`.

**3. Admin › Daraz Express › Setup** (signed in as owner):
1. Click **Test connection**. It should say the keys were accepted.
2. Fill in the settings with any values, then save. For example:
   - platform name `Goreto`, seller ID `GORETO-STORE`;
   - pickup name, phone `9801234567`, an address;
   - Daraz location ID `R100`, pickup warehouse code `WH_KTM`, solution codes `DARAZ_STANDARD_NP`.
3. **Link account** with any code, for example `L0000001`.
4. Click **Save pickup warehouse with Daraz**.

**4. Admin › Delivery & Courier:** open an existing courier and tick **Booked through the Daraz Express API**. Save, then edit its services and pick a Daraz option.

**5. Book an order:**
1. Accept an order with that courier.
2. In the **Daraz Express** panel: **Book with Daraz**, then **Get fee estimate**, then **Book parcel**. If the products have no weight saved, type one in, for example 500 g.
3. **Print label** (a PDF opens), then **Ready to ship**.
4. **Refresh tracking** moves the parcel one step each time: picked up → sort centre → hub → out for delivery → delivered.

**6. Other paths:**
- **Failed delivery.** Run this in PowerShell, with your tracking number:
  ```powershell
  Invoke-RestMethod -Method Post http://localhost:4010/mock/fail/NPDEX1003
  ```
  Then **Refresh tracking**. The bell alerts you and **Re-attempt or return** appears.
- **See what the mock holds:**
  ```powershell
  Invoke-RestMethod http://localhost:4010/mock/packages
  ```
- **Customer view.** The customer's tracking page shows the same steps.
- **Payout.** Under **Daraz Express › COD settlements**, record a payout by pasting the tracking number.
- **Start over.** Stop the mock; it keeps nothing.

## 5. Questions and answers

### Q1. Does Daraz need a seller login (OAuth) for the courier API?
No. The Logistics (EPIS) endpoints are signed with the app key and secret only. The store's DEX account is linked once with the OTP code from DEX OMS (Setup › Link account).

### Q2. I have no Daraz key or secret. How do I test?
Use the mock gateway with made-up keys. See §4. Real keys go on Vercel Production only, after Daraz issues them.

### Q3. `curl -x POST http://localhost:4010/mock/fail/NPDEX1003` fails in PowerShell. What's the right command?
In Windows PowerShell, `curl` is a shortcut for `Invoke-WebRequest`, which has different options. Also, `-x` (lowercase) means "proxy" in real curl; you need a capital `-X`. Use either:

```powershell
Invoke-RestMethod -Method Post http://localhost:4010/mock/fail/NPDEX1003
curl.exe -X POST http://localhost:4010/mock/fail/NPDEX1003
```

The reply is `ok : True` (or `{"ok":true}`). Then click **Refresh tracking**.

### Q4. After refreshing, the status didn't change to "delivered" by itself. Bug or intentional?
Intentional, for one of three reasons:

1. **A failed parcel waits for a decision.** After `/mock/fail`, the parcel is held, as DEX does, until staff click **Re-attempt or return**.
   - **Try delivering again:** the next refreshes go out for delivery, then delivered.
   - **Return it to the store:** it ends as **Returned**, never delivered.
2. **Reloading the browser isn't Refresh tracking.** Opening an order checks Daraz automatically only when its tracking is more than 15 minutes old. To move the mock parcel, click the **Refresh tracking** button.
3. **One step per refresh.** Booked to delivered takes about five clicks.

With the real Daraz, nothing is button-driven. The status changes when the rider actually acts, and Goreto picks it up through the scheduled sync, an order being opened, Refresh tracking, or a Daraz push.

It **is** a bug if, after **Re-attempt** and several **Refresh tracking** clicks, the parcel never reaches delivered. Note the tracking number and the output of `Invoke-RestMethod http://localhost:4010/mock/packages`.

### Q5. What happens when a customer pays?
- **Collected:** the rider takes the cash and DEX reports the parcel delivered.
- **COD with Daraz:** Daraz holds the cash until it pays out. The dashboard shows the total.
- **Settled:** staff record the payout in **COD settlements**, and Goreto compares expected and paid amounts.

### Q6. Can a booking be cancelled or changed?
- **Before pickup:** **Cancel booking**, then book again. Goreto sends Daraz a new reference such as `<order>-R2`, because Daraz ignores a repeated reference.
- **After ready to ship:** **Edit delivery details** sends the new receiver details to Daraz.
- **After pickup:** it can't be cancelled; use **Return** or a support case.

### Q7. Why doesn't the "Change courier" button appear on a booked order?
A live Daraz booking pins the courier and its tracking number, so the database refuses to change them. Cancel the booking first.

### Q8. Why is there no "Daraz Express" delivery option?
The options come from the **delivery rates** of the zones that cover the address. A courier appears only when one of its services has an active rate in that zone.

On dev, no courier was named Daraz Express. During testing, the "Booked through the Daraz Express API" switch had been turned on for **Nepal Can Move**, so that option was already booking through Daraz. It just didn't say so.

- **Fixed on dev (2026-10-07):** the courier is renamed to **Daraz Express**. It keeps its rates and test bookings. In Kathmandu Valley only its "Pickup Point" service has a rate. Pokhara and the other major cities get both services.
- **In the form:** every option that books through Daraz now shows **Books through Daraz Express**, whatever the courier is called.
- **On production:**
  1. Add a courier named Daraz Express under Delivery & Courier.
  2. Tick **Booked through the Daraz Express API**.
  3. Give each service a Daraz option (Standard or Economy).
  4. Add a rate for it in every delivery zone where Daraz should be offered.

## 6. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Panel says "Daraz Express isn't connected yet" | `DARAZ_APP_KEY` or `DARAZ_APP_SECRET` is missing | Add both to `.env.local` (local) or Vercel Production (live), then restart or redeploy |
| Test connection: "Daraz rejected the app key or secret" | Wrong secret, or the mock and app have different secrets | Locally, both read `.env.local`; restart `npm run daraz:mock` after changing it. Live: check the Vercel values |
| Test connection: "Couldn't reach Daraz" | Mock not running, or wrong URL | Start `npm run daraz:mock`; check `DARAZ_API_URL=http://localhost:4010` |
| Startup error "DARAZ_API_URL must start with https://" | `http://localhost` is only allowed under `npm run dev` | Use `npm run dev` for mock testing, or unset `DARAZ_API_URL` |
| "Finish Daraz setup before booking: …" | Required Setup fields are empty | Fill in the listed fields in Setup and save |
| "This order's courier isn't Daraz Express" | The courier doesn't have the API switch on | Delivery & Courier → courier → tick "Booked through the Daraz Express API" |
| Booking fails with `destination.phone: …` or another field error | Daraz rejected that field | Fix the order or Setup value, then book again. The Activity tab shows the Daraz trace ID |
| "Daraz booked the parcel … but Goreto couldn't save it" | Database write failed after Daraz booked | Click Book again: Daraz returns the same booking |
| Label link doesn't open | Daraz label links expire in 5 minutes | Click Print label again; each click gets a fresh label |
| Status stuck | See §5, Q4 | Click **Refresh tracking**; check the Activity tab for errors |
| `curl` error in PowerShell | `curl` is `Invoke-WebRequest` there | Use `Invoke-RestMethod` or `curl.exe -X POST` (§5, Q3) |
| Mock "not found" for a tracking number | Wrong number, or the mock was restarted | `Invoke-RestMethod http://localhost:4010/mock/packages`; restarting the mock forgets all parcels |

## 7. Still open

- [ ] Daraz's answers to the 23 questions in [daraz-meeting-brief.md](daraz-meeting-brief.md) §6. Record them here when they arrive.
- [ ] Real App Key and Secret on Vercel Production, then the prod migrations (`docs/releasing.md` § Daraz Express).
- [ ] Webhook certificate decision (OV/EV) and IP whitelist answer.
- [ ] Signed-in browser pass with the mock, then one real test parcel (book, label, cancel).
- [ ] Commit and PR for `feat/daraz-courier`.
