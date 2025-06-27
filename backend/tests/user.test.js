import request from 'supertest';
import express from 'express';
import userRoutes from '../src/routes/user.routes.js';

// Bypass middleware for testing
jest.mock('../src/middlewares/auth.middleware.js', () => ({
    hybridAuth: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/validate.middleware.js', () => ({
    validate: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/user.validation.middleware.js', () => ({
    validateUser: (req, res, next) => next(),
}));

jest.mock('../src/middlewares/common.middleware.js', () => ({
    validateMongoIdParam: (req, res, next) => next(),
}));

jest.mock('../src/controllers/user.controller.js', () => ({
    getAllUsers: (req, res) =>
        res.status(200).json([{ _id: 'user123', firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com' }]),
    getUserById: (req, res) =>
        res.status(200).json({ _id: req.params.id, firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com' }),
    postUser: (req, res) => res.status(201).json({ created: true }),
    updateUser: (req, res) => res.status(200).json({ updated: true }),
    deleteUser: (req, res) => res.status(200).json({ deleted: true }),
}));

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('User Routes', () => {
    test('GET /api/users', async () => {
        const res = await request(app).get('/api/users');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/users/:id', async () => {
        const res = await request(app).get('/api/users/user123');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('_id', 'user123');
    });
});
