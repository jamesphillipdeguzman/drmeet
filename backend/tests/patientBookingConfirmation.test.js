import request from 'supertest';
import express from 'express';
import appointmentRoutes from '../src/routes/appointment.routes.js';
import Doctor from '../src/models/doctor.model.js';
import Patient from '../src/models/patient.model.js';
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

jest.mock('../src/services/appointment.service.js', () => ({
    createAppointment: jest.fn(),
}));

import { createAppointment } from '../src/services/appointment.service.js';

jest.mock('../src/models/doctor.model.js');
jest.mock('../src/models/patient.model.js');
jest.mock('../src/models/appointment.model.js');

const app = express();
app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

// Simulate frontend patient booking submit workflow
async function simulatePatientBookingSubmission({
    doctorId,
    date,
    time,
    notes,
    confirmOutcome = true,
    apiRequestFn,
}) {
    const doctorName = 'Dr. Sarah Connor';
    const dateDisplay = date;
    const timeDisplay = time;

    const confirmMessage = `Please confirm your appointment details:\n\n` +
        `• Doctor: ${doctorName}\n` +
        `• Date: ${dateDisplay}\n` +
        `• Time: ${timeDisplay}\n` +
        (notes ? `• Notes: ${notes}\n\n` : `\n`) +
        `Are these details correct? Click OK to confirm your booking.`;

    const isConfirmed = confirmOutcome;
    if (!isConfirmed) {
        return { cancelled: true, res: null, confirmPromptText: confirmMessage };
    }

    const res = await apiRequestFn('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
            doctor: doctorId,
            date,
            time,
            notes,
            status: 'confirmed',
        },
    });

    return { cancelled: false, res, confirmPromptText: confirmMessage };
}

describe('Patient Booking Confirmation Prompt & Submission Tests', () => {
    const validDoctorId = '507f1f77bcf86cd799439011';
    const validPatientId = '507f1f77bcf86cd799439022';
    const validUserId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Cancelling confirmation prompt aborts API submission', async () => {
        const apiMock = jest.fn();

        const outcome = await simulatePatientBookingSubmission({
            doctorId: validDoctorId,
            date: '2028-06-19',
            time: '09:00',
            notes: 'Routine checkup',
            confirmOutcome: false, // User clicks Cancel on prompt
            apiRequestFn: apiMock,
        });

        expect(outcome.cancelled).toBe(true);
        expect(outcome.confirmPromptText).toContain('Dr. Sarah Connor');
        expect(outcome.confirmPromptText).toContain('2028-06-19');
        expect(outcome.confirmPromptText).toContain('09:00');
        expect(apiMock).not.toHaveBeenCalled();
    });

    test('2. Accepting confirmation prompt submits appointment with status "confirmed"', async () => {
        Patient.findOne.mockResolvedValue({ _id: validPatientId, userId: validUserId });
        Patient.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ careTeamDoctorIds: [] }),
        });

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

        const createdMock = {
            _id: '507f1f77bcf86cd799439099',
            doctor: validDoctorId,
            patient: validPatientId,
            date: '2028-06-19',
            time: '09:00',
            status: 'confirmed',
            notes: 'Routine checkup',
        };

        createAppointment.mockResolvedValue(createdMock);

        const outcome = await simulatePatientBookingSubmission({
            doctorId: validDoctorId,
            date: '2028-06-19',
            time: '09:00',
            notes: 'Routine checkup',
            confirmOutcome: true, // User clicks OK on prompt
            apiRequestFn: async (url, opts) => {
                const res = await request(app).post(url).send(opts.body);
                return res;
            },
        });

        expect(outcome.cancelled).toBe(false);
        expect(outcome.res.statusCode).toBe(201);
        expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
            doctor: validDoctorId,
            date: '2028-06-19',
            time: '09:00',
            status: 'confirmed',
        }));
    });

    test('3. Backend POST /api/appointments creates appointment with status confirmed when requested', async () => {
        Patient.findOne.mockResolvedValue({ _id: validPatientId, userId: validUserId });
        Patient.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ careTeamDoctorIds: [] }),
        });

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

        createAppointment.mockImplementation(async (data) => ({
            _id: '507f1f77bcf86cd799439077',
            ...data,
        }));

        const res = await request(app)
            .post('/api/appointments')
            .send({
                doctor: validDoctorId,
                date: '2028-06-19',
                time: '10:00',
                notes: 'Follow-up consultation',
                status: 'confirmed',
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.status).toBe('confirmed');
    });
});
