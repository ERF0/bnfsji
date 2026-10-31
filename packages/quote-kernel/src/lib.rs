//! Deterministic JOD quote arithmetic for Bnafsaji.
//!
//! Inputs are trusted, server-resolved seller subtotals after discounts. This crate
//! does not resolve discounts, inventory, delivery prices, subscription status,
//! settlement recipients, or legal policy. A Worker adapter must establish those
//! facts before calling this kernel.

use std::collections::HashSet;

const BASIS_POINTS: u128 = 10_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SellerPlan {
    Standard,
    AnnualSubscription,
}

impl SellerPlan {
    pub const fn commission_basis_points(self) -> u16 {
        match self {
            Self::Standard => 700,
            Self::AnnualSubscription => 200,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SellerInput {
    pub seller_id: String,
    /// Seller's item subtotal after all authorized discounts, in JOD fils.
    pub discounted_item_subtotal_fils: u64,
    /// Must be resolved from the seller's server-side subscription entitlement.
    pub plan: SellerPlan,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SellerQuote {
    pub seller_id: String,
    pub discounted_item_subtotal_fils: u64,
    pub commission_fils: u64,
    /// Proportional allocation of the order delivery charge for reporting.
    /// It does not determine who receives or pays this amount.
    pub delivery_allocation_fils: u64,
    /// Item proceeds after commission; delivery settlement is deliberately separate.
    pub item_proceeds_fils: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Quote {
    pub item_subtotal_fils: u64,
    pub commission_fils: u64,
    pub delivery_charge_fils: u64,
    pub buyer_total_fils: u64,
    pub sellers: Vec<SellerQuote>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum QuoteError {
    NoSellers,
    EmptySellerId,
    DuplicateSellerId,
    DeliveryWithZeroItemSubtotal,
    Overflow,
}

/// Calculates commission per seller subtotal, rounded to the nearest fil, half up.
///
/// Delivery is allocated by each seller's discounted item subtotal using the
/// largest-remainder method. Any remainder tie is resolved by ascending seller ID
/// so identical inputs always produce identical output.
pub fn quote(sellers: &[SellerInput], delivery_charge_fils: u64) -> Result<Quote, QuoteError> {
    if sellers.is_empty() {
        return Err(QuoteError::NoSellers);
    }

    let mut ids = HashSet::with_capacity(sellers.len());
    for seller in sellers {
        if seller.seller_id.trim().is_empty() {
            return Err(QuoteError::EmptySellerId);
        }
        if !ids.insert(seller.seller_id.as_str()) {
            return Err(QuoteError::DuplicateSellerId);
        }
    }

    let item_subtotal_fils = sellers.iter().try_fold(0_u64, |sum, seller| {
        sum.checked_add(seller.discounted_item_subtotal_fils)
            .ok_or(QuoteError::Overflow)
    })?;

    if delivery_charge_fils > 0 && item_subtotal_fils == 0 {
        return Err(QuoteError::DeliveryWithZeroItemSubtotal);
    }

    let delivery_allocations = allocate_proportionally(
        delivery_charge_fils,
        sellers.iter().map(|seller| {
            (
                seller.seller_id.as_str(),
                seller.discounted_item_subtotal_fils,
            )
        }),
    )?;

    let mut ordered: Vec<&SellerInput> = sellers.iter().collect();
    ordered.sort_by(|left, right| left.seller_id.cmp(&right.seller_id));

    let mut seller_quotes = Vec::with_capacity(ordered.len());
    let mut commission_fils = 0_u64;
    for seller in ordered {
        let commission = commission_for(
            seller.discounted_item_subtotal_fils,
            seller.plan.commission_basis_points(),
        )?;
        let item_proceeds = seller
            .discounted_item_subtotal_fils
            .checked_sub(commission)
            .ok_or(QuoteError::Overflow)?;
        commission_fils = commission_fils
            .checked_add(commission)
            .ok_or(QuoteError::Overflow)?;

        seller_quotes.push(SellerQuote {
            seller_id: seller.seller_id.clone(),
            discounted_item_subtotal_fils: seller.discounted_item_subtotal_fils,
            commission_fils: commission,
            delivery_allocation_fils: delivery_allocations
                .binary_search_by(|(id, _)| id.as_str().cmp(seller.seller_id.as_str()))
                .ok()
                .and_then(|index| delivery_allocations.get(index))
                .map(|(_, amount)| *amount)
                .ok_or(QuoteError::Overflow)?,
            item_proceeds_fils: item_proceeds,
        });
    }

    let buyer_total_fils = item_subtotal_fils
        .checked_add(delivery_charge_fils)
        .ok_or(QuoteError::Overflow)?;

    Ok(Quote {
        item_subtotal_fils,
        commission_fils,
        delivery_charge_fils,
        buyer_total_fils,
        sellers: seller_quotes,
    })
}

fn commission_for(subtotal_fils: u64, rate_basis_points: u16) -> Result<u64, QuoteError> {
    let numerator = u128::from(subtotal_fils)
        .checked_mul(u128::from(rate_basis_points))
        .ok_or(QuoteError::Overflow)?;
    let rounded = numerator
        .checked_add(BASIS_POINTS / 2)
        .ok_or(QuoteError::Overflow)?
        / BASIS_POINTS;
    u64::try_from(rounded).map_err(|_| QuoteError::Overflow)
}

/// Distributes an integer-fils delivery amount in proportion to seller weights.
/// The returned pairs are ordered by seller ID and always sum exactly to `amount_fils`.
pub fn allocate_proportionally<'a>(
    amount_fils: u64,
    sellers: impl IntoIterator<Item = (&'a str, u64)>,
) -> Result<Vec<(String, u64)>, QuoteError> {
    let mut weights: Vec<(String, u64)> = sellers
        .into_iter()
        .map(|(id, weight)| (id.to_owned(), weight))
        .collect();
    if weights.is_empty() {
        return Err(QuoteError::NoSellers);
    }
    weights.sort_by(|left, right| left.0.cmp(&right.0));
    if weights.iter().any(|(id, _)| id.trim().is_empty()) {
        return Err(QuoteError::EmptySellerId);
    }
    if weights.windows(2).any(|pair| pair[0].0 == pair[1].0) {
        return Err(QuoteError::DuplicateSellerId);
    }

    let total_weight: u128 = weights.iter().map(|(_, weight)| u128::from(*weight)).sum();
    if total_weight == 0 {
        if amount_fils == 0 {
            return Ok(weights.into_iter().map(|(id, _)| (id, 0)).collect());
        }
        return Err(QuoteError::DeliveryWithZeroItemSubtotal);
    }

    let mut allocations = Vec::with_capacity(weights.len());
    let mut allocated_fils = 0_u64;
    let mut remainders = Vec::with_capacity(weights.len());
    for (index, (id, weight)) in weights.iter().enumerate() {
        let numerator = u128::from(amount_fils) * u128::from(*weight);
        let base = u64::try_from(numerator / total_weight).map_err(|_| QuoteError::Overflow)?;
        allocated_fils = allocated_fils
            .checked_add(base)
            .ok_or(QuoteError::Overflow)?;
        allocations.push((id.clone(), base));
        remainders.push((index, numerator % total_weight));
    }

    let remaining = amount_fils
        .checked_sub(allocated_fils)
        .ok_or(QuoteError::Overflow)?;
    remainders.sort_by(
        |(left_index, left_remainder), (right_index, right_remainder)| {
            right_remainder
                .cmp(left_remainder)
                .then_with(|| left_index.cmp(right_index))
        },
    );
    let extra_count = usize::try_from(remaining).map_err(|_| QuoteError::Overflow)?;
    if extra_count > remainders.len() {
        return Err(QuoteError::Overflow);
    }
    for (index, _) in remainders.into_iter().take(extra_count) {
        allocations[index].1 = allocations[index]
            .1
            .checked_add(1)
            .ok_or(QuoteError::Overflow)?;
    }

    Ok(allocations)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seller(id: &str, subtotal: u64, plan: SellerPlan) -> SellerInput {
        SellerInput {
            seller_id: id.to_owned(),
            discounted_item_subtotal_fils: subtotal,
            plan,
        }
    }

    #[test]
    fn applies_approved_rates_per_seller_subtotal_after_discounts() {
        let result = quote(
            &[
                seller("standard", 10_000, SellerPlan::Standard),
                seller("subscribed", 10_000, SellerPlan::AnnualSubscription),
            ],
            0,
        )
        .unwrap();

        assert_eq!(result.sellers[0].commission_fils, 700);
        assert_eq!(result.sellers[1].commission_fils, 200);
        assert_eq!(result.commission_fils, 900);
        assert_eq!(result.item_subtotal_fils, 20_000);
        assert_eq!(result.buyer_total_fils, 20_000);
    }

    #[test]
    fn rounds_nearest_fil_half_up_per_seller_subtotal() {
        let result = quote(
            &[
                seller("annual-half", 25, SellerPlan::AnnualSubscription),
                seller("annual-under", 24, SellerPlan::AnnualSubscription),
                seller("standard-half", 8, SellerPlan::Standard),
                seller("standard-under", 7, SellerPlan::Standard),
            ],
            0,
        )
        .unwrap();

        let commissions: Vec<_> = result
            .sellers
            .iter()
            .map(|seller| (seller.seller_id.as_str(), seller.commission_fils))
            .collect();
        assert_eq!(
            commissions,
            vec![
                ("annual-half", 1),
                ("annual-under", 0),
                ("standard-half", 1),
                ("standard-under", 0),
            ]
        );
    }

    #[test]
    fn allocates_delivery_proportionally_and_conserves_fils() {
        let result = quote(
            &[
                seller("seller-b", 200, SellerPlan::Standard),
                seller("seller-a", 100, SellerPlan::Standard),
            ],
            10,
        )
        .unwrap();

        assert_eq!(result.sellers[0].seller_id, "seller-a");
        assert_eq!(result.sellers[0].delivery_allocation_fils, 3);
        assert_eq!(result.sellers[1].delivery_allocation_fils, 7);
        assert_eq!(
            result
                .sellers
                .iter()
                .map(|s| s.delivery_allocation_fils)
                .sum::<u64>(),
            10
        );
        assert_eq!(result.buyer_total_fils, 310);
    }

    #[test]
    fn resolves_equal_remainders_by_ascending_seller_id() {
        let result = allocate_proportionally(1, [("b", 1), ("a", 1)]).unwrap();
        assert_eq!(result, vec![("a".to_owned(), 1), ("b".to_owned(), 0)]);
    }

    #[test]
    fn proportional_allocation_conserves_fils_across_small_inputs() {
        for a in 0..=4_u64 {
            for b in 0..=4_u64 {
                for c in 0..=4_u64 {
                    for delivery in 0..=20_u64 {
                        let weights = [("seller-c", c), ("seller-a", a), ("seller-b", b)];
                        if a + b + c == 0 && delivery > 0 {
                            assert_eq!(
                                allocate_proportionally(delivery, weights),
                                Err(QuoteError::DeliveryWithZeroItemSubtotal)
                            );
                            continue;
                        }
                        let result = allocate_proportionally(delivery, weights).unwrap();
                        assert_eq!(
                            result.iter().map(|(_, amount)| amount).sum::<u64>(),
                            delivery
                        );
                        assert_eq!(
                            result,
                            allocate_proportionally(
                                delivery,
                                [("seller-a", a), ("seller-b", b), ("seller-c", c)]
                            )
                            .unwrap()
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn zero_delivery_allows_zero_item_weights() {
        let result = quote(&[seller("a", 0, SellerPlan::Standard)], 0).unwrap();
        assert_eq!(result.buyer_total_fils, 0);
        assert_eq!(result.sellers[0].delivery_allocation_fils, 0);
    }

    #[test]
    fn rejects_empty_orders_blank_and_duplicate_seller_ids() {
        assert_eq!(quote(&[], 0), Err(QuoteError::NoSellers));
        assert_eq!(
            quote(&[seller("  ", 100, SellerPlan::Standard)], 0),
            Err(QuoteError::EmptySellerId)
        );
        assert_eq!(
            quote(
                &[
                    seller("a", 100, SellerPlan::Standard),
                    seller("a", 200, SellerPlan::Standard)
                ],
                0
            ),
            Err(QuoteError::DuplicateSellerId)
        );
    }

    #[test]
    fn rejects_delivery_when_total_item_weight_is_zero() {
        assert_eq!(
            quote(&[seller("a", 0, SellerPlan::Standard)], 1),
            Err(QuoteError::DeliveryWithZeroItemSubtotal)
        );
    }

    #[test]
    fn rejects_checked_total_overflow() {
        assert_eq!(
            quote(&[seller("a", u64::MAX, SellerPlan::Standard)], 1),
            Err(QuoteError::Overflow)
        );
        assert_eq!(
            quote(
                &[
                    seller("a", u64::MAX, SellerPlan::Standard),
                    seller("b", 1, SellerPlan::Standard)
                ],
                0
            ),
            Err(QuoteError::Overflow)
        );
    }
}
