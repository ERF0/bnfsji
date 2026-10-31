# Orange Jordan OTP qualification

**Status:** Prepared for the founder's approved provider qualification. Not sent. Orange's inquiry form needs real company and contact details.

## Inquiry text

> Bnafsaji is preparing a Jordanian multi-vendor marketplace launching in Amman. We need phone one-time-password (OTP) messages for buyer phone verification before checkout. Please provide a commercial and technical proposal for transactional OTP/A2P SMS that can reach Zain, Orange and Umniah subscribers.
>
> Please include:
>
> - Per-message/per-segment pricing, sender-ID and registration fees, monthly or annual minimums, setup/VPN fees, taxes, and any support charges.
> - Price bands for 500, 1,000, 5,000 and 10,000 OTP messages per month; Bnafsaji's actual volume is not yet measured.
> - Whether the appropriate product is SMPP over site-to-site VPN, SMS Dispatcher, or another transactional API; please provide the protocol and technical documentation.
> - Whether Orange supports a Cloudflare Workers deployment using Cloudflare Workers VPC with a Cloudflare Tunnel, Mesh or WAN/IPsec route to the SMPP endpoint. Specify required network endpoints, ports, routing, encryption/TLS, authentication, IP allow-listing and whether a continuously running customer-side gateway is required.
> - Whether an HTTPS API with signed requests is available as an alternative, including its callback/delivery-report behavior and Cloudflare compatibility.
> - Contractual delivery SLA by network, delivery reports, throughput/connection limits, timeout/retry guidance, maintenance and incident support.
> - Sender-ID approval requirements, A2P/OTP registration, approved message content, consent or regulatory requirements, and any data retention or processor terms for phone numbers and message content.
> - Any other one-time or recurring charges and the process to trial/test delivery across all three Jordanian mobile networks.

## Form fields still needed

The Orange enterprise inquiry form requests the contact's name, Jordan mobile number, email, legal company name, industry, and employee count. The founder must provide these values before a request can be submitted. Do not invent a legal entity name, contact identity, staffing level, or OTP volume.

## Qualification decision

An Orange quote is not production approval. Compare total fixed and per-message costs with the JOD 150/month hosting and third-party-services cap; payment fees, delivery costs and one-time setup are excluded from that cap. Validate the exact network topology, security, sender registration, OTP abuse protections, delivery reliability, outage handling, data terms, and live test results before selecting a provider. Keep checkout blocked until phone verification works end to end.

## Cloudflare-compatible integration proposal (conditional)

**Qualification recommendation:** keep Supabase Auth as the OTP issuer and verifier, then use its Send SMS Auth Hook to call a narrowly scoped HTTPS endpoint on the Bnafsaji Cloudflare Worker. The Worker should verify Supabase's signed hook request, reject malformed or unsupported destinations, send only the OTP message to Orange, and return success only after the provider has accepted it. Keep OTPs, phone numbers, provider credentials, and hook payloads out of logs and analytics. Supabase documents a five-second HTTP-hook timeout, so Orange must confirm that its HTTPS API can accept requests within that bound. A queue that acknowledges before Orange accepts delivery would need durable retry and clear failure handling.

Before implementation, qualify the Supabase-managed HTTP hook's secret configuration with the actual project. Verify the raw request body and Standard Webhooks signature before parsing it; reject missing, invalid, stale, or replayed signatures. Supabase's hook security guidance says to sign HTTP payloads, and its HTTP-hook examples use Standard Webhooks secrets. Keep separate rotating hook and Orange credentials in Wrangler secrets, never in `wrangler.jsonc`, browser code, or logs. Supabase documents the Send SMS hook on Free and Pro plans, but this does not include Orange message costs.

Supabase currently documents a default ceiling of 30 SMS sends per hour for a project, which can be customized. Treat that as a provider-side backstop, not the complete abuse budget. Before checkout is enabled, configure and test resend cooldowns, per-number/account/IP limits, bot controls, OTP expiry and verification attempts, and cost alerts against the JOD 150 service cap. Prove that hook/provider failures return an Auth error and never leave a phone number marked verified.

Orange's published SMPP product uses a site-to-site VPN. Cloudflare Workers VPC supports TCP access to private services through Cloudflare network paths, but VPC remains beta and its VPC `connect()` path is documented as plaintext TCP. The general Workers sockets API has TLS options, but the VPC binding documentation does not establish that secure socket options or a TLS upgrade are supported over this binding; do not infer that they are. This is a route to qualify, not a production-ready integration claim. Orange and Cloudflare must confirm a supported secure topology, whether a customer-side always-on gateway is needed, and where encryption terminates. Do not send OTPs over a plaintext SMPP path. If Orange offers only SMPP over a VPN topology Cloudflare cannot join securely, the fallback is a separately operated gateway inside that network, with its recurring cost and availability included in the JOD 150 cap review.

No integration choice is approved yet. Prefer Orange's signed HTTPS API if it meets the hook timeout and security requirements; assess SMPP/VPC only if Orange confirms the network and transport design in writing. Test all three Jordanian carrier networks, delivery reports, resend/rate-limit behavior, provider outages, and exact recurring and setup costs before enabling checkout.

## Sources checked 2026-10-22

- [Orange Jordan enterprise SMS](https://orange.jo/en/business/enterprise/mobile-communications/sms) advertises OTP/A2P SMS, SMPP over a site-to-site VPN, transmission within 10 seconds, and “100% Guaranteed delivery” claims; these are website claims, not a reviewed contract/SLA. Its public page does not publish commercial prices or a technical integration contract, and does not establish that a transactional HTTPS API is available.
- [Orange Jordan enterprise inquiry form](https://orange.jo/en/form/get-in-touch-enterprise) requests name, mobile, email, company, industry, employee count, and an inquiry message.
- [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) replaces built-in SMS sending, receives the phone and OTP, and treats an empty HTTP 200 response as success; [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) lists Send SMS hooks on Free/Pro and requires HTTP hooks to complete within five seconds.
- [Supabase HTTP Hook security guidance](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks) documents Standard Webhooks request signing/secrets and signature verification in its HTTP hook example; hosted Supabase project configuration must be verified separately. [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) currently lists a default 30 SMS/hour project limit, customizable.
- [Cloudflare Workers VPC Networks](https://developers.cloudflare.com/workers-vpc/configuration/vpc-networks/) documents private network access via Tunnel, Mesh or WAN and marks Workers VPC as beta; its [binding API](https://developers.cloudflare.com/workers-vpc/api/) states `connect()` currently supports plaintext TCP. The general [Workers TCP Sockets API](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/) supports TLS options for direct socket connections, but the VPC binding API does not establish that those options apply through VPC. Orange/network engineering must confirm whether the complete route and transport security meet its requirements.
