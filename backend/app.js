import './src/config/loadEnv.js';

import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import doctorRoutes from './src/routes/doctor.routes.js';
import patientRoutes from './src/routes/patient.routes.js';
import appointmentRoutes from './src/routes/appointment.routes.js';
import userRoutes from './src/routes/user.routes.js';
import messageRoutes from './src/routes/message.routes.js';
import prescriptionRoutes from './src/routes/prescription.routes.js';
import medicalHistoryRoutes from './src/routes/medicalHistory.routes.js';
import systemRoutes from './src/routes/system.routes.js';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/docs/swagger.js';

import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './src/config/passport.config.js';
import constantsRoutes from './src/routes/constants.route.js';

const app = express();
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
const defaultClientOrigin = 'https://mydrmeet.netlify.app';
const envClientOrigin = process.env.CLIENT_ORIGIN || defaultClientOrigin;
const allowedOrigins = [defaultClientOrigin, envClientOrigin].filter(Boolean);
const mongoUri = process.env.MONGO_URI;
const mongoSrv =
  typeof mongoUri === 'string' && mongoUri.trim().startsWith('mongodb+srv://');
console.log('ENV:', {
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  SESSION_SECRET: !!process.env.SESSION_SECRET,
  RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URI_SET: Boolean(mongoUri && String(mongoUri).trim()),
  MONGO_URI_USES_SRV: mongoSrv,
});
if (!mongoUri || !String(mongoUri).trim()) {
  console.warn(
    '[DrMeet] MONGO_URI is not set — set it in Render → Environment or backend/.env (mongodb+srv:// for Atlas).',
  );
}

// ========================
// CORS
// ========================
app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server / curl / same-origin requests with no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.options(/.*/, cors());

// ========================
// BODY PARSERS
// ========================
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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
          <a href="https://mydrmeet.netlify.app/" target="_blank">
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
app.use('/api/patients/constants', constantsRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medical-history', medicalHistoryRoutes);
app.use('/api/system', systemRoutes);

// ========================
export { app };
