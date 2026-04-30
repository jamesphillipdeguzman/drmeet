import { body, validationResult, param } from 'express-validator';

const runChecks = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

export const validatePatient = [
    body('firstName')
        .notEmpty()
        .withMessage('First name is required.'),
    body('lastName')
        .notEmpty()
        .withMessage('Last name is required.'),
    body('email')
        .isEmail()
        .withMessage('A valid email is required.'),
    body('birthdate')
        .optional({ values: 'falsy' })
        .isDate().withMessage('Invalid date of birth format'),
    body('phone')
        .optional({ values: 'falsy' })
        .matches(/^\d{10,11}$/)
        .withMessage('Phone must be 10 or 11 digits.'),
    body('address').optional().isString().trim(),
    runChecks,
];

export const validatePatientUpdate = [
    param('id').isMongoId().withMessage('Invalid Patient id'),
    body('firstName')
        .optional()
        .notEmpty()
        .withMessage('First name is required')
        .trim(),
    body('lastName')
        .optional()
        .notEmpty()
        .withMessage('Last name is required')
        .trim(),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Valid email is required')
        .trim()
        .normalizeEmail(),
    body('phone')
        .optional({ values: 'falsy' })
        .matches(/^\d{10,11}$/)
        .withMessage('Phone must be 10 or 11 digits.'),
    body('address').optional().isString().trim(),
    runChecks,
];
