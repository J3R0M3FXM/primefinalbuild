// Pure shipping calculation. The caller must supply an authoritative Geoapify
// road distance and an admin-configured service/rule snapshot.
export function calculateShippingQuote({ service, distanceMeters, weightGrams, localHour }) {
  const rules = service?.pricingRules;
  if (!service?.isActive || !rules || !Number.isSafeInteger(distanceMeters) || distanceMeters <= 0) {
    return { available: false, reason: 'INVALID_QUOTE_INPUT' };
  }
  if (!Number.isSafeInteger(weightGrams) || weightGrams < 0) {
    return { available: false, reason: 'INVALID_WEIGHT' };
  }
  if (service.maxDistanceMeters != null && distanceMeters > service.maxDistanceMeters) {
    return { available: false, reason: 'DISTANCE_LIMIT' };
  }
  if (service.maxWeightGrams != null && weightGrams > service.maxWeightGrams) {
    return { available: false, reason: 'WEIGHT_LIMIT' };
  }

  const {
    baseFareMinor,
    roundingMeters = 1000,
    firstDistanceMeters = 5000,
    firstRatePerKmMinor = 0,
    succeedingRatePerKmMinor = 0,
    platformFeeMinor = 0,
    surchargeMinor = 0,
    surchargePercent = 0,
    nightDifferentialMinor = 0,
    nightDifferentialPercent = 0,
    nightStartHour,
    nightEndHour,
  } = rules;
  const numericValues = [baseFareMinor, roundingMeters, firstDistanceMeters, firstRatePerKmMinor,
    succeedingRatePerKmMinor, platformFeeMinor, surchargeMinor, surchargePercent,
    nightDifferentialMinor, nightDifferentialPercent];
  if (!numericValues.every(Number.isSafeInteger) || numericValues.some((value) => value < 0)
    || roundingMeters === 0 || firstDistanceMeters === 0
    || !Number.isSafeInteger(localHour) || localHour < 0 || localHour > 23
    || (nightStartHour != null && (!Number.isInteger(nightStartHour) || nightStartHour < 0 || nightStartHour > 23))
    || (nightEndHour != null && (!Number.isInteger(nightEndHour) || nightEndHour < 0 || nightEndHour > 23))
    || ((nightStartHour == null) !== (nightEndHour == null))) {
    return { available: false, reason: 'INVALID_PRICING_RULES' };
  }

  const billableDistanceMeters = Math.ceil(distanceMeters / roundingMeters) * roundingMeters;
  const firstKm = Math.ceil(Math.min(billableDistanceMeters, firstDistanceMeters) / 1000);
  const succeedingKm = Math.ceil(Math.max(0, billableDistanceMeters - firstDistanceMeters) / 1000);
  const distanceFeeMinor = firstKm * firstRatePerKmMinor + succeedingKm * succeedingRatePerKmMinor;
  const beforeSurcharges = baseFareMinor + distanceFeeMinor + platformFeeMinor;
  const isNight = Number.isInteger(nightStartHour) && Number.isInteger(nightEndHour)
    && (nightStartHour <= nightEndHour
      ? localHour >= nightStartHour && localHour < nightEndHour
      : localHour >= nightStartHour || localHour < nightEndHour);
  const surcharge = surchargeMinor + Math.ceil(beforeSurcharges * surchargePercent / 100);
  const nightFee = isNight
    ? nightDifferentialMinor + Math.ceil(beforeSurcharges * nightDifferentialPercent / 100)
    : 0;
  const totalMinor = beforeSurcharges + surcharge + nightFee;
  if (!Number.isSafeInteger(totalMinor)) return { available: false, reason: 'PRICE_OVERFLOW' };

  return {
    available: true,
    distanceMeters,
    billableDistanceMeters,
    weightGrams,
    currency: 'PHP',
    breakdown: {
      baseFareMinor,
      distanceFeeMinor,
      platformFeeMinor,
      surchargeMinor: surcharge,
      nightDifferentialMinor: nightFee,
    },
    totalMinor,
    pricingRulesSnapshot: { ...rules },
  };
}
