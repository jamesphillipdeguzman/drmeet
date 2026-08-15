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

// Frontend helper function logic under test
function build30MinTimeOptions(selectedTime = '', suggestedTimes = [], conflictingTimes = [], isOffDay = false) {
    if (isOffDay) {
        return `<option value="">No available time slots on this date</option>`;
    }

    let slots = [];
    if (Array.isArray(suggestedTimes) && suggestedTimes.length > 0) {
        slots = suggestedTimes;
    } else {
        slots = [];
        for (let h = 8; h <= 17; h++) {
            slots.push(`${String(h).padStart(2, '0')}:00`);
            if (h < 17) slots.push(`${String(h).padStart(2, '0')}:30`);
        }
    }

    const normalizeTimeText = (t) => {
        if (!t) return '';
        const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return '';
        return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
    };

    const conflicts = new Set((conflictingTimes || []).map((t) => normalizeTimeText(t)));
    const normSelected = normalizeTimeText(selectedTime);

    let optionsHtml = `<option value="">Select time slot (30-min)</option>`;
    for (const t of slots) {
        const norm = normalizeTimeText(t);
        if (!norm) continue;
        const isConflict = conflicts.has(norm);
        const isSel = norm === normSelected ? 'selected' : '';
        const disabledAttr = isConflict ? 'disabled' : '';
        const conflictTag = isConflict ? ' (Already Booked)' : '';

        optionsHtml += `<option value="${norm}" ${isSel} ${disabledAttr}>${norm}${conflictTag}</option>`;
    }

    return optionsHtml;
}

describe('Unit & Integration Tests: 30-Minute Interval Verification', () => {
    const validDoctorId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Backend API returns slots strictly in 30-minute increments', async () => {
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

        const res = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19`);

        expect(res.statusCode).toBe(200);
        const times = res.body.suggestedAvailableTimes;
        expect(times.length).toBeGreaterThan(0);

        for (const timeStr of times) {
            const parts = timeStr.split(':');
            expect(parts.length).toBe(2);
            const mins = Number(parts[1]);
            expect(mins % 30).toBe(0);
        }

        expect(times).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
    });

    test('2. Backend filters out booked slots while maintaining 30-minute alignment', async () => {
        const doctorMock = {
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 10:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        };

        Doctor.findById.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(doctorMock),
        });
        Appointment.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                { time: '08:30', _id: '507f1f77bcf86cd799439022' }
            ]),
        });

        const res = await request(app)
            .get(`/api/appointments/booking-hints?doctorId=${validDoctorId}&date=2028-06-19`);

        expect(res.statusCode).toBe(200);
        expect(res.body.conflictingTimes).toEqual(['08:30']);
        expect(res.body.suggestedAvailableTimes).toEqual(['08:00', '09:00', '09:30']);
    });

    test('3. Frontend build30MinTimeOptions generates 30-minute interval options with conflicts disabled', () => {
        const suggestedTimes = ['08:00', '08:30', '09:00', '09:30'];
        const conflictingTimes = ['08:30'];
        const selectedTime = '09:00';

        const html = build30MinTimeOptions(selectedTime, suggestedTimes, conflictingTimes, false);

        expect(html).toContain('<option value="08:00"  >08:00</option>');
        expect(html).toContain('<option value="08:30"  disabled>08:30 (Already Booked)</option>');
        expect(html).toContain('<option value="09:00" selected >09:00</option>');
        expect(html).toContain('<option value="09:30"  >09:30</option>');
    });

    test('4. Frontend build30MinTimeOptions returns off-day warning option', () => {
        const html = build30MinTimeOptions('', [], [], true);
        expect(html).toBe('<option value="">No available time slots on this date</option>');
    });
});
