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

describe('Unit Tests: Schedule String Parser Engine', () => {
    const validDoctorId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Pipe-separated combined schedule strings with typo colons', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 11:00 | Saturday 09:00: 11:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });
        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });

        // Saturday (2028-06-17 is a Saturday)
        const resSat = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-17`);
        expect(resSat.statusCode).toBe(200);
        expect(resSat.body.suggestedAvailableTimes).toEqual(['09:00', '09:30', '10:00', '10:30']);

        // Monday (2028-06-19 is a Monday)
        const resMon = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19`);
        expect(resMon.statusCode).toBe(200);
        expect(resMon.body.suggestedAvailableTimes).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30']);
    });

    test('2. Implicit AM/PM ranges (10:00 - 2:00 -> 10:00 AM to 2:00 PM)', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 10:00 - 2:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
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
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19`);
        expect(res.statusCode).toBe(200);
        expect(res.body.suggestedAvailableTimes).toEqual([
            '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'
        ]);
    });

    test('3. Missing AM/PM labels and 12h/24h mix', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 8am - 12pm | Monday - Friday 1pm - 4pm',
            bookingPolicy: { maxPatientsPerDay: 20 },
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
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19`);
        expect(res.statusCode).toBe(200);
        expect(res.body.suggestedAvailableTimes).toContain('08:00');
        expect(res.body.suggestedAvailableTimes).toContain('11:30');
        expect(res.body.suggestedAvailableTimes).toContain('13:00');
        expect(res.body.suggestedAvailableTimes).toContain('13:30');
    });

    test('4. Multi-range split days', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 10:00 | Monday - Friday 14:00 - 16:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
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
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19`);
        expect(res.statusCode).toBe(200);
        expect(res.body.suggestedAvailableTimes).toEqual([
            '08:00', '08:30', '09:00', '09:30',
            '14:00', '14:30', '15:00', '15:30'
        ]);
    });

    test('5. Combined weekday/weekend configurations (Everyday / Mon, Wed, Fri)', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Everyday 09:00 - 11:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });
        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });

        // Sunday (2028-06-18 is a Sunday)
        const resSun = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-18`);
        expect(resSun.statusCode).toBe(200);
        expect(resSun.body.suggestedAvailableTimes).toEqual(['09:00', '09:30', '10:00', '10:30']);
    });

    test('6. Off-day queries return 0 slots and state off day', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 12:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });
        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });

        // Sunday (2028-06-18)
        const resSun = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-18`);
        expect(resSun.statusCode).toBe(200);
        expect(resSun.body.suggestedAvailableTimes).toEqual([]);
        expect(resSun.body.hint).toContain('No slots left for this day');
    });
});
