import request from 'supertest';
import express from 'express';
import appointmentRoutes from '../src/routes/appointment.routes.js';
import Doctor from '../src/models/doctor.model.js';
import Appointment from '../src/models/appointment.model.js';

jest.mock('../src/middlewares/auth.middleware.js', () => ({
    hybridAuth: (req, res, next) => {
        req.user = { _id: '507f1f77bcf86cd799439011', role: 'patient' };
        next();
    },
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

jest.mock('../src/models/doctor.model.js');
jest.mock('../src/models/appointment.model.js');

const app = express();
app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

describe('Unit Tests: Booking Hints & 30-Minute Schedule Slot Generation', () => {
    const validDoctorId = '507f1f77bcf86cd799439011';
    const futureSaturday = '2028-06-17'; // Known future Saturday

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should fetch booking hints successfully for doctor with Saturday schedule', async () => {
        const doctorMock = {
            _id: validDoctorId,
            firstName: 'Carmel',
            lastName: 'Doctor',
            availabilityText: 'Saturday 10:00 AM - 12:00 PM',
            bookingPolicy: { maxPatientsPerDay: 10 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });

        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });

        const res = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=${futureSaturday}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('suggestedAvailableTimes');
        expect(res.body).toHaveProperty('remainingSlots');
        expect(res.body).toHaveProperty('bookedCount', 0);

        const times = res.body.suggestedAvailableTimes;
        expect(Array.isArray(times)).toBe(true);
        expect(times.length).toBeGreaterThan(0);

        // Verify all generated times are 30-minute interval slots (:00 or :30)
        times.forEach((slotText) => {
            const match = slotText.match(/^(\d{2}):(00|30)$/);
            expect(match).not.toBeNull();
        });

        // Verify Dra. Carmel's 10:00 AM - 12:00 PM slots
        expect(times).toEqual(['10:00', '10:30', '11:00', '11:30']);
    });

    test('should return empty slots for doctor off-days without error', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Saturday 10:00 AM - 12:00 PM',
            bookingPolicy: { maxPatientsPerDay: 10 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });

        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });

        const futureMonday = '2028-06-19'; // Known Monday (Off day for Saturday-only doctor)
        const res = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=${futureMonday}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('suggestedAvailableTimes');
        expect(res.body.suggestedAvailableTimes).toEqual([]);
        expect(res.body.remainingSlots).toBe(0);
    });

    test('should handle missing doctorId or date query parameters gracefully with 200 OK fallback', async () => {
        const res = await request(app).get('/api/appointments/booking-hints');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('suggestedAvailableTimes', []);
        expect(res.body).toHaveProperty('hint', 'Select a valid doctor and date to view availability.');
    });
});
