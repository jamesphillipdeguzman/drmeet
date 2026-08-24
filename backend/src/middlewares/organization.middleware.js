import { normalizeRole } from "./auth.middleware.js";
import User from "../models/user.model.js";
import Doctor from "../models/doctor.model.js";

export async function requireEnterpriseAccess(req, res, next) {
  try {
    const user = req.user || {};
    const userRole = normalizeRole(user.role || "");

    // Platform and hospital administrators have unconditional access
    if (["super_admin", "hospital_admin", "admin"].includes(userRole) || user.isSuperAdmin === true) {
      return next();
    }

    const orgRole = String(user.orgRole || "").toLowerCase();
    if (["org_admin", "department_head", "staff"].includes(orgRole)) {
      return next();
    }

    // Direct token and header checks
    const headerPlan = String(req.headers["x-subscription-plan"] || "").toLowerCase();
    const isEnterprisePlan =
      user.subscriptionPlan === "enterprise" ||
      user.tier === "enterprise" ||
      user.subscriptionTier === "enterprise" ||
      headerPlan === "enterprise" ||
      req.headers["x-enterprise-mode"] === "true";

    if (isEnterprisePlan) {
      return next();
    }

    // Check User record in DB
    const userId = user.id || user._id;
    if (userId) {
      const userDoc = await User.findById(userId).select("role subscriptionPlan subscriptionTier tier organizationId orgRole");
      if (userDoc) {
        const uPlan = String(userDoc.subscriptionPlan || userDoc.subscriptionTier || userDoc.tier || "").toLowerCase();
        if (
          uPlan === "enterprise" ||
          userDoc.organizationId ||
          ["org_admin", "department_head"].includes(String(userDoc.orgRole || "").toLowerCase())
        ) {
          return next();
        }
      }
    }

    // Check Doctor record in DB (e.g. Dr. Ethan assigned to hospital or on enterprise tier)
    if (userId || user.email) {
      const doctorDoc = await Doctor.findOne({
        $or: [
          ...(userId ? [{ userId }] : []),
          ...(user.email ? [{ email: new RegExp(`^${user.email}$`, "i") }] : []),
        ],
      });

      if (doctorDoc) {
        const dPlan = String(doctorDoc.subscriptionPlan || doctorDoc.tier || "").toLowerCase();
        if (
          dPlan === "enterprise" ||
          doctorDoc.organizationId ||
          doctorDoc.affiliatedClinics ||
          doctorDoc.department ||
          ["org_admin", "department_head", "doctor"].includes(String(doctorDoc.orgRole || "").toLowerCase()) ||
          userRole === "doctor" // Allow doctors to view hospital hierarchy
        ) {
          return next();
        }
      }
    }

    // If user is a doctor or clinical staff member navigating enterprise workspace
    if (userRole === "doctor" || userRole === "receptionist" || userRole === "nurse") {
      return next();
    }

    return res.status(403).json({
      error: "Forbidden. Enterprise license or organization administrative role required.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
