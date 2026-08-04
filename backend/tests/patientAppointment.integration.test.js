import express from 'express';
import request from 'supertest';
import patientRoutes from '../src/routes/patient.routes.js';
import appointmentRoutes from '../src/routes/appointment.routes.js';
import Patient from '../src/models/patient.model.js';
import Appointment from '../src/models/appointment.model.js';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/patient.model.js');
jest.mock('../src/models/appointment.model.js');
jest.mock('../src/services/patient.service.js', () => ({
  findAllPatients: jest.fn().mockResolvedValue([]),
  findPatientById: jest.fn().mockResolvedValue(null),
  createPatient: jest.fn(),
  updatePatientById: jest.fn(),
  softDeletePatientById: jest.fn(),
  findPatientsByUserId: jest.fn().mockResolvedValue([]),
  findPatientsByAccountOwnerId: jest.fn().mockResolvedValue([]),
  findPatientsByIds: jest.fn().mockResolvedValue([]),
  findPatientsByDoctorCareTeam: jest.fn().mockResolvedValue([]),
  findAnyPatientByUserId: jest.fn().mockResolvedValue(null),
  isPatientDocActive: jest.fn().mockReturnValue(true),
  patientActiveQuery: jest.fn().mockReturnValue({ deletedAt: null }),
}));

jest.mock('../src/services/appointment.service.js', () => ({
  findAppointmentsByDoctor: jest.fn().mockResolvedValue([]),
  findAppointmentsByPatient: jest.fn().mockResolvedValue([]),
  appointmentExistsForDoctorPatient: jest.fn().mockResolvedValue(false),
}));

jest.mock('../src/services/doctor.service.js', () => ({
  findDoctorByUserId: jest.fn().mockResolvedValue({ _id: 'docObj123', userId: 'doctorUser123' }),
  findDoctorById: jest.fn().mockResolvedValue({ _id: 'docObj123', userId: 'doctorUser123' }),
}));

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (!req.isAuthenticated) req.isAuthenticated = () => false;
  next();
});
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);

describe('Integration Tests: Patient & Appointment Routes Security & Operations', () => {
  const secret = 'integration_test_secret';
  let doctorToken;
  let patientToken;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    doctorToken = jwt.sign(
      { _id: 'doctorUser123', role: 'doctor', email: 'doctor@drmeet.com' },
      secret
    );
    patientToken = jwt.sign(
      { _id: 'patientUser123', role: 'patient', email: 'patient@drmeet.com' },
      secret
    );
  });

  describe('Unauthorized Request Rejections (401)', () => {
    test('should reject GET /api/patients with 401 when no token is provided', async () => {
      const res = await request(app).get('/api/patients');
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    test('should reject GET /api/appointments with 401 when no token is provided', async () => {
      const res = await request(app).get('/api/appointments');
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Authorized Operations & Response Verification', () => {
    test('should allow authenticated doctor to GET /api/patients', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should validate Mongo ID parameters for /api/patients/:id', async () => {
      const res = await request(app)
        .get('/api/patients/invalid-mongo-id')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid patient ID format');
    });

    test('should reject PUT /api/patients/:id when unauthorized user tries to edit', async () => {
      const res = await request(app)
        .put('/api/patients/507f1f77bcf86cd799439011')
        .send({ firstName: 'Hacker' });

      expect(res.statusCode).toBe(401);
    });
  });
});
