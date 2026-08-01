import { canDoctorAddPatient, isFeatureAllowed, PRICING_TIERS, TIER_LIMITS } from '../src/utils/planLimits.js';

describe('Unit Tests: Pricing Tier Logic & Plan Limits', () => {
  describe('Starter Plan Limits (10 Active Patients Max)', () => {
    test('should allow adding patients when count is under limit (0 to 9)', () => {
      expect(canDoctorAddPatient(PRICING_TIERS.STARTER, 0)).toBe(true);
      expect(canDoctorAddPatient(PRICING_TIERS.STARTER, 5)).toBe(true);
      expect(canDoctorAddPatient(PRICING_TIERS.STARTER, 9)).toBe(true);
    });

    test('should block adding 11th patient when count reaches 10', () => {
      expect(canDoctorAddPatient(PRICING_TIERS.STARTER, 10)).toBe(false);
      expect(canDoctorAddPatient(PRICING_TIERS.STARTER, 15)).toBe(false);
    });
  });

  describe('Pro and Enterprise Plan Limits', () => {
    test('should allow Pro plan unlimited active patients', () => {
      expect(TIER_LIMITS[PRICING_TIERS.PRO].maxActivePatients).toBe(Infinity);
      expect(canDoctorAddPatient(PRICING_TIERS.PRO, 10)).toBe(true);
      expect(canDoctorAddPatient(PRICING_TIERS.PRO, 100)).toBe(true);
      expect(canDoctorAddPatient(PRICING_TIERS.PRO, 50000)).toBe(true);
    });

    test('should allow Enterprise plan unlimited active patients', () => {
      expect(canDoctorAddPatient(PRICING_TIERS.ENTERPRISE, 1000)).toBe(true);
      expect(canDoctorAddPatient(PRICING_TIERS.ENTERPRISE, 50000)).toBe(true);
    });
  });

  describe('Feature Permission Evaluation', () => {
    test('Starter plan should restrict premium features', () => {
      expect(isFeatureAllowed(PRICING_TIERS.STARTER, 'allowCustomBranding')).toBe(false);
      expect(isFeatureAllowed(PRICING_TIERS.STARTER, 'allowAdvancedAnalytics')).toBe(false);
    });

    test('Pro and Enterprise plans should enable premium features', () => {
      expect(isFeatureAllowed(PRICING_TIERS.PRO, 'allowCustomBranding')).toBe(true);
      expect(isFeatureAllowed(PRICING_TIERS.ENTERPRISE, 'allowAdvancedAnalytics')).toBe(true);
    });
  });
});
