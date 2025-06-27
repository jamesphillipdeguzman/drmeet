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
    body('dateOfBirth')
        .notEmpty()
        .withMessage('Date of birth is required.'),
    body('phone').optional().isString().trim(),
    body('address').optional().isString().trim(),
    body('dateOfBirth').optional().isDate().withMessage('Invalid date of birth'),
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
    body('phone').optional().isString().trim(),
    body('address').optional().isString().trim(),
    runChecks,
];
