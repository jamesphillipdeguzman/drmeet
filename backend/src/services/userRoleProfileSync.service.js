import Doctor from '../models/doctor.model.js';
import Patient from '../models/patient.model.js';

function cleanTitleForRole(role, incomingTitle = '') {
  const value = String(incomingTitle || '').trim();
  if (!value) return '';
  const normalizedRole = String(role || '').toLowerCase();
  const doctorTitles = new Set(['Dr.', 'Dra.']);
  const userTitles = new Set(['Mr.', 'Ms.', 'Mrs.']);
  if (normalizedRole === 'doctor') {
    return doctorTitles.has(value) ? value : '';
  }
  return userTitles.has(value) ? value : '';
}

export async function syncRoleProfilesForUser(user, options = {}) {
  if (!user) return;
  const role = String(user.role || '').toLowerCase();
  const userId = user._id || user.id;
  if (!userId) return;

  const title = cleanTitleForRole(role, options.title ?? user.title);

  if (role === 'doctor') {
    const existingDoctor = await Doctor.findOne({ userId });
    if (!existingDoctor) {
      await Doctor.create({
        userId,
        firstName: user.firstName || 'Doctor',
        lastName: user.lastName || 'Profile',
        email: user.email || '',
        phone: user.phone || '',
        title: title || undefined,
        specialty: String(options.specialty || '').trim() || 'General Medicine',
        affiliatedClinics: '',
        availabilityText: '',
      });
    } else {
      await Doctor.findByIdAndUpdate(existingDoctor._id, {
        firstName: user.firstName || existingDoctor.firstName,
        lastName: user.lastName || existingDoctor.lastName,
        email: user.email || existingDoctor.email,
        phone: user.phone || existingDoctor.phone,
        ...(title ? { title } : {}),
      });
    }
    await Patient.findOneAndDelete({ userId });
    return;
  }

  if (role === 'patient') {
    const existingPatient = await Patient.findOne({ userId });
    if (!existingPatient) {
      await Patient.create({
        userId,
        firstName: user.firstName || 'Patient',
        lastName: user.lastName || 'Profile',
        email: user.email || '',
        phone: user.phone || '',
      });
    } else {
      await Patient.findByIdAndUpdate(existingPatient._id, {
        firstName: user.firstName || existingPatient.firstName,
        lastName: user.lastName || existingPatient.lastName,
        email: user.email || existingPatient.email,
        phone: user.phone || existingPatient.phone,
      });
    }
    await Doctor.findOneAndDelete({ userId });
    return;
  }

  // Receptionists/admins only live in Users table.
  await Doctor.findOneAndDelete({ userId });
  await Patient.findOneAndDelete({ userId });
}
