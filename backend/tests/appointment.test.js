import request from 'supertest';
import express from 'express';
import appointmentRoutes from '../src/routes/appointment.routes.js';

// Bypass middleware for testing
jest.mock('../src/middlewares/auth.middleware.js', () => ({
    hybridAuth: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/validate.middleware.js', () => ({
    validate: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/appointment.validation.middleware.js', () => ({
    validateAppointment: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/common.middleware.js', () => ({
    validateMongoIdParam: (req, res, next) => next(),
}));

// Ensure function names match your actual route file
jest.mock('../src/controllers/appointment.controller.js', () => ({
    getAllAppointments: (req, res) =>
        res.status(200).json([{ _id: 'appt123', doctor: 'doc1', patient: 'pat1', date: '2024-06-01', time: '14:00' }]),
    getAppointmentById: (req, res) =>
        res.status(200).json({ _id: req.params.id, doctor: 'doc1', patient: 'pat1', date: '2024-06-01', time: '14:00' }),
    postAppointment: (req, res) => res.status(201).json({ created: true }),
    updateAppointment: (req, res) => res.status(200).json({ updated: true }),
    deleteAppointment: (req, res) => res.status(200).json({ deleted: true }),
}));

// Create test app instance
const app = express();
app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

describe('Appointment Routes', () => {
    test('GET /api/appointments', async () => {
        const res = await request(app).get('/api/appointments');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/appointments/:id', async () => {
        const res = await request(app).get('/api/appointments/appt123');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('_id', 'appt123');
    });
});
