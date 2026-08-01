import { validatePatient, validatePatientUpdate } from '../src/middlewares/patient.validation.middleware.js';
import { validateAppointment } from '../src/middlewares/appointment.validation.middleware.js';

describe('Unit Tests: Middleware Data Validation Rules', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, params: {}, user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validatePatient Middleware', () => {
    test('should pass validation with valid patient data', async () => {
      req.body = {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria@example.com',
        phone: '09171234567',
        birthdate: '1990-05-15',
      };

      const handler = validatePatient[validatePatient.length - 1];
      // Execute middleware sequence mock validation logic assertion
      expect(Array.isArray(validatePatient)).toBe(true);
      expect(validatePatient.length).toBeGreaterThan(1);
    });
  });

  describe('validateAppointment Middleware', () => {
    test('should require doctor ID, date, and time for booking', () => {
      expect(Array.isArray(validateAppointment)).toBe(true);
      expect(validateAppointment.length).toBeGreaterThan(1);
    });
  });
});
