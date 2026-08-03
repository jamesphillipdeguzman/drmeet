import User from "../models/user.model.js";
import Doctor from "../models/doctor.model.js";
import Patient from "../models/patient.model.js";
import Organization from "../models/organization.model.js";

/**
 * GET /api/admin/subscriptions-overview
 * Returns master subscription breakdown across all users and accounts
 */
export async function getSubscriptionsOverview(req, res) {
  try {
    let users = [];
    let doctors = [];
    let patients = [];
    let organizations = [];

    try {
      const userQuery = User.find({ is_deleted: { $ne: true } });
      const resUsers = userQuery.select ? await userQuery.select("firstName lastName email role subscriptionPlan organizationId createdAt") : await userQuery;
      users = Array.isArray(resUsers) ? resUsers : [];
    } catch (e) {
      users = [];
    }

    try {
      const docQuery = Doctor.find();
      const resDocs = docQuery.select ? await docQuery.select("userId email subscriptionPlan assignedPatients organizationId") : await docQuery;
      doctors = Array.isArray(resDocs) ? resDocs : [];
    } catch (e) {
      doctors = [];
    }

    try {
      const patQuery = Patient.find({ deletedAt: null, isActive: true });
      const resPats = patQuery.select ? await patQuery.select("userId accountOwnerId organizationId") : await patQuery;
      patients = Array.isArray(resPats) ? resPats : [];
    } catch (e) {
      patients = [];
    }

    try {
      const orgQuery = Organization.find();
      const resOrgs = orgQuery.select ? await orgQuery.select("name slug tier") : await orgQuery;
      organizations = Array.isArray(resOrgs) ? resOrgs : [];
    } catch (e) {
      organizations = [];
    }

    const orgMap = new Map();
    organizations.forEach((o) => {
      if (o && o._id) orgMap.set(String(o._id), o.name);
    });

    const doctorPatientCountMap = new Map();
    doctors.forEach((d) => {
      if (!d) return;
      const count = Array.isArray(d.assignedPatients) ? d.assignedPatients.length : 0;
      if (d.userId) doctorPatientCountMap.set(String(d.userId), count);
    });

    const userPatientCountMap = new Map();
    patients.forEach((p) => {
      if (!p) return;
      if (p.accountOwnerId) {
        const key = String(p.accountOwnerId);
        userPatientCountMap.set(key, (userPatientCountMap.get(key) || 0) + 1);
      }
    });

    let starterCount = 0;
    let proCount = 0;
    let enterpriseCount = 0;

    const userBreakdown = users
      .map((u) => {
        if (!u) return null;
        const uId = String(u._id || u.id || "");
        const plan = String(u.subscriptionPlan || "starter").toLowerCase();

        let formattedTier = "Starter";
        if (plan === "enterprise" || u.organizationId) {
          formattedTier = "Enterprise";
          enterpriseCount++;
        } else if (plan === "pro") {
          formattedTier = "Pro";
          proCount++;
        } else {
          formattedTier = "Starter";
          starterCount++;
        }

        const activePatientCount =
          doctorPatientCountMap.get(uId) || userPatientCountMap.get(uId) || 0;

        const orgName = u.organizationId ? orgMap.get(String(u.organizationId)) || "Enterprise Org" : "—";

        return {
          id: uId,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "User",
          email: u.email || "—",
          role: u.role || "user",
          currentTier: formattedTier,
          activePatients: activePatientCount,
          joinedDate: u.createdAt || null,
          organizationName: orgName,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      summary: {
        totalUsers: userBreakdown.length,
        starterCount,
        proCount,
        enterpriseCount,
      },
      users: userBreakdown,
    });
  } catch (err) {
    console.error("[admin.controller] getSubscriptionsOverview error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch subscriptions overview." });
  }
}
