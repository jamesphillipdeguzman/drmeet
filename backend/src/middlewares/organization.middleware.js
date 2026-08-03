export function requireEnterpriseAccess(req, res, next) {
  const user = req.user || {};
  const isEnterprisePlan =
    user.subscriptionPlan === "enterprise" || user.tier === "enterprise";
  const orgRole = String(user.orgRole || "").toLowerCase();
  const userRole = String(user.role || "").toLowerCase();

  const isOrgAdminOrHead = ["org_admin", "department_head"].includes(orgRole);
  const isSystemAdmin = userRole === "admin";

  if (isEnterprisePlan || isOrgAdminOrHead || isSystemAdmin) {
    return next();
  }

  return res.status(403).json({
    error: "Forbidden. Enterprise license or organization administrative role required.",
  });
}
