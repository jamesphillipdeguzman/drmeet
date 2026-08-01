import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

describe('Unit Tests: Authentication & JWT Utilities', () => {
  const secret = 'test_jwt_secret_key_12345';
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  describe('JWT Token Lifecycle', () => {
    test('should generate a valid signed JWT token with user payload', () => {
      const payload = {
        _id: '507f1f77bcf86cd799439011',
        email: 'doctor@drmeet.com',
        role: 'doctor',
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded._id).toBe(payload._id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    test('should reject invalid or tampered token verification', () => {
      const token = jwt.sign({ user: 'test' }, secret);
      const tamperedToken = token.slice(0, -4) + 'abcd';

      expect(() => {
        jwt.verify(tamperedToken, secret);
      }).toThrow();
    });

    test('should report TokenExpiredError when verified past expiration', (done) => {
      const token = jwt.sign({ user: 'test' }, secret, { expiresIn: '1ms' });
      setTimeout(() => {
        try {
          jwt.verify(token, secret);
          done(new Error('Should have thrown TokenExpiredError'));
        } catch (err) {
          expect(err.name).toBe('TokenExpiredError');
          done();
        }
      }, 50);
    });
  });

  describe('Password Hashing with Bcrypt', () => {
    test('should hash plain password and successfully compare match', async () => {
      const password = 'SecurePassword123!';
      const saltRounds = 10;
      const hash = await bcrypt.hash(password, saltRounds);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[ayb]\$/);

      const matches = await bcrypt.compare(password, hash);
      expect(matches).toBe(true);

      const wrongMatch = await bcrypt.compare('WrongPassword', hash);
      expect(wrongMatch).toBe(false);
    });
  });
});
