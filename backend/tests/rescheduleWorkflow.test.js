import request from 'supertest';
import express from 'express';
import appointmentRoutes from '../src/routes/appointment.routes.js';
import Doctor from '../src/models/doctor.model.js';
import Appointment from '../src/models/appointment.model.js';

jest.mock('../src/middlewares/auth.middleware.js', () => ({
    hybridAuth: (req, res, next) => {
        req.user = { _id: '507f1f77bcf86cd799439011', role: 'admin' };
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

jest.mock('../src/services/appointment.service.js', () => ({
    findAppointmentById: jest.fn(),
    updateAppointmentById: jest.fn(),
}));

import { findAppointmentById, updateAppointmentById } from '../src/services/appointment.service.js';

jest.mock('../src/models/doctor.model.js');
jest.mock('../src/models/appointment.model.js');

const app = express();
app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

describe('Integration Tests: Reschedule Data Capture & Workflow', () => {
    const validDoctorId = '507f1f77bcf86cd799439011';
    const validPatientId = '507f1f77bcf86cd799439022';
    const appointmentId = '507f1f77bcf86cd799439033';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Booking hints endpoint with excludeAppointmentId does not treat existing appointment slot as self-conflict', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 12:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });

        // Appointment.find with query excluding appointmentId
        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]), // No other appointments except the excluded one
        });

        const res = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19&excludeAppointmentId=${appointmentId}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.suggestedAvailableTimes).toContain('09:00');
        expect(res.body.conflictingTimes).toEqual([]);
    });

    test('2. PUT /api/appointments/:id successfully reschedules to a valid future time slot', async () => {
        const existingAppointment = {
            _id: appointmentId,
            doctor: validDoctorId,
            patient: validPatientId,
            date: new Date('2028-06-19T00:00:00.000Z'),
            time: '09:00',
            status: 'confirmed',
            notes: 'Original consult',
        };

        findAppointmentById.mockResolvedValue(existingAppointment);

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({
                _id: validDoctorId,
                bookingPolicy: { maxPatientsPerDay: 20 },
            }),
        });

        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });

        const updatedResult = {
            ...existingAppointment,
            time: '10:00',
            date: new Date('2028-06-19T00:00:00.000Z'),
        };

        updateAppointmentById.mockResolvedValue(updatedResult);

        const res = await request(app)
            .put(`/api/appointments/${appointmentId}`)
            .send({
                doctor: validDoctorId,
                patient: validPatientId,
                date: '2028-06-19',
                time: '10:00',
                status: 'confirmed',
                notes: 'Rescheduled consult',
            });

        expect(res.statusCode).toBe(200);
        expect(updateAppointmentById).toHaveBeenCalledWith(appointmentId, expect.objectContaining({
            time: '10:00',
            date: '2028-06-19',
        }));
    });

    test('3. Rescheduling to a time slot occupied by another appointment returns 409 conflict', async () => {
        const existingAppointment = {
            _id: appointmentId,
            doctor: validDoctorId,
            patient: validPatientId,
            date: new Date('2028-06-19T00:00:00.000Z'),
            time: '09:00',
            status: 'confirmed',
        };

        findAppointmentById.mockResolvedValue(existingAppointment);

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({
                _id: validDoctorId,
                bookingPolicy: { maxPatientsPerDay: 20 },
            }),
        });

        // Mock existing booking at 10:00 by another patient
        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                { _id: '507f1f77bcf86cd799439099', time: '10:00', patient: 'otherPatient' }
            ]),
        });

        const res = await request(app)
            .put(`/api/appointments/${appointmentId}`)
            .send({
                doctor: validDoctorId,
                patient: validPatientId,
                date: '2028-06-19',
                time: '10:00',
                status: 'confirmed',
            });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('Selected time 10:00 is already booked');
    });

    test('4. Rescheduling to a past date returns 400 bad request error', async () => {
        const existingAppointment = {
            _id: appointmentId,
            doctor: validDoctorId,
            patient: validPatientId,
            date: new Date('2028-06-19T00:00:00.000Z'),
            time: '09:00',
            status: 'confirmed',
        };

        findAppointmentById.mockResolvedValue(existingAppointment);

        const res = await request(app)
            .put(`/api/appointments/${appointmentId}`)
            .send({
                doctor: validDoctorId,
                patient: validPatientId,
                date: '2020-01-01',
                time: '09:00',
                status: 'confirmed',
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('Cannot book appointments in the past');
    });
});
