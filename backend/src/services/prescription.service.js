import mongoose from 'mongoose';

const COLLECTION = 'prescriptions';

function getCollection() {
  return mongoose.connection.collection(COLLECTION);
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

export async function createPrescription(data) {
  const col = getCollection();
  const now = new Date();
  const doc = {
    patientId: String(data.patientId || ''),
    doctorId: String(data.doctorId || ''),
    appointmentId: data.appointmentId ? String(data.appointmentId) : '',
    medication: String(data.medication || ''),
    dosage: String(data.dosage || ''),
    instructions: String(data.instructions || ''),
    status: String(data.status || 'active'),
    secure_url: String(data.secure_url || ''),
    public_id: String(data.public_id || ''),
    createdBy: String(data.createdBy || ''),
    updatedBy: String(data.updatedBy || data.createdBy || ''),
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

export async function listPrescriptions(filters = {}) {
  const col = getCollection();
  const query = {};
  if (filters.patientId) query.patientId = String(filters.patientId);
  if (filters.doctorId) query.doctorId = String(filters.doctorId);
  if (filters.status) query.status = String(filters.status);
  if (filters.search) {
    const rx = new RegExp(String(filters.search), 'i');
    query.$or = [{ medication: rx }, { dosage: rx }, { instructions: rx }];
  }
  return col.find(query).sort({ createdAt: -1 }).toArray();
}

export async function getPrescriptionById(id) {
  const col = getCollection();
  const oid = toObjectId(id);
  if (!oid) return null;
  return col.findOne({ _id: oid });
}

export async function updatePrescriptionById(id, updates = {}) {
  const col = getCollection();
  const oid = toObjectId(id);
  if (!oid) return null;
  const allowed = {
    medication: updates.medication,
    dosage: updates.dosage,
    instructions: updates.instructions,
    status: updates.status,
    secure_url: updates.secure_url,
    public_id: updates.public_id,
    updatedBy: updates.updatedBy,
    updatedAt: new Date(),
  };
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
  await col.updateOne({ _id: oid }, { $set: allowed });
  return getPrescriptionById(id);
}

export async function deletePrescriptionById(id) {
  const col = getCollection();
  const oid = toObjectId(id);
  if (!oid) return null;
  const existing = await col.findOne({ _id: oid });
  if (!existing) return null;
  await col.deleteOne({ _id: oid });
  return existing;
}
