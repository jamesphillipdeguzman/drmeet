import Doctor from '../models/doctor.model.js';

export async function ensureDoctorProfileForUser(user) {
  if (!user) return null;
  const role = String(user.role || '').toLowerCase();
  if (role !== 'doctor') return null;
  const userId = user._id || user.id;
  if (!userId) return null;

  const existingDoctor = await Doctor.findOne({ userId });
  if (existingDoctor) return existingDoctor;

  return Doctor.create({
    userId,
    firstName: user.firstName || 'Doctor',
    lastName: user.lastName || 'Profile',
    email: user.email || '',
    phone: user.phone || '',
    specialty: 'General Medicine',
    affiliatedClinics: '',
    availabilityText: '',
  });
}
