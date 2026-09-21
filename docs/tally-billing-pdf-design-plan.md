# Tally, billing, PDFs and design — the plan

Written 21 Sep 2026. Covers the four things not yet built. The CAPA/vendor-email
item and the backup item from the same list are **done and pushed** (`4ee0d0f`);
they are described at the end so the whole list is in one place.

---

## 1. Tally ERP 9 — can we connect directly?

**Not directly, and nobody can.** This is a property of Tally, not of our build.

Tally.ERP 9 has no cloud API. It exposes an XML-over-HTTP interface on **port
9000**, and only:

- on the machine Tally is installed on, reachable over the LAN,
- while Tally is actually open, with "Act as Gateway" switched on,
- with no authentication of any kind.

Our ERP runs in the cloud. It cannot reach a port inside the Murthal LAN, and
opening that port to the internet would put an unauthenticated write interface to
the company books on the public internet. That is not a trade worth making.

### The three real options

| | How it works | Build | Latency | Network change |
|---|---|---|---|---|
| **A. Connector agent** *(recommended)* | A small Windows service on the Tally PC polls our API over HTTPS, posts XML to `localhost:9000`, writes the Tally voucher ID back | ~2 weeks | 1–5 min | **None** |
| **B. XML file exchange** | ERP generates Tally-format XML; accounts imports via Gateway → Import Data | ~4 days | Manual, batch | None |
| **C. Tally on a cloud VM** | Host Tally where the API can reach it | High — licence, VM, backups, support | Live | Significant |

**Recommendation: B first, then A.**

B is the cheap way to prove the XML mapping is right against real vouchers.
A then automates exactly the same XML with no remapping — the agent is only
transport. The reason A needs no firewall change is that the agent *polls
outward*; nothing from outside ever initiates a connection into the factory.

### What flows, and which way

| Document | Direction | Tally voucher |
|---|---|---|
| GRN (accepted quantity) | ERP → Tally | Purchase |
| Sales invoice | ERP → Tally | Sales |
| Vendor quality claim | ERP → Tally | Debit Note |
| Customer credit note | ERP → Tally | Credit Note |
| Stock journal (production) | ERP → Tally | Stock Journal |
| Payments, receipts, bank, ledgers | **stays in Tally** | — |

Tally remains the books of account. The ERP never posts a payment.

### Blocker to clear first

Ledger names in Tally must match vendors and customers in the ERP exactly, and
Stock Item names must match part codes. **67 vendor names are currently
unmatched** — that was cosmetic before and becomes blocking here, because a
voucher against a ledger Tally does not recognise is rejected outright.

---

## 2. Billing — nothing exists today

Confirmed: there is no invoice table, no tax logic, no numbering series.

### Scope for an Indian EMS

| | Why |
|---|---|
| Customer master: GSTIN, state code, place of supply | Decides CGST+SGST vs IGST |
| HSN code and GST rate per part | Invoice line requirement |
| Tax invoice, series per financial year | Statutory |
| e-Invoice (IRN + QR) | Mandatory above ₹5 crore AATO — **need your figure** |
| e-Way bill | Consignments above ₹50,000 |
| Delivery challan | Job work and samples move without a sale |
| Credit / debit notes | Returns, and the vendor claims from CAPA |
| Payment terms, ageing | Collections |

### The decision that shapes everything

**Which system raises the invoice?**

- **ERP raises it, Tally receives it** *(recommended)* — the ERP already holds
  the dispatch, the serial numbers and the BOM, so it can invoice without
  re-keying. Tally keeps the books.
- Tally raises it — then dispatch data is typed twice, and the two disagree
  within a month.

Everything downstream (e-invoice, e-way bill, numbering) follows from this
answer, so it is the first thing to settle.

---

## 3. PDFs

The problem is not any one document; it is that each was written separately.
There is no shared template, so headers, fonts, margins and number formatting
drift apart, and a fix to one does not reach the others.

**Fix:** one generator, one template layer, house style taken from the existing
Grammy document standard rather than re-invented per document.

- Header/footer band, logo, teal, sign-off block — defined once
- Indian digit grouping (1,00,000) and DD Mon YYYY dates — defined once
- Page numbering, "Page 1 of N", continuation headers on long tables
- Documents: production voucher, GRN, purchase order, kit slip, quality claim,
  stock statement, invoice, delivery challan, e-way bill annexure

The stock statement and the quality claim are the two where a wrong number costs
money, so they get built first and checked against the ledger.

---

## 4. Design consistency

You are right that it does not read as one product. The cause is mechanical:
pages were built at different times and only some of them use the shared shell.

**Fix, in order:**

1. **Tokens** — colour, spacing, radius, type scale defined once. No page sets
   its own greys.
2. **One shell** — every page through `DashboardLayout` + `PageHeader`. Several
   currently do not.
3. **Four shared pieces** — data table (search / filter / sort / empty / loading
   in one component), filter bar, stat tile, dialog. Most of the inconsistency is
   that these were re-typed per page.
4. **An audit check** — the schema audit already catches screens nothing imports.
   The same script can flag a page that does not use the shell, so drift is
   caught rather than accumulated.

A worked pass on Store and Production first, then the rest follow the pattern.

---

## Sequence and dependencies

| # | Work | Blocked by | Size |
|---|---|---|---|
| 0 | ~~Restore points~~ **done** | — | — |
| 0 | ~~CAPA + vendor claim email~~ **done** | mail key | — |
| 1 | Design tokens + shared shell | — | 1 week |
| 2 | PDF template layer | 1 | 1 week |
| 3 | Billing schema + tax engine | invoice-owner decision | 2 weeks |
| 4 | Invoice / challan PDFs | 2, 3 | 3 days |
| 5 | Tally XML export (option B) | 3, vendor-name cleanup | 4 days |
| 6 | Tally connector agent (option A) | 5 | 2 weeks |
| 7 | e-Invoice + e-way bill | 3, AATO figure | 1 week |

1 and 2 can run while the billing decisions are settled.

---

## What I need from you

| Needed | For |
|---|---|
| Resend API key + a verified sender domain | The claim emails send the moment this exists |
| Tally version, and whether it sits on one fixed PC | Picks option A vs B |
| Who can install a small service on that PC | Option A |
| Annual turnover band | Whether e-invoicing applies |
| Invoice number format you want | Billing |
| Confirm: ERP raises invoices, Tally keeps books | Blocks all of §2 |

---

## Already done from this list

**Backups.** The project had **no** point-in-time recovery and **no** restorable
backup — verified against the platform, not assumed. Now:

```sql
select public.create_restore_point('before <whatever is about to change>');
select * from public.restore_points;
select public.restore_from_point('snap_20260921_213251');   -- destructive
```

A baseline was taken before any of today's work: **89 tables, 4,299 rows.**
The restore was tested by renaming a part, restoring, and watching the name come
back — a backup nobody has restored is not a backup.

**Vendor quality claims.** On Purchase Discrepancies, ruling **"Short supply —
claim from the vendor"** now raises the CAPA against that vendor and part, renders
the claim email with the GRN, invoice, PO, part and every quantity, and queues it.
The other three resolutions are ours to carry and nothing leaves the building.

The email body is written when the ruling is made, not when it is sent, so what
the vendor received is a stored fact — these mails are the paper trail behind a
debit note. Raising and sending are separate steps, so a mail provider being down
cannot undo a claim that was correctly raised.

Nothing sends until the mail key is set, which is the right way round: you can
read the exact wording of a real claim before the first one reaches a vendor.
