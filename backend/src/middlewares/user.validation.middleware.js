import { body, validationResult, param } from 'express-validator';

const runChecks = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

export const validateUserSignup = [
    body('firstName').notEmpty().withMessage('First name is required').trim(),
    body('lastName').notEmpty().withMessage('Last name is required').trim(),
    body('email').isEmail().withMessage('Email is invalid').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').trim(),
    body('phone').optional().isString().trim(),
    body('address').optional().isString().trim(),
    body('role')
        .optional()
        .isIn(['admin', 'doctor', 'patient'])
        .withMessage('Role must be admin, doctor or patient'),
    runChecks,
];

export const validateUserUpdate = [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('firstName').optional().notEmpty().withMessage('First name is required').trim(),
    body('lastName').optional().notEmpty().withMessage('Last name is required').trim(),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Email is invalid')
        .normalizeEmail(),
    body('password').optional().notEmpty().withMessage('Password is required').trim(),
    body('role')
        .optional()
        .isIn(['admin', 'doctor', 'patient'])
        .withMessage('Role must be admin, doctor or patient'),
    body('phone').optional().isString().trim(),
    body('address').optional().isString().trim(),
    runChecks,
];
