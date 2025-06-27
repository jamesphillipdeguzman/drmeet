import { body, validationResult } from 'express-validator';

export const validateDoctor = [
    body('firstName')
        .notEmpty()
        .withMessage('First name is required.'),
    body('lastName')
        .notEmpty()
        .withMessage('Last name is required.'),
    body('email')
        .isEmail()
        .withMessage('A valid email is required.'),
    body('specialization')
        .notEmpty()
        .withMessage('Specialization is required.'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];
