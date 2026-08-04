import { normalizeRole } from "./auth.middleware.js";

export function requireEnterpriseAccess(req, res, next) {
  const user = req.user || {};
  const userRole = normalizeRole(user.role || "");
  const isEnterprisePlan =
    user.subscriptionPlan === "enterprise" ||
    user.tier === "enterprise" ||
    user.isSuperAdmin === true ||
    userRole === "super_admin";
  const orgRole = String(user.orgRole || "").toLowerCase();

  const isOrgAdminOrHead = ["org_admin", "department_head"].includes(orgRole);
  const isSystemAdmin = ["super_admin", "hospital_admin", "admin"].includes(userRole);

  if (isEnterprisePlan || isOrgAdminOrHead || isSystemAdmin) {
    return next();
  }

  return res.status(403).json({
    error: "Forbidden. Enterprise license or organization administrative role required.",
  });
}
