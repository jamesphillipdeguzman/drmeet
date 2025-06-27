import request from 'supertest';
import express from 'express';
import doctorRoutes from '../src/routes/doctor.routes.js';

// Bypass middleware for testing
jest.mock('../src/middlewares/auth.middleware.js', () => ({
    hybridAuth: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/validate.middleware.js', () => ({
    validate: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/doctor.validation.middleware.js', () => ({
    validateDoctor: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/common.middleware.js', () => ({
    validateMongoIdParam: (req, res, next) => next(),
}));

jest.mock('../src/controllers/doctor.controller.js', () => ({
    getAllDoctors: (req, res) =>
        res.status(200).json([{ _id: 'doc123', firstName: 'Alice', lastName: 'Smith', specialization: 'Cardiology' }]),
    getDoctorById: (req, res) =>
        res.status(200).json({ _id: req.params.id, firstName: 'Alice', lastName: 'Smith', specialization: 'Cardiology' }),
    postDoctor: (req, res) => res.status(201).json({ created: true }),
    updateDoctor: (req, res) => res.status(200).json({ updated: true }),
    deleteDoctor: (req, res) => res.status(200).json({ deleted: true }),
}));

const app = express();
app.use(express.json());
app.use('/api/doctors', doctorRoutes);

describe('Doctor Routes', () => {
    test('GET /api/doctors', async () => {
        const res = await request(app).get('/api/doctors');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/doctors/:id', async () => {
        const res = await request(app).get('/api/doctors/doc123');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('_id', 'doc123');
    });
});
