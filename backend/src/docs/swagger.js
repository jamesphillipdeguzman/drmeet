import swaggerJsdoc from 'swagger-jsdoc';
// import swaggerUi from 'swagger-ui-express';
import { components } from './components.js';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'drmeet',
            version: '1.0.0',
            description:
                'A simple Appointment Booking System for small clinics, ready for frontend consumption',
        },
        servers: [
            {
                url: 'https://drmeet.onrender.com/',
            },
            {
                url: 'http://127.0.0.1:3001',
            },
        ],
        tags: [
            {
                name: 'Authentication',
                description:
                    'Google OAuth login/logout routes are not for testing, but for documentation only',
            },
            {
                name: 'Users',
                description: 'User management routes for testing',
            },
            {
                name: 'Patients',
                description: 'Patient management routes for testing',
            },
            {
                name: 'Doctors',
                description: 'Doctor management routes for testing',
            },
            {
                name: 'Appointments',
                description: 'Appointment management routes for testing',
            },
        ],
        components: components,
    },
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
