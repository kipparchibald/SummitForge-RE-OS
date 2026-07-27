'use client';

import OfferCTA from '@/components/offer/OfferCTA';

/** Bridge CMA subject → Offer Decision Engine (list + indicated value). */
export default function CmaOfferLink({
  address,
  listPrice,
  indicatedValue,
  acres,
  sqft,
  propertyType,
}: {
  address?: string;
  listPrice?: number;
  indicatedValue?: number;
  acres?: number;
  sqft?: number;
  propertyType?: string;
}) {
  const price = listPrice || indicatedValue || 0;
  if (!address || !price) return null;
  const isLand =
    /land|farm|ranch|vacant/i.test(propertyType || '') || (!!acres && acres >= 1 && !sqft);

  return (
    <OfferCTA
      address={address}
      price={listPrice || price}
      indicated={indicatedValue}
      acres={acres}
      sqft={sqft}
      isLand={isLand}
      variant="button"
      className="w-full py-2.5 rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-900 text-sm font-medium hover:bg-emerald-100 transition text-center"
    />
  );
}
