import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import doctorRoutes from './src/routes/doctor.routes.js';
import patientRoutes from './src/routes/patient.routes.js';
import appointmentRoutes from './src/routes/appointment.routes.js';
import userRoutes from './src/routes/user.routes.js';
import messageRoutes from './src/routes/message.routes.js';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/docs/swagger.js';

import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './src/config/passport.config.js';

const app = express();
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin =
  process.env.CLIENT_ORIGIN || 'https://drmeeet.netlify.app';
const mongoUri = process.env.MONGO_URI;

console.log('ENV:', {
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  SESSION_SECRET: !!process.env.SESSION_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});

// ========================
// CORS
// ========================
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ========================
// BODY PARSERS
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// SESSION
// ========================
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'drmeet.sid',
    store: mongoUri
      ? MongoStore.create({
          mongoUrl: mongoUri,
          ttl: 60 * 60,
          autoRemove: 'native',
        })
      : undefined,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60,
    },
  }),
);

// ========================
// PASSPORT
// ========================
app.use(passport.initialize());
app.use(passport.session());

// ========================
// SWAGGER
// ========================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ========================
// HEALTH / ROOT ROUTE
// ========================
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: Roboto, sans-serif;
            padding: 2rem;
            color: #333;
          }
          a { color: #007BFF; }
        </style>
      </head>
      <body>
        <h1>Welcome to DrMeet!</h1>
        <p>
          Please login at 
          <a href="https://drmeeet.netlify.app/" target="_blank">
            DrMeet App
          </a>
        </p>
      </body>
    </html>
  `);
});

// ========================
// ROUTES (FIXED STRUCTURE)
// ========================

// 🔥 AUTH MUST BE SINGLE BASE PATH
app.use('/auth', authRoutes);

app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// ========================
export { app };