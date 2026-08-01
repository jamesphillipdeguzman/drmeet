/**
 * Pricing Tier Logic Utilities & Limits
 */

export const PRICING_TIERS = {
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

export const TIER_LIMITS = {
  [PRICING_TIERS.STARTER]: {
    maxActivePatients: 10,
    allowCustomBranding: false,
    allowAdvancedAnalytics: false,
    allowUnlimitedReceptionists: false,
  },
  [PRICING_TIERS.PRO]: {
    maxActivePatients: Inifinity,
    allowCustomBranding: true,
    allowAdvancedAnalytics: true,
    allowUnlimitedReceptionists: true,
  },
  [PRICING_TIERS.ENTERPRISE]: {
    maxActivePatients: Infinity,
    allowCustomBranding: true,
    allowAdvancedAnalytics: true,
    allowUnlimitedReceptionists: true,
  },
};

/**
 * Checks if a doctor account can create/add a new active patient based on current plan.
 */
export function canDoctorAddPatient(plan = PRICING_TIERS.STARTER, currentPatientCount = 0) {
  const normalizedPlan = String(plan || '').toLowerCase();
  const limits = TIER_LIMITS[normalizedPlan] || TIER_LIMITS[PRICING_TIERS.STARTER];
  return currentPatientCount < limits.maxActivePatients;
}

/**
 * Checks if a feature permission is enabled for a given plan tier.
 */
export function isFeatureAllowed(plan = PRICING_TIERS.STARTER, featureKey) {
  const normalizedPlan = String(plan || '').toLowerCase();
  const limits = TIER_LIMITS[normalizedPlan] || TIER_LIMITS[PRICING_TIERS.STARTER];
  return Boolean(limits[featureKey]);
}
