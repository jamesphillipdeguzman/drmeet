import express from 'express';
import request from 'supertest';
import checkoutRoutes from '../src/routes/checkout.routes.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (!req.isAuthenticated) req.isAuthenticated = () => false;
  next();
});
app.use('/api/checkout', checkoutRoutes);

describe('Integration Tests: PayMongo Checkout Routes (/api/checkout)', () => {
  const secret = 'checkout_test_secret';
  let doctorToken;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    doctorToken = jwt.sign(
      { _id: 'docUser123', role: 'doctor', email: 'doctor@drmeet.com' },
      secret
    );
  });

  describe('POST /api/checkout/create-session', () => {
    test('should reject request with 401 when unauthorized', async () => {
      const res = await request(app)
        .post('/api/checkout/create-session')
        .send({ planTier: 'pro' });

      expect(res.statusCode).toBe(401);
    });

    test('should reject invalid plan tier with 400', async () => {
      const res = await request(app)
        .post('/api/checkout/create-session')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ planTier: 'super_deluxe_invalid' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should return checkout session with valid redirect URLs (#pricing) on valid plan', async () => {
      const res = await request(app)
        .post('/api/checkout/create-session')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ planTier: 'pro' });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('checkoutUrl');
      expect(res.body.successUrl).toContain('/#pricing?status=success');
      expect(res.body.cancelUrl).toContain('/#pricing?status=cancelled');
    });

    test('should support POST /api/checkout root path with valid Bearer token', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ planTier: 'pro' });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('checkout_url');
      expect(res.body.successUrl).toContain('/#pricing?status=success');
    });
  });

  describe('POST /api/checkout/webhook (PayMongo Webhook)', () => {
    test('should handle PayMongo checkout.session.completed webhook successfully', async () => {
      const res = await request(app)
        .post('/api/checkout/webhook')
        .send({
          eventType: 'checkout.session.completed',
          data: {
            doctorId: 'docUser123',
            planTier: 'pro',
          },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.processed).toBe(true);
    });
  });
});
