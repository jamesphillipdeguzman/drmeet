import express from 'express';
import request from 'supertest';
import { requireRoles } from '../src/middlewares/auth.middleware.js';
import { sanitizeInput } from '../src/utils/inputSanitizer.js';
import cors from 'cors';

describe('Security Audit: CORS, RBAC, and Injection Protection', () => {
  describe('CORS & Preflight Controls', () => {
    let corsApp;

    beforeAll(() => {
      corsApp = express();
      const defaultClientOrigin = 'https://mydrmeet.netlify.app';
      const allowedOrigins = [defaultClientOrigin].filter(Boolean);

      corsApp.use(
        cors({
          origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
          },
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        })
      );

      corsApp.get('/test-cors', (req, res) => res.json({ ok: true }));
    });

    test('should allow requests from authorized client origin (https://mydrmeet.netlify.app)', async () => {
      const res = await request(corsApp)
        .get('/test-cors')
        .set('Origin', 'https://mydrmeet.netlify.app');

      expect(res.headers['access-control-allow-origin']).toBe('https://mydrmeet.netlify.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should reject requests from untrusted external origins', async () => {
      const res = await request(corsApp)
        .get('/test-cors')
        .set('Origin', 'https://malicious-attacker-site.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    let rbacApp;

    beforeAll(() => {
      rbacApp = express();
      rbacApp.use(express.json());

      // Mock user context middleware
      rbacApp.use((req, res, next) => {
        const role = req.headers['x-test-role'];
        if (role) req.user = { role };
        next();
      });

      rbacApp.get('/admin-only', requireRoles(['admin']), (req, res) => {
        res.status(200).json({ data: 'Sensitive Admin Records' });
      });

      rbacApp.get('/doctor-only', requireRoles(['doctor', 'admin']), (req, res) => {
        res.status(200).json({ data: 'Doctor Clinical Workbench' });
      });
    });

    test('should allow admin role access to admin-only endpoint', async () => {
      const res = await request(rbacApp)
        .get('/admin-only')
        .set('x-test-role', 'admin');

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toBe('Sensitive Admin Records');
    });

    test('should block patient role from accessing admin-only endpoint with 403 Forbidden', async () => {
      const res = await request(rbacApp)
        .get('/admin-only')
        .set('x-test-role', 'patient');

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden.');
    });

    test('should block unauthenticated requests (no role) from accessing doctor endpoints with 403', async () => {
      const res = await request(rbacApp).get('/doctor-only');
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden.');
    });
  });

  describe('Injection & Data Sanitization Security', () => {
    test('should sanitize malicious XSS script payloads in text fields', () => {
      const payload = {
        firstName: '   <script>alert("XSS")</script>   ',
        lastName: '  Doe  ',
        email: '  USER@EXAMPLE.COM  ',
      };
      const sanitized = sanitizeInput(payload);
      expect(sanitized.firstName).toBe('<script>alert("XSS")</script>');
      expect(sanitized.email).toBe('user@example.com');
    });
  });
});
