import express from "express";
import { hybridAuth } from "../middlewares/auth.middleware.js";
import { requireEnterpriseAccess } from "../middlewares/organization.middleware.js";
import {
  getOrganizationTree,
  getMyOrganization,
  getAllOrganizations,
  createOrganization,
  addDepartment,
  deleteDepartment,
  attachDoctorToOrg,
  updateDoctorAssignment,
  getRooms,
  createRoom,
  deleteRoom,
  assignDoctorRoom,
  getOrganizationBySlug,
  reorderDepartments,
  deleteOrganization,
} from "../controllers/organization.controller.js";

const router = express.Router();

// Apply auth and enterprise access protection to all organization endpoints
router.use(hybridAuth, requireEnterpriseAccess);

router.get("/all", getAllOrganizations);
router.post("/", createOrganization);
router.get("/tree", getOrganizationTree);
router.get("/my-org", getMyOrganization);
router.get("/by-slug/:slug", getOrganizationBySlug);
router.delete("/:id", deleteOrganization);
router.delete("/", deleteOrganization);

router.post("/departments", addDepartment);
router.put("/departments/reorder", reorderDepartments);
router.patch("/departments/reorder", reorderDepartments);
router.delete("/departments/:deptName", deleteDepartment);

router.post("/doctors", attachDoctorToOrg);
router.patch("/doctors/:doctorId", updateDoctorAssignment);

router.put("/assign-room", assignDoctorRoom);
router.patch("/assign-room", assignDoctorRoom);

router.get("/rooms", getRooms);
router.post("/rooms", createRoom);
router.delete("/rooms/:roomId", deleteRoom);

export default router;
