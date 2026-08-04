import { body, validationResult } from 'express-validator';

export const validateAppointment = [
    body('doctor')
        .custom((value, { req }) => {
            if (req.method === 'PUT' || req.method === 'PATCH') return true;
            if (!value) throw new Error('Doctor ID is required.');
            return true;
        }),
    body('patient')
        .optional()
        .custom((value, { req }) => {
            const role = String(req.user?.role || '').toLowerCase();
            if (role === 'patient') return true;
            if (req.method === 'PUT' || req.method === 'PATCH') return true;
            if (!value) throw new Error('Patient ID is required.');
            return true;
        }),
    body('date')
        .custom((value, { req }) => {
            if (req.method === 'PUT' || req.method === 'PATCH') return true;
            if (!value) throw new Error('Appointment date is required.');
            return true;
        }),
    body('time')
        .custom((value, { req }) => {
            if (req.method === 'PUT' || req.method === 'PATCH') return true;
            if (!value) throw new Error('Appointment time is required.');
            return true;
        }),
    body('notes').optional().isString().trim(),
    body('status')
        .optional()
        .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
        .withMessage('Status must be pending, confirmed, cancelled or completed'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];
