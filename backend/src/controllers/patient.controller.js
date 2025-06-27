import mongoose from 'mongoose';

import {
  findAllPatients,
  findPatientById,
  createPatient as createPatientService,
  updatePatientById as updatePatientByIdService,
  deletePatientById as deletePatientByIdService,
} from '../services/patient.service.js';
/**
 * @route GET /api/patients
 * @desc Fetch all patients
 */
export const getAllPatients = async (req, res) => {
  try {
    const patients = await findAllPatients();
    console.log('[PATIENT]✅ GET /api/patients was called.');
    return res.status(200).json(patients);
  } catch (error) {
    console.log('Error fetching patients: ', error);
    return res
      .status(500)
      .json({ error: 'An error occured while fetching all patients.' });
  }
};

/**
 * @route GET /api/patients/:id
 * @desc Fetch a patient by ID
 */
export const getPatientById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log('Invalid patient ID format');
    return res.status(400).json({ error: 'Invalid patient ID format' });
  }
  try {
    const patient = await findPatientById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }
    console.log(`[PATIENT]✅ GET /api/patients/${id} was called`);
    return res.status(200).json(patient);
  } catch (error) {
    console.log(`Error fetching the patient with ${id}:`, error);
    return res
      .status(500)
      .json({ error: 'An error occured while fetching the patient.' });
  }
};

/**
 * @route POST /api/patients
 * @desc Create a new patient
 */
export const postPatient = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (name && !req.body.firstName && !req.body.lastName) {
      const [firstName, ...lastNameParts] = name.split(' ');
      req.body.firstName = firstName;
      req.body.lastName = lastNameParts.join(' ') || '';
    }

    const patientData = req.body;
    const newPatient = await createPatientService(patientData);
    if (!newPatient) {
      return res.status(400).json({ error: 'Failed to create patient.' });
    }
    console.log(
      `[PATIENT]✅ POST /api/patients - Patient ${newPatient._id} created`,
    );
    return res.status(201).json(newPatient);
  } catch (error) {
    console.error('Error creating the patient: ', error);
    return res.status(500).json({
      error: error.message || 'An error occured while creating the patient.',
    });
  }
};

/**
 * @route PUT /api/patients/:id
 * @desc Update a patient by ID
 */
export const updatePatient = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const updatedPatient = await updatePatientByIdService(id, updates);
    if (!updatedPatient) {
      return res.status(404).json({ error: 'Patient not found. ' });
    }
    console.log(`[PATIENT]✅ PUT /api/patients/${id} was called`);

    return res.status(200).json(updatedPatient);
  } catch (error) {
    console.log(`Error updating the patient with ${id}:`, error);
    return res
      .status(500)
      .json({ error: 'An error occured while updating the patient.' });
  }
};

/**
 * @route DELETE /api/patients/:id
 * @desc Delete a patient by ID
 */
export const deletePatient = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }
  try {
    const deletedPatient = await deletePatientByIdService(id);
    if (!deletedPatient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }
    console.log(
      `[PATIENT]✅ DELETE /api/patients/${id} - Patient ${deletedPatient._id} successfully deleted`,
    );

    return res.status(200).json({ message: `Patient ${id} deleted.` });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'An error occured while deleting the patient.' });
  }
};
