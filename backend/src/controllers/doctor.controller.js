import mongoose from 'mongoose';
import crypto from 'crypto';

import {
  findAllDoctors,
  findDoctorById,
  findDoctorByUserId,
  createDoctor as createDoctorService,
  updateDoctorById as updateDoctorByIdService,
  deleteDoctorById as deleteDoctorByIdService,
} from '../services/doctor.service.js';
import User from '../models/user.model.js';
import Patient from '../models/patient.model.js';
import { patientActiveQuery } from '../services/patient.service.js';
import { findAppointmentsByPatient } from '../services/appointment.service.js';
import { syncRoleProfilesForUser } from '../services/userRoleProfileSync.service.js';
import { sanitizeInput } from '../utils/inputSanitizer.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';
import { sendReceptionistInviteEmail } from '../services/emailService.js';

function authUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

function authRole(req) {
  return String(req.user?.role || '').toLowerCase();
}

function isAdmin(req) {
  return authRole(req) === 'admin';
}

async function getScopedDoctors(req) {
  const role = authRole(req);
  const uid = authUserId(req);

  if (role === 'admin' || role === 'patient') {
    // Read-only doctor discovery for patients/staff.
    const doctors = await findAllDoctors();
    if (doctors.length) return doctors;

    // Fallback: some deployments have doctor users but missing doctor profile docs.
    const users = await User.find({ role: 'doctor' }).lean();
    return users.map((u) => ({
      _id: u._id,
      userId: u._id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      phone: u.phone || '',
      receptionistName: '',
      receptionistEmail: '',
      receptionistPhone: '',
      specialty: '',
      affiliatedClinics: '',
      availability: [],
      availabilityText: '',
    }));
  }
  if (role === 'receptionist' && uid) {
    const receptionist = await User.findById(uid)
      .select('linkedDoctorId receptionistType')
      .lean();
    const type = String(receptionist?.receptionistType || '').toLowerCase();
    const linkedDoctorId = receptionist?.linkedDoctorId
      ? String(receptionist.linkedDoctorId)
      : '';
    if (type === 'small_clinic') {
      if (!linkedDoctorId) return [];
      const linkedDoctor = await findDoctorById(linkedDoctorId);
      return linkedDoctor ? [linkedDoctor] : [];
    }
    return findAllDoctors();
  }

  if (role === 'doctor' && uid) {
    const doc = await findDoctorByUserId(uid);
    return doc ? [doc] : [];
  }

  return [];
}

async function doctorVisibleToRequester(req, doctorDoc) {
  if (!doctorDoc) return false;
  const role = authRole(req);
  const uid = authUserId(req);
  const did = String(doctorDoc._id);

  if (role === 'admin') return true;

  if (role === 'receptionist' && uid) {
    const receptionist = await User.findById(uid)
      .select('linkedDoctorId receptionistType')
      .lean();
    const type = String(receptionist?.receptionistType || '').toLowerCase();
    if (type === 'small_clinic') {
      return (
        Boolean(receptionist?.linkedDoctorId) &&
        String(receptionist.linkedDoctorId) === did
      );
    }
    return true;
  }

  if (role === 'patient' && uid) {
    const patient = await Patient.findOne({
      userId: uid,
      ...patientActiveQuery,
    }).lean();
    if (!patient) return true;
    const appointments = await findAppointmentsByPatient(String(patient._id));
    const assignedDoctorIds = new Set(
      appointments.map((a) => String(a.doctor)).filter(Boolean),
    );
    // Allow assigned doctors and discovery fallback docs (user-backed doctor cards).
    return assignedDoctorIds.has(did) || String(doctorDoc.userId || '') === did;
  }

  if (role === 'doctor' && uid) {
    const mine = await findDoctorByUserId(uid);
    return mine && String(mine._id) === did;
  }

  return false;
}
/**
 * @route GET /api/doctors
 * @desc Fetch all doctors
 */
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await getScopedDoctors(req);
    const normalizedDoctors = doctors.map((doctor) => {
      const plain = doctor.toObject ? doctor.toObject() : doctor;
      const firstSlot = Array.isArray(plain.availability)
        ? plain.availability[0]
        : null;
      return {
        ...plain,
        specialty: plain.specialty || '',
        affiliatedClinics:
          plain.affiliatedClinics || firstSlot?.location?.clinicName || '',
      };
    });
    console.log('[DOCTOR]✅ GET /api/doctors was called.');
    return res.status(200).json(normalizedDoctors);
  } catch (error) {
    console.log('Error fetching doctors: ', error);
    return res
      .status(500)
      .json({ error: 'An error occured while fetching all doctors.' });
  }
};

/**
 * @route GET /api/doctors/:id
 * @desc Fetch a doctor by ID
 */
export const getDoctorById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid doctor ID format' });
  }

  try {
    const doctor = await findDoctorById(id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    const allowed = await doctorVisibleToRequester(req, doctor);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const plainDoctor = doctor.toObject?.() || doctor;

    console.log(`[DOCTOR] GET /api/doctors/${id}`);

    return res.status(200).json(plainDoctor);
  } catch (error) {
    console.error(`Error fetching doctor ${id}:`, error);

    return res.status(500).json({
      error: 'Error fetching doctor',
    });
  }
};

/**
 * @route POST /api/doctors
 * @desc Create a new doctor
 */
export const postDoctor = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Only admins can create doctors.' });
  }
  try {
    const body = sanitizeInput(req.body || {});
    let photoUpload = null;
    if (body.photoFileData) {
      photoUpload = await uploadToCloudinary(body.photoFileData, {
        folder: 'drmeet/doctors',
        resource_type: 'image',
      });
    }

    // ✅ normalize fields
    const doctorData = {
      ...body,
      firstName: body.firstName?.trim(),
      lastName: body.lastName?.trim(),
      email: body.email?.trim(),
      specialty: body.specialty,
      photoUrl: photoUpload?.secure_url || body.photoUrl || '',
    };

    if (!doctorData.userId) {
      delete doctorData.userId;
    }

    // ✅ manual validation (IMPORTANT for debugging)
    const missingFields = [];

    if (!doctorData.firstName) missingFields.push('firstName');
    if (!doctorData.lastName) missingFields.push('lastName');
    if (!doctorData.email) missingFields.push('email');
    if (!doctorData.specialty) missingFields.push('specialty');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields,
      });
    }

    const newDoctor = await createDoctorService(doctorData);
    if (newDoctor.userId) {
      await User.findByIdAndUpdate(
        newDoctor.userId,
        {
          firstName: newDoctor.firstName || '',
          lastName: newDoctor.lastName || '',
          email: newDoctor.email || '',
          phone: newDoctor.phone || '',
          specialty: newDoctor.specialty || '',
          ...(newDoctor.title ? { title: newDoctor.title } : {}),
        },
        { new: true },
      );
    }

    console.log(`[DOCTOR] CREATED: ${newDoctor._id}`);

    return res.status(201).json(newDoctor);
  } catch (error) {
    console.error('Doctor creation failed:', error);

    // ✅ expose mongoose validation errors clearly
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.keys(error.errors).map(
          (key) => error.errors[key].message,
        ),
      });
    }

    return res.status(500).json({
      error: error.message || 'Server error while creating doctor',
    });
  }
};

/**
 * @route PUT /api/doctors/:id
 * @desc Update a doctor by ID
 */
export const updateDoctor = async (req, res) => {
  const role = authRole(req);
  const uid = authUserId(req);
  const cleanedBody = sanitizeInput(req.body || {});
  const { id } = req.params;
  const updates = {
    ...cleanedBody,
    specialty: cleanedBody.specialty,
  };
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid doctor ID format.' });
  }

  try {
    if (cleanedBody.photoFileData) {
      const photoUpload = await uploadToCloudinary(cleanedBody.photoFileData, {
        folder: 'drmeet/doctors',
        resource_type: 'image',
      });
      updates.photoUrl = photoUpload?.secure_url || updates.photoUrl || '';
    }
    if (role === 'doctor') {
      const mine = await findDoctorByUserId(uid);
      if (!mine || String(mine._id) !== String(id)) {
        return res
          .status(403)
          .json({ error: 'Only your profile can be updated.' });
      }
    } else if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Only admins can update doctors.' });
    }
    const updatedDoctor = await updateDoctorByIdService(id, updates);
    if (!updatedDoctor) {
      return res.status(404).json({ error: 'Doctor not found. ' });
    }
    if (updatedDoctor.userId) {
      await User.findByIdAndUpdate(
        updatedDoctor.userId,
        {
          firstName: updatedDoctor.firstName || '',
          lastName: updatedDoctor.lastName || '',
          email: updatedDoctor.email || '',
          phone: updatedDoctor.phone || '',
          specialty: updatedDoctor.specialty || '',
          ...(updatedDoctor.title ? { title: updatedDoctor.title } : {}),
        },
        { new: true },
      );
    }
    console.log(`[DOCTOR]✅ PUT /api/doctors/${id} was called`);

    return res.status(200).json(updatedDoctor);
  } catch (error) {
    console.log(`Error updating the doctor with ${id}:`, error);
    return res.status(500).json({
      error: error.message || 'An error occured while updating the doctor.',
    });
  }
};

/**
 * @route DELETE /api/doctors/:id
 * @desc Delete a doctor by ID
 */
export const deleteDoctor = async (req, res) => {
  const role = authRole(req);
  const uid = authUserId(req);
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid doctor ID format.' });
  }
  try {
    if (role === 'doctor') {
      const mine = await findDoctorByUserId(uid);
      if (!mine || String(mine._id) !== String(id)) {
        return res
          .status(403)
          .json({ error: 'Only your profile can be deleted.' });
      }
    } else if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Only admins can delete doctors.' });
    }
    const deletedDoctor = await deleteDoctorByIdService(id);
    if (!deletedDoctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }
    console.log(
      `[DOCTOR]✅ DELETE /api/doctors/${id} - Doctor ${deletedDoctor._id} successfully deleted`,
    );

    return res.status(200).json({ message: `Doctor ${id} deleted.` });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'An error occured while deleting the doctor.' });
  }
};

/**
 * @route POST /api/doctors/clinic-staff/invite
 * @desc Doctor invites a receptionist linked to their clinic
 */
export const inviteReceptionist = async (req, res) => {
  try {
    const role = authRole(req);
    const uid = authUserId(req);

    if (role !== 'doctor') {
      return res
        .status(403)
        .json({ error: 'Only doctors can invite clinic staff.' });
    }

    const doctor = await findDoctorByUserId(uid);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found.' });
    }

    // ================= INPUTS =================
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();

    const receptionistName = String(req.body?.receptionistName || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!email) {
      return res.status(400).json({ error: 'Receptionist email is required.' });
    }

    if (!receptionistName) {
      return res.status(400).json({ error: 'Receptionist name is required.' });
    }

    // ✅ extract only first name
    const firstName = receptionistName.split(' ').filter(Boolean)[0] || '';

    // ================= UPSERT USER =================
    const existing = await User.findOne({ email });

    const receptionist = existing
      ? await User.findByIdAndUpdate(
          existing._id,
          {
            role: 'receptionist',
            linkedDoctorId: doctor._id,
            firstName,
            receptionistName, // ✅ ADD THIS
          },
          { new: true },
        )
      : await User.create({
          firstName,
          receptionistName, // ✅ ADD THIS
          email,
          role: 'receptionist',
          linkedDoctorId: doctor._id,
        });

    // ================= TOKEN =================
    const token = crypto.randomBytes(32).toString('hex');

    // ================= EMAIL =================
    const inviteResult = await sendReceptionistInviteEmail({
      email,
      doctorName: `${doctor.firstName} ${doctor.lastName}`,
      receptionistName,
      inviteLink: `${process.env.CLIENT_ORIGIN}/#accept-invite?token=${token}`,
    });

    console.log('=== EMAIL DEBUG ===', inviteResult);

    return res.status(existing ? 200 : 201).json({
      message: existing
        ? 'Receptionist linked successfully.'
        : 'Receptionist invited successfully.',
      emailStatus: inviteResult?.sent ? 'sent' : 'failed',
      user: receptionist,
      debug: inviteResult,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to invite receptionist.',
    });
  }
};
