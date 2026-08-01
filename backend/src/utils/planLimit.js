import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import User from '../models/user.model.js';
import { patientActiveQuery } from '../services/patient.service.js';

export const STARTER_PATIENT_LIMIT = 10;
export const STARTER_LIMIT_ERROR_MESSAGE =
  'Starter plan limit reached (10 active patients). Please upgrade to Clinic Pro to add more patients.';

/**
  * Check if the requester or associated doctor is on the 'starter' plan.
  * Bypasses the limit if the header or database records specify 'pro' or 'enterprise'.
  */
export async function isDoctorOnStarterPlan(doctorId, req) {
  const headerPlan = String(req?.headers?.['x-subscription-plan'] || '').toLowerCase();
  if (['pro', 'enterprise'].includes(headerPlan)) {
    return false;
  }

  if (
    req?.user?.subscriptionPlan &&
    ['pro', 'enterprise'].includes(String(req.user.subscriptionPlan).toLowerCase())
  ) {
    return false;
  }

  if (doctorId) {
    const doctorDoc = await Doctor.findById(doctorId).select('userId subscriptionPlan').lean();
    if (
      doctorDoc?.subscriptionPlan &&
      ['pro', 'enterprise'].includes(String(doctorDoc.subscriptionPlan).toLowerCase())
    ) {
      return false;
    }
    if (doctorDoc?.userId) {
      const userDoc = await User.findById(doctorDoc.userId).select('subscriptionPlan').lean();
      if (
        userDoc?.subscriptionPlan &&
        ['pro', 'enterprise'].includes(String(userDoc.subscriptionPlan).toLowerCase())
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Counts total active patients linked to a doctor (careTeamDoctorIds).
 */
export async function getDoctorActivePatientCount(doctorId) {
  if (!doctorId) return 0;
  return Patient.countDocuments({
    ...patientActiveQuery,
    careTeamDoctorIds: doctorId,
  });
}

/**
 * Enforces the Starter plan 10-patient limit for doctor patient creation / attachment.
 * Throws an error object with statusCode = 403 if the limit is exceeded.
 */
export async function assertStarterPlanPatientLimit({ doctorId, req, isNewPatientForDoctor = true }) {
  if (!doctorId) return;
  if (!isNewPatientForDoctor) return;

  const isStarter = await isDoctorOnStarterPlan(doctorId, req);
  if (!isStarter) return;

  const count = await getDoctorActivePatientCount(doctorId);
  if (count >= STARTER_PATIENT_LIMIT) {
    const error = new Error(STARTER_LIMIT_ERROR_MESSAGE);
    error.statusCode = 403;
    throw error;
  }
}
