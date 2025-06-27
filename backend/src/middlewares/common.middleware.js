import { param, query } from 'express-validator';

export const validateMongoIdParam = [
    param('id').isMongoId().withMessage('Invalid ID format'),
];

export const validateEmailQuery = [
    query('email').isEmail().withMessage('Invalid email'),
];

export const logRequest = (req, res, next) => {
    console.log(`[${req.method}] ${req.originalUrl}`);
    next();
};
