# Operating-cost envelope

**Status:** planning estimate, not a quote or a measured bill. Prices checked 2026-10-22. This is a cost-control aid for the founder's JOD 150 monthly cap for hosting and third-party services. Payment-processing fees, delivery costs and one-time setup are outside that cap by founder decision.

## Minimum production-shaped baseline

The lowest-cost baseline that avoids relying on Supabase's pausing Free plan uses one Cloudflare Workers Paid account and one Supabase Pro organization with a production project and a separate staging project.

| Service | Monthly allowance / base | USD estimate | JOD estimate at 0.710 JOD/USD |
|---|---|---:|---:|
| Cloudflare Workers Paid | Account minimum; includes 10 million Worker requests and 30 million CPU milliseconds per month | $5 | 3.550 |
| Supabase Pro organization | First project; includes $10 compute credit for one Micro instance, 100,000 MAU, 8 GB disk, 250 GB egress, 100 GB file storage and seven-day daily backups | $25 | 17.750 |
| Additional Supabase staging project | From $10/month, subject to selected compute and current billing configuration | $10 | 7.100 |
| R2 Standard | $0 within 10 GB-month, 1 million Class A, 10 million Class B operations; egress free | $0 | 0.000 |
| Cloudflare Queues | $0 within 1 million operations/month on Workers Paid; a small message usually incurs write, read and delete operations | $0 | 0.000 |
| **Planning baseline** | **Two database environments, one Cloudflare account** | **$40** | **28.400** |

The JOD conversion uses 0.710 JOD/USD, the Central Bank of Jordan's published upper USD rate when checked. On that budgeting basis, JOD 150 is approximately USD 211.27 and leaves about JOD 121.60 after this baseline. Bank or card conversion, taxes and fees can differ.

### If seconds-level database recovery is approved

Supabase's current seven-day PITR add-on is approximately $100/month per project and requires at least Small compute. Increasing the production project from Micro to Small adds about $5/month after the included $10 compute credit; with one production project using PITR, a separate Micro staging project and Workers Paid, the planning total is about **$145/month (JOD 102.95 at the same exchange rate)**. That leaves roughly JOD 47.05 for SMS, email, other service usage, taxes and bank conversion. This is still below the cap on paper, but it is not a measured total and may not cover vendor minimums. PITR does not establish an RTO; Supabase says restore time varies and the project is unavailable during restoration. The founder has not approved the proposed RPO/RTO, so this is a conditional scenario, not a selected configuration.

## Usage thresholds and cost controls

- Workers Paid includes 10 million requests and 30 million CPU milliseconds monthly. Above the allowance, requests cost $0.30 per additional million and CPU costs $0.02 per additional million milliseconds. SSR CPU use is not measured in this project; the request allowance alone is not a capacity guarantee.
- Supabase Pro includes the allowances in the table. Current excess rates include $0.00325 per MAU, $0.125 per GB of database storage, $0.09 per GB of egress, and $0.0213 per GB of file storage. Compute size beyond the included credit is extra.
- R2 Standard currently includes 10 GB-month storage, 1 million Class A operations and 10 million Class B operations monthly. Standard storage above the allowance is $0.015/GB-month; Class A is $4.50/million and Class B is $0.36/million. Direct R2 egress is free.
- Queues includes 1 million operations/month on Workers Paid; after that it is $0.40 per million operations. A sub-64-KB message commonly consumes three operations, so delivery volume, retries and dead-letter writes must be monitored.
- Create budget alerts before enabling paid features. If projected recurring spend exceeds JOD 150/month, stop expansion and prepare the measured cost and alternatives for founder approval, as directed.

## Not priced or not included

- Orange Jordan SMS OTP: the quote and technical proposal are not yet received. Sender fees, setup, taxes, volume tiers and any minimum commitment are unknown.
- Production email delivery: no provider, sender/domain setup, quota or price is approved. Do not treat Supabase's developer authentication email path as verified production delivery.
- Domain registration/renewal, optional observability export, malware scanning, paid fonts/assets, legal review and support tooling: procurement/provider details are not selected or priced.
- HyperPay transaction fees, refunds/chargebacks and delivery/courier costs are explicitly outside the monthly cap.
- No scale forecast, request volume, media volume, retention target or measured load profile exists. The baseline is not a total-cost-of-ownership forecast and cannot prove the JOD 150 cap will hold after OTP/email quotes, tax, real traffic and operational service choices.

## Release and spending gates

1. Select the Supabase region only after the stated legal review of cross-border data; then benchmark it against Amman traffic.
2. Obtain written Orange OTP pricing and a production email delivery quote before enabling those services.
3. Record actual resource usage from staging under representative traffic and size Worker CPU, Supabase compute/storage/egress, R2, queues and logs from measurements.
4. Compare the measured monthly estimate with JOD 150 using the actual billing exchange rate/tax treatment. Ask the founder to approve any over-cap proposal before purchase or launch.

## Sources

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Supabase pricing and compute credits](https://supabase.com/pricing)
- [Supabase database backup/PITR pricing and restore behavior](https://supabase.com/docs/guides/platform/backups)
- [Central Bank of Jordan foreign exchange rates](https://www.cbj.gov.jo/en/Pages/foreignexchangerates)
