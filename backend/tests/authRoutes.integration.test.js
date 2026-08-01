import express from 'express';
import request from 'supertest';
import authRoutes from '../src/routes/auth.routes.js';
import User from '../src/models/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/user.model.js');
jest.mock('../src/services/userRoleProfileSync.service.js', () => ({
  syncRoleProfilesForUser: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/services/emailService.js', () => ({
  sendDoctorWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPatientWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (!req.isAuthenticated) req.isAuthenticated = () => false;
  next();
});
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

describe('Integration Tests: Auth Routes (/auth & /api/auth)', () => {
  const secret = 'integration_jwt_secret_test';
  let originalSecret;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login (Email/Password Login)', () => {
    test('should reject login with 400 when email or password is missing', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'test@example.com' });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing credentials');
    });

    test('should reject login with 401 for non-existent user', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    test('should reject login with 401 for invalid password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'user123',
          email: 'user@example.com',
          password: hashedPassword,
          role: 'patient',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'WrongPassword!' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    test('should authenticate successfully and return JWT token on correct credentials', async () => {
      const plainPassword = 'CorrectPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'user123',
          email: 'user@example.com',
          password: hashedPassword,
          role: 'doctor',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
        }),
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: plainPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      const decoded = jwt.verify(res.body.token, secret);
      expect(decoded._id).toBe('user123');
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.role).toBe('doctor');
    });
  });

  describe('GET /auth/status', () => {
    test('should return authenticated: false when no Authorization header or cookie is present', async () => {
      const res = await request(app).get('/auth/status');
      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    test('should return authenticated: true when valid Bearer token is provided', async () => {
      const token = jwt.sign({ _id: 'user123', email: 'user@example.com', role: 'doctor' }, secret);
      const res = await request(app)
        .get('/auth/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user._id).toBe('user123');
    });

    test('should return authenticated: false when invalid/expired token is provided', async () => {
      const res = await request(app)
        .get('/auth/status')
        .set('Authorization', 'Bearer invalid_token_123');

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });
  });
});
