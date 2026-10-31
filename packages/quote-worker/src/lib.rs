use bnafsaji_quote_kernel::{QuoteError, SellerInput, SellerPlan, quote};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use worker::{Context, Method, Request, Response, Result, event};

const MAX_REQUEST_BYTES: usize = 8 * 1024;
const MAX_SELLERS: usize = 50;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct QuoteRequest {
    version: u8,
    currency: String,
    delivery_charge_fils: u64,
    sellers: Vec<SellerRequest>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SellerRequest {
    seller_id: String,
    discounted_item_subtotal_fils: u64,
    plan: PlanRequest,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum PlanRequest {
    Standard,
    AnnualSubscription,
}

#[derive(Serialize)]
struct QuoteResponse {
    currency: &'static str,
    item_subtotal_fils: u64,
    commission_fils: u64,
    delivery_charge_fils: u64,
    buyer_total_fils: u64,
    sellers: Vec<SellerResponse>,
}

#[derive(Serialize)]
struct SellerResponse {
    seller_id: String,
    discounted_item_subtotal_fils: u64,
    commission_fils: u64,
    delivery_allocation_fils: u64,
    item_proceeds_fils: u64,
}

#[event(fetch)]
pub async fn main(mut request: Request, _env: worker::Env, _ctx: Context) -> Result<Response> {
    if request.path() != "/v1/quote" {
        return Response::error("Not Found", 404);
    }
    if !matches!(request.method(), Method::Post) {
        return Response::error("Method Not Allowed", 405);
    }

    let content_type = request.headers().get("content-type")?;
    if !content_type.as_deref().is_some_and(|value| {
        value
            .split(';')
            .next()
            .is_some_and(|mime| mime.trim().eq_ignore_ascii_case("application/json"))
    }) {
        return Response::error("Content-Type must be application/json", 415);
    }
    if request
        .headers()
        .get("content-length")?
        .and_then(|value| value.parse::<usize>().ok())
        .is_some_and(|length| length > MAX_REQUEST_BYTES)
    {
        return Response::error("Request body too large", 413);
    }

    let mut body = Vec::with_capacity(MAX_REQUEST_BYTES);
    let mut stream = request.stream()?;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if !append_bounded_chunk(&mut body, &chunk) {
            return Response::error("Request body too large", 413);
        }
    }
    let input: QuoteRequest = match serde_json::from_slice(&body) {
        Ok(input) => input,
        Err(_) => return Response::error("Invalid quote request", 400),
    };
    if input.version != 1 || input.currency != "JOD" {
        return Response::error("Unsupported quote version or currency", 422);
    }
    if input.sellers.len() > MAX_SELLERS {
        return Response::error("Too many sellers", 422);
    }

    let sellers: Vec<SellerInput> = input
        .sellers
        .into_iter()
        .map(|seller| SellerInput {
            seller_id: seller.seller_id,
            discounted_item_subtotal_fils: seller.discounted_item_subtotal_fils,
            plan: match seller.plan {
                PlanRequest::Standard => SellerPlan::Standard,
                PlanRequest::AnnualSubscription => SellerPlan::AnnualSubscription,
            },
        })
        .collect();

    let quote = match quote(&sellers, input.delivery_charge_fils) {
        Ok(quote) => quote,
        Err(QuoteError::Overflow) => return Response::error("Quote exceeds supported amount", 422),
        Err(_) => return Response::error("Invalid quote inputs", 422),
    };
    Response::from_json(&QuoteResponse {
        currency: "JOD",
        item_subtotal_fils: quote.item_subtotal_fils,
        commission_fils: quote.commission_fils,
        delivery_charge_fils: quote.delivery_charge_fils,
        buyer_total_fils: quote.buyer_total_fils,
        sellers: quote
            .sellers
            .into_iter()
            .map(|seller| SellerResponse {
                seller_id: seller.seller_id,
                discounted_item_subtotal_fils: seller.discounted_item_subtotal_fils,
                commission_fils: seller.commission_fils,
                delivery_allocation_fils: seller.delivery_allocation_fils,
                item_proceeds_fils: seller.item_proceeds_fils,
            })
            .collect(),
    })
}

fn append_bounded_chunk(body: &mut Vec<u8>, chunk: &[u8]) -> bool {
    if chunk.len() > MAX_REQUEST_BYTES.saturating_sub(body.len()) {
        return false;
    }
    body.extend_from_slice(chunk);
    true
}

#[cfg(test)]
mod tests {
    use super::{MAX_REQUEST_BYTES, append_bounded_chunk};

    #[test]
    fn bounded_body_accepts_exact_limit() {
        let mut body = Vec::with_capacity(MAX_REQUEST_BYTES);
        assert!(append_bounded_chunk(
            &mut body,
            &vec![0; MAX_REQUEST_BYTES - 1]
        ));
        assert!(append_bounded_chunk(&mut body, &[0]));
        assert_eq!(body.len(), MAX_REQUEST_BYTES);
    }

    #[test]
    fn bounded_body_rejects_over_limit_without_copying_chunk() {
        let mut body = Vec::with_capacity(MAX_REQUEST_BYTES);
        assert!(append_bounded_chunk(&mut body, &vec![0; MAX_REQUEST_BYTES]));
        assert!(!append_bounded_chunk(&mut body, &[0]));
        assert_eq!(body.len(), MAX_REQUEST_BYTES);
    }

    #[test]
    fn bounded_body_rejects_a_single_oversized_chunk() {
        let mut body = Vec::with_capacity(MAX_REQUEST_BYTES);
        assert!(!append_bounded_chunk(
            &mut body,
            &vec![0; MAX_REQUEST_BYTES + 1]
        ));
        assert!(body.is_empty());
    }
}
