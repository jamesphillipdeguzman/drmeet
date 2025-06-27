export const components = {
    schemas: {
        User: {
            type: 'object',
            required: ['firstName', 'lastName', 'email'],
            properties: {
                firstName: {
                    type: 'string',
                    description: 'First name of the user',
                },
                lastName: {
                    type: 'string',
                    description: 'Last name of the user',
                },
                email: {
                    type: 'string',
                    format: 'email',
                    description: 'Email address of the user',
                },
                password: {
                    type: 'string',
                    description: 'User password (hashed in storage)',
                },
                role: {
                    type: 'string',
                    enum: ['admin', 'user'],
                    description: 'User role for access control',
                },
                phone: {
                    type: 'string',
                    description: 'Phone number of the user',
                },
                address: {
                    type: 'string',
                    description: 'Physical address of the user',
                },
                createdAt: {
                    type: 'string',
                    format: 'date-time',
                },
                updatedAt: {
                    type: 'string',
                    format: 'date-time',
                },
            },
        },
        Patient: {
            type: 'object',
            required: ['firstName', 'lastName', 'email'],
            properties: {
                firstName: {
                    type: 'string',
                    description: 'First name of the patient',
                },
                lastName: {
                    type: 'string',
                    description: 'Last name of the patient',
                },
                email: {
                    type: 'string',
                    format: 'email',
                    description: 'Email address of the patient',
                },
                phone: {
                    type: 'string',
                    description: 'Phone number of the patient',
                },
                address: {
                    type: 'string',
                    description: 'Physical address of the patient',
                },
                dateOfBirth: {
                    type: 'string',
                    format: 'date',
                    description: 'Date of birth of the patient',
                },
                createdAt: {
                    type: 'string',
                    format: 'date-time',
                },
                updatedAt: {
                    type: 'string',
                    format: 'date-time',
                },
            },
        },
        Doctor: {
            type: 'object',
            required: ['firstName', 'lastName', 'email', 'specialization'],
            properties: {
                firstName: {
                    type: 'string',
                    description: 'First name of the doctor',
                },
                lastName: {
                    type: 'string',
                    description: 'Last name of the doctor',
                },
                email: {
                    type: 'string',
                    format: 'email',
                    description: 'Email address of the doctor',
                },
                specialization: {
                    type: 'string',
                    description: 'Medical specialization of the doctor',
                },
                phone: {
                    type: 'string',
                    description: 'Phone number of the doctor',
                },
                address: {
                    type: 'string',
                    description: 'Physical address of the doctor',
                },
                createdAt: {
                    type: 'string',
                    format: 'date-time',
                },
                updatedAt: {
                    type: 'string',
                    format: 'date-time',
                },
            },
        },
        Appointment: {
            type: 'object',
            required: ['doctor', 'patient', 'date', 'time'],
            properties: {
                doctor: {
                    type: 'string',
                    description: 'MongoDB ObjectId reference to the Doctor',
                },
                patient: {
                    type: 'string',
                    description: 'MongoDB ObjectId reference to the Patient',
                },
                date: {
                    type: 'string',
                    format: 'date',
                    description: 'Date of the appointment',
                },
                time: {
                    type: 'string',
                    description: 'Time of the appointment',
                },
                notes: {
                    type: 'string',
                    description: 'Additional notes for the appointment',
                },
                status: {
                    type: 'string',
                    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
                    description: 'Status of the appointment',
                },
                createdAt: {
                    type: 'string',
                    format: 'date-time',
                },
                updatedAt: {
                    type: 'string',
                    format: 'date-time',
                },
            },
        },

    },
    responses: {
        NotFound: {
            description: 'The specified resource was not found',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                example: 'Resource not found',
                            },
                        },
                    },
                },
            },
        },
        BadRequest: {
            description: 'Bad request',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                example: 'Invalid input data',
                            },
                            error: {
                                type: 'string',
                                example: 'Validation error details',
                            },
                        },
                    },
                },
            },
        },
        ServerError: {
            description: 'Server error',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                example: 'Internal server error',
                            },
                            error: {
                                type: 'string',
                                example: 'Error details',
                            },
                        },
                    },
                },
            },
        },
    },
    // securitySchemes: {
    //   bearerAuth: {
    //     type: 'http',
    //     scheme: 'bearer',
    //     bearerFormat: 'JWT',
    //   },
    // },
};
