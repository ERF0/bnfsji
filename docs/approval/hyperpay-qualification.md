# HyperPay merchant qualification

**Status:** Public-source qualification prepared. No inquiry was sent, merchant account is not configured, and no HyperPay-specific commercial or flow approval has been received.

## Bnafsaji requirements to qualify

Bnafsaji plans to act as seller of record, collect buyer payments for JOD-denominated multi-vendor orders, consolidate multi-seller orders at its Amman facility, and pay sellers three days after carrier-confirmed delivery if no dispute is open. Buyers may open a return or dispute within three days after delivery. The intended payment-method scope is every method HyperPay enables for Bnafsaji except cash on delivery. HyperPay would also be used for seller annual subscriptions and per-product promoted listings if those transaction types are supported. Commission is calculated per seller on discounted item subtotal, rounded half up to the nearest fil.

This describes the founder's intended business flow; it is not evidence that HyperPay, an acquiring bank, or Jordanian counsel has approved it. Keep checkout and paid account features disabled until the provider and counsel approve a workable collection, hold, refund, dispute, and seller-payout arrangement.

## What public sources establish

- HyperPay's [integration guide](https://www.hyperpay.com/integration-guide/) describes COPYandPAY, where sensitive payment data goes from the shopper's browser to HyperPay, and a Server-to-Server option for direct integration. It also identifies HyperSplit as a payout product.
- HyperPay's [HyperSplit product page](https://www.hyperpay.com/hypersplit/) describes marketplace payouts where the merchant submits transaction details and a beneficiary is paid through a financial institution, with receipt described within 24 hours.
- HyperPay's [website](https://www.hyperpay.com/) lists Jordan among its markets, says required merchant documents depend on the acquiring bank and company-registration country, and directs merchants to request pricing. It does not publish Bnafsaji's eligible methods, pricing, account approval, or settlement terms.

These public descriptions do not establish a delivery-conditioned three-day hold, a payout freeze when a return/dispute is opened, Jordan eligibility for the proposed marketplace flow, or support for Bnafsaji's legal role. A payout described as occurring within 24 hours is not evidence of the required hold and release process.

## Provider inquiry draft

> Bnafsaji is preparing a Jordanian multi-vendor marketplace launching in Amman. The platform intends to be seller of record, collect buyer payments for JOD orders, consolidate multi-seller orders at its own facility, and pay sellers three days after carrier-confirmed delivery if no dispute is open. Buyers may request returns or open disputes within three days after delivery. We want to use every payment method enabled for our merchant account except cash on delivery. Please confirm in writing whether HyperPay and the acquiring bank can contractually support this flow for our legal entity and operating model.
>
> Please provide:
>
> - Merchant eligibility, acquiring-bank requirements, required legal-entity documents, onboarding and seller/beneficiary KYC requirements for Jordan.
> - The exact payment methods available to this Jordanian merchant account, including currency and channel constraints; explicitly identify methods that cannot be offered.
> - A complete quote: setup, monthly/minimum, per-transaction, percentage, cross-border, refund, chargeback, payout, currency conversion, tax and any other fees. Clarify which costs recur and which are one-time.
> - The approved collection and settlement model, including account ownership, source of funds, who controls funds during the hold, whether captured proceeds can remain held until confirmed delivery plus three days, and how disputes freeze payout.
> - Whether HyperSplit is available to this Jordan merchant and can pay individual sellers under the described schedule; required prefunding/balances, settlement timing, limits, rejected-payment handling, beneficiary onboarding, reconciliation reports and API availability.
> - Support for one buyer payment covering multiple sellers, immutable seller allocations, partial seller unavailability, partial cancellation/refund, full/partial refunds, returns, chargebacks, reserves and negative balances.
> - Whether annual subscriptions and per-product promotional purchases are supported, including recurring billing, advance renewal notifications/cancellation, refund/expiry behavior and payment-method limitations.
> - Recommended integration (COPYandPAY or Server-to-Server), current API/documentation versions, sandbox access, hosted-field/tokenization details, PCI responsibilities, 3DS/SCA behavior if applicable, webhook signature verification, event retry/replay, idempotency, reconciliation and operational support/SLA.
> - Written confirmation of applicable Jordan legal/compliance requirements for the proposed seller-of-record, collection, delayed payout and marketplace model, and any required approvals from the acquiring bank or regulator.

The inquiry is a draft only. Do not send it until the founder supplies the legal company and contact details required by HyperPay and explicitly asks to submit; do not invent those details.

## Qualification decision

HyperPay remains the first provider to qualify, not an approved or integrated payment provider. Public material alone does not answer the required merchant-specific questions. Require written HyperPay/acquirer terms and a Jordanian counsel review. Then test the contracted methods, payment and webhook state transitions, reconciliation, refunds, disputes, seller allocation and payout timing in the provider sandbox and an authorized live pilot before opening checkout. Never treat a browser redirect or unsigned notification as payment confirmation.

## Sources checked 2026-10-22

- [HyperPay Integration Guide](https://www.hyperpay.com/integration-guide/)
- [HyperSplit](https://www.hyperpay.com/hypersplit/)
- [HyperPay official website](https://www.hyperpay.com/)
