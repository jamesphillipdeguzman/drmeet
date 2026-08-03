import mongoose from "mongoose";
import Organization from "../models/organization.model.js";
import Room from "../models/room.model.js";
import Doctor from "../models/doctor.model.js";
import User from "../models/user.model.js";

/** Helper to find or get user's organization */
async function resolveOrganizationForUser(req) {
  let org = null;
  const user = req.user || {};
  const requestedOrgId = req.query?.orgId || req.body?.orgId;

  if (requestedOrgId && mongoose.Types.ObjectId.isValid(requestedOrgId)) {
    org = await Organization.findById(requestedOrgId);
  }

  if (!org && user.organizationId) {
    org = await Organization.findById(user.organizationId);
  }

  if (!org && user.id) {
    org = await Organization.findOne({ adminUser: user.id });
  }

  if (!org) {
    // Check if any organization exists in DB
    org = await Organization.findOne();
  }

  // Fallback default organization creation for initial enterprise setup / demo
  if (!org) {
    org = await Organization.create({
      name: "St. Luke's Medical Center",
      slug: "st-lukes-med",
      tier: "enterprise",
      maxDoctorSeats: 150,
      maxRooms: 50,
      adminUser: user.id || null,
      departments: [
        { name: "Cardiology" },
        { name: "Pediatrics" },
        { name: "Dermatology" },
        { name: "Orthopedics" },
        { name: "General Medicine" },
      ],
    });
  }

  return org;
}

/**
 * GET /api/organization/all
 * List all hospital organizations
 */
export async function getAllOrganizations(req, res) {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    return res.status(200).json(orgs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/organization
 * Create a new hospital organization
 */
export async function createOrganization(req, res) {
  try {
    const { name, slug, maxDoctorSeats, maxRooms } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Hospital name is required." });
    }

    const trimmedName = name.trim();
    const generatedSlug = (slug && String(slug).trim())
      ? String(slug).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 7);

    const newOrg = await Organization.create({
      name: trimmedName,
      slug: generatedSlug,
      tier: "enterprise",
      maxDoctorSeats: Number(maxDoctorSeats) || 150,
      maxRooms: Number(maxRooms) || 50,
      adminUser: req.user?.id || req.user?._id || null,
      departments: [
        { name: "Cardiology" },
        { name: "Pediatrics" },
        { name: "Dermatology" },
        { name: "Orthopedics" },
        { name: "General Medicine" },
      ],
    });

    return res.status(201).json({ message: "Hospital facility created successfully.", organization: newOrg });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/organization/tree
 * Returns nested JSON hierarchy representation
 */
export async function getOrganizationTree(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) {
      return res.status(404).json({ error: "Organization not found." });
    }

    const rooms = await Room.find({ organizationId: org._id });
    const doctors = await Doctor.find({ organizationId: org._id }).populate(
      "assignedRoom",
      "roomName department dailyPatientCap"
    );

    const deptList = Array.isArray(org.departments) ? [...org.departments].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) : [];

    // Map departments to nested structure
    const departmentsTree = await Promise.all(
      deptList.map(async (deptObj) => {
        const deptName = typeof deptObj === "string" ? deptObj : deptObj.name;
        const headDoctorId = typeof deptObj === "object" ? deptObj.headDoctor : null;

        let headDoctor = null;
        if (headDoctorId) {
          headDoctor = await Doctor.findById(headDoctorId).select(
            "firstName lastName title specialty photoUrl"
          );
        }

        const deptRooms = rooms
          .filter((r) => String(r.department || "").toLowerCase() === deptName.toLowerCase())
          .map((r) => ({
            id: String(r._id),
            name: r.roomName,
            department: r.department,
            dailyCap: r.dailyPatientCap || 30,
            type: "room",
          }));

        const deptDoctors = doctors
          .filter((d) => String(d.department || "").toLowerCase() === deptName.toLowerCase())
          .map((d) => ({
            id: String(d._id),
            name: `${d.title ? d.title + " " : ""}${d.firstName} ${d.lastName}`.trim(),
            firstName: d.firstName,
            lastName: d.lastName,
            title: d.title || "",
            specialty: d.specialty || "",
            photoUrl: d.photoUrl || "",
            licenseNumber: d.licenseNumber || d.prcLicenseNumber || "",
            department: d.department,
            assignedRoom: d.assignedRoom
              ? {
                  id: String(d.assignedRoom._id),
                  name: d.assignedRoom.roomName,
                }
              : null,
            orgRole: d.orgRole || "doctor",
            type: "doctor",
          }));

        return {
          _id: typeof deptObj === "object" && deptObj._id ? String(deptObj._id) : null,
          name: deptName,
          orderIndex: typeof deptObj === "object" && typeof deptObj.orderIndex === "number" ? deptObj.orderIndex : 0,
          type: "department",
          headDoctor: headDoctor
            ? {
                id: String(headDoctor._id),
                name: `${headDoctor.title ? headDoctor.title + " " : ""}${headDoctor.firstName} ${headDoctor.lastName}`.trim(),
              }
            : null,
          rooms: deptRooms,
          doctors: deptDoctors,
        };
      })
    );

    // Unassigned rooms and doctors
    const assignedDeptNamesSet = new Set(
      deptList.map((d) => (typeof d === "string" ? d : d.name).toLowerCase())
    );

    const unassignedRooms = rooms
      .filter((r) => !r.department || !assignedDeptNamesSet.has(r.department.toLowerCase()))
      .map((r) => ({
        id: String(r._id),
        name: r.roomName,
        department: r.department || "General",
        dailyCap: r.dailyPatientCap || 30,
        type: "room",
      }));

    const unassignedDoctors = doctors
      .filter((d) => !d.department || !assignedDeptNamesSet.has(d.department.toLowerCase()))
      .map((d) => ({
        id: String(d._id),
        name: `${d.title ? d.title + " " : ""}${d.firstName} ${d.lastName}`.trim(),
        firstName: d.firstName,
        lastName: d.lastName,
        title: d.title || "",
        specialty: d.specialty || "",
        photoUrl: d.photoUrl || "",
        licenseNumber: d.licenseNumber || d.prcLicenseNumber || "",
        department: d.department || "General",
        assignedRoom: d.assignedRoom
          ? {
              id: String(d.assignedRoom._id),
              name: d.assignedRoom.roomName,
            }
          : null,
        orgRole: d.orgRole || "doctor",
        type: "doctor",
      }));

    if (unassignedRooms.length > 0 || unassignedDoctors.length > 0) {
      departmentsTree.push({
        name: "General / Unassigned",
        type: "department",
        headDoctor: null,
        rooms: unassignedRooms,
        doctors: unassignedDoctors,
      });
    }

    return res.status(200).json({
      id: String(org._id),
      name: org.name,
      slug: org.slug,
      tier: org.tier || "enterprise",
      type: "hospital",
      maxDoctorSeats: org.maxDoctorSeats || 150,
      maxRooms: org.maxRooms || 50,
      activeDoctors: doctors.length,
      activeRooms: rooms.length,
      departments: departmentsTree,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/organization/my-org
 */
export async function getMyOrganization(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const rawRooms = await Room.find({ organizationId: org._id });
    const rawDoctors = await Doctor.find({ organizationId: org._id });

    const rooms = Array.isArray(rawRooms) ? rawRooms : [];
    const doctors = Array.isArray(rawDoctors) ? rawDoctors : [];

    return res.status(200).json({
      organization: org,
      activeDoctors: doctors.length,
      maxDoctorSeats: org.maxDoctorSeats || 150,
      activeRooms: rooms.length,
      maxRooms: org.maxRooms || 50,
      rooms,
      doctors,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/organization/departments
 * Add a new department to organization
 */
export async function addDepartment(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const { name, headDoctorId } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Department name is required." });
    }

    const trimmedName = name.trim();
    const existingIndex = org.departments.findIndex(
      (d) => (typeof d === "string" ? d : d.name).toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingIndex >= 0) {
      return res.status(400).json({ error: `Department "${trimmedName}" already exists.` });
    }

    org.departments.push({
      name: trimmedName,
      headDoctor: headDoctorId || null,
    });

    await org.save();
    return res.status(201).json({ message: "Department created successfully.", organization: org });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/organization/departments/:deptName
 * Safely delete a department, setting doctor assignments to null
 */
export async function deleteDepartment(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const { deptName } = req.params;
    if (!deptName) return res.status(400).json({ error: "Department name required." });

    org.departments = org.departments.filter(
      (d) => (typeof d === "string" ? d : d.name).toLowerCase() !== deptName.toLowerCase()
    );
    await org.save();

    // Safely reset doctor department & assignedRoom without deleting doctor profile
    await Doctor.updateMany(
      { organizationId: org._id, department: deptName },
      { $set: { department: null, assignedRoom: null } }
    );

    await User.updateMany(
      { organizationId: org._id, department: deptName },
      { $set: { department: null, assignedRoom: null } }
    );

    return res.status(200).json({ message: `Department "${deptName}" deleted safely.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/organization/doctors
 * Attach doctor to organization with seat cap check (HTTP 403)
 */
export async function attachDoctorToOrg(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const { doctorId, email, department, assignedRoom, orgRole } = req.body;

    let doctor = null;
    if (doctorId) {
      doctor = await Doctor.findById(doctorId);
    } else if (email) {
      doctor = await Doctor.findOne({ email: String(email).toLowerCase() });
    }

    if (!doctor) {
      return res.status(404).json({ error: "Doctor record not found." });
    }

    // Check if doctor is already attached to this org
    const isAlreadyAttached = String(doctor.organizationId || "") === String(org._id);

    if (!isAlreadyAttached) {
      const activeDoctors = await Doctor.countDocuments({ organizationId: org._id });
      if (activeDoctors >= (org.maxDoctorSeats || 150)) {
        return res.status(403).json({
          error: "Doctor seat limit reached for this organization. Maximum seats: " + org.maxDoctorSeats,
        });
      }
    }

    doctor.organizationId = org._id;
    doctor.subscriptionPlan = "enterprise";
    if (department !== undefined) doctor.department = department || null;
    if (assignedRoom !== undefined) doctor.assignedRoom = assignedRoom || null;
    if (orgRole !== undefined) doctor.orgRole = orgRole || "doctor";

    await doctor.save();

    if (doctor.userId) {
      await User.findByIdAndUpdate(doctor.userId, {
        organizationId: org._id,
        subscriptionPlan: "enterprise",
        department: doctor.department,
        assignedRoom: doctor.assignedRoom,
        orgRole: doctor.orgRole,
      });
    }

    return res.status(200).json({ message: "Doctor attached successfully.", doctor });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/organization/doctors/:doctorId
 * Update a doctor's department, assigned room, orgRole, or detach them
 */
export async function updateDoctorAssignment(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    const { doctorId } = req.params;
    const { department, assignedRoom, orgRole, detach } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    if (detach) {
      doctor.organizationId = null;
      doctor.department = null;
      doctor.assignedRoom = null;
      doctor.orgRole = null;
      await doctor.save();

      if (doctor.userId) {
        await User.findByIdAndUpdate(doctor.userId, {
          organizationId: null,
          department: null,
          assignedRoom: null,
          orgRole: null,
        });
      }

      return res.status(200).json({ message: "Doctor detached from organization.", doctor });
    }

    if (department !== undefined) doctor.department = department || null;
    if (assignedRoom !== undefined) doctor.assignedRoom = assignedRoom || null;
    if (orgRole !== undefined) doctor.orgRole = orgRole || doctor.orgRole;
    if (org && !doctor.organizationId) doctor.organizationId = org._id;

    await doctor.save();

    if (doctor.userId) {
      await User.findByIdAndUpdate(doctor.userId, {
        department: doctor.department,
        assignedRoom: doctor.assignedRoom,
        orgRole: doctor.orgRole,
        organizationId: doctor.organizationId,
      });
    }

    return res.status(200).json({ message: "Doctor assignment updated.", doctor });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET & POST /api/organization/rooms
 */
export async function getRooms(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const rooms = await Room.find({ organizationId: org._id });
    return res.status(200).json(rooms);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function createRoom(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const activeRooms = await Room.countDocuments({ organizationId: org._id });
    if (activeRooms >= (org.maxRooms || 50)) {
      return res.status(403).json({
        error: "Room capacity limit reached for this organization. Maximum rooms: " + org.maxRooms,
      });
    }

    const { roomName, department, dailyPatientCap } = req.body;
    if (!roomName || !String(roomName).trim()) {
      return res.status(400).json({ error: "Room name is required." });
    }

    const room = await Room.create({
      organizationId: org._id,
      roomName: roomName.trim(),
      department: department ? String(department).trim() : "",
      dailyPatientCap: Number(dailyPatientCap) || 30,
    });

    return res.status(201).json({ message: "Room created successfully.", room });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/organization/rooms/:roomId
 */
export async function deleteRoom(req, res) {
  try {
    const { roomId } = req.params;
    const room = await Room.findByIdAndDelete(roomId);
    if (!room) return res.status(404).json({ error: "Room not found." });

    // Safely reset assignedRoom to null for any doctor assigned to this room
    await Doctor.updateMany(
      { assignedRoom: roomId },
      { $set: { assignedRoom: null } }
    );

    return res.status(200).json({ message: "Room deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/organization/assign-room
 * Assign doctor to consultation room
 */
export async function assignDoctorRoom(req, res) {
  try {
    const { doctorId, roomId } = req.body;
    if (!doctorId) return res.status(400).json({ error: "Doctor ID is required." });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    let room = null;
    if (roomId) {
      room = await Room.findById(roomId);
      if (room) {
        doctor.assignedRoom = room._id;
        if (room.department) doctor.department = room.department;
      }
    } else {
      doctor.assignedRoom = null;
    }

    await doctor.save();
    if (doctor.userId) {
      await User.findByIdAndUpdate(doctor.userId, {
        assignedRoom: doctor.assignedRoom,
        department: doctor.department,
      });
    }

    return res.status(200).json({ message: "Doctor room assignment updated successfully.", doctor });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/organization/by-slug/:slug
 * Fetch organization details by slug
 */
export async function getOrganizationBySlug(req, res) {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: "Slug parameter is required." });

    const normalizedSlug = slug.toLowerCase().trim();
    let org = await Organization.findOne({ slug: normalizedSlug });
    if (!org) {
      const allOrgs = await Organization.find();
      org = allOrgs.find((o) => {
        const generatedSlug = (o.slug || o.name || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        return generatedSlug === normalizedSlug;
      });
    }

    if (!org) {
      return res.status(404).json({ error: `Organization with slug '${slug}' not found.` });
    }

    return res.status(200).json(org);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/organization/departments/reorder
 * Reorder departments by updating their orderIndex field
 */
export async function reorderDepartments(req, res) {
  try {
    const org = await resolveOrganizationForUser(req);
    if (!org) return res.status(404).json({ error: "Organization not found." });

    const { departmentOrders } = req.body;
    if (!Array.isArray(departmentOrders)) {
      return res.status(400).json({ error: "departmentOrders array is required." });
    }

    const orderMap = new Map();
    departmentOrders.forEach((item, index) => {
      const targetPos = typeof item.position === "number" ? item.position : typeof item.orderIndex === "number" ? item.orderIndex : index;
      if (item.id) orderMap.set(String(item.id), targetPos);
      if (item.name) orderMap.set(String(item.name).toLowerCase(), targetPos);
    });

    org.departments.forEach((deptObj, idx) => {
      const deptIdStr = deptObj._id ? String(deptObj._id) : null;
      const deptNameStr = (typeof deptObj === "string" ? deptObj : deptObj.name || "").toLowerCase();

      if (deptIdStr && orderMap.has(deptIdStr)) {
        deptObj.orderIndex = orderMap.get(deptIdStr);
      } else if (orderMap.has(deptNameStr)) {
        deptObj.orderIndex = orderMap.get(deptNameStr);
      } else {
        deptObj.orderIndex = idx;
      }
    });

    org.departments.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    await org.save();

    return res.status(200).json({ message: "Department order updated successfully.", organization: org });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
