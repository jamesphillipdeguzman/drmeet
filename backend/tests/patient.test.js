import request from 'supertest';
import express from 'express';
import patientRoutes from '../src/routes/patient.routes.js';

// Bypass middleware for testing
jest.mock('../src/middlewares/auth.middleware.js', () => ({
    hybridAuth: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/validate.middleware.js', () => ({
    validate: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/patient.validation.middleware.js', () => ({
    validatePatient: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/common.middleware.js', () => ({
    validateMongoIdParam: (req, res, next) => next(),
}));

jest.mock('../src/controllers/patient.controller.js', () => ({
    getAllPatients: (req, res) =>
        res.status(200).json([{ _id: 'pat123', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }]),
    getPatientById: (req, res) =>
        res.status(200).json({ _id: req.params.id, firstName: 'John', lastName: 'Doe', email: 'john@example.com' }),
    postPatient: (req, res) => res.status(201).json({ created: true }),
    updatePatient: (req, res) => res.status(200).json({ updated: true }),
    deletePatient: (req, res) => res.status(200).json({ deleted: true }),
}));

const app = express();
app.use(express.json());
app.use('/api/patients', patientRoutes);

describe('Patient Routes', () => {
    test('GET /api/patients', async () => {
        const res = await request(app).get('/api/patients');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/patients/:id', async () => {
        const res = await request(app).get('/api/patients/pat123');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('_id', 'pat123');
    });
});
