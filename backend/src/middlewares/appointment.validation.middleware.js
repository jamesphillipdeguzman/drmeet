import { body, validationResult } from 'express-validator';

export const validateAppointment = [
    body('doctor')
        .notEmpty()
        .withMessage('Doctor ID is required.'),
    body('patient')
        .optional()
        .custom((value, { req }) => {
            const role = String(req.user?.role || '').toLowerCase();
            // Patient bookings derive patient id from authenticated profile in controller.
            if (role === 'patient') return true;
            if (!value) throw new Error('Patient ID is required.');
            return true;
        }),
    body('date')
        .notEmpty()
        .withMessage('Appointment date is required.'),
    body('time')
        .notEmpty()
        .withMessage('Appointment time is required.'),
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
