import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();
import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import doctorRoutes from './src/routes/doctor.routes.js';
import patientRoutes from './src/routes/patient.routes.js';
import appointmentRoutes from './src/routes/appointment.routes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/docs/swagger.js';
import session from 'express-session';
import passport from './src/config/passport.config.js';

console.log('ENV:', {
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  SESSION_SECRET: !!process.env.SESSION_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});
console.log('Secure cookie:', process.env.NODE_ENV === 'production');

// Initialize an express app
const app = express();

// CORS middleware
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'https://drmeeet.netflify.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Parse JSON payloads
app.use(express.json());

// Parse form payloads
app.use(express.urlencoded({ extended: true }));

// Create Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Required for HTTPS. Evaluates to true for production
      sameSite: 'none', // Required for cross-origin
      maxAge: 1000 * 60 * 60, // 1 hour
    },
    proxy: true, // Required for secure cookies behind a proxy
  }),
);

// Add debug logging
app.use((req, res, next) => {
  console.log('Request Origin:', req.headers.origin);
  console.log('Session:', req.session);
  console.log('Session ID:', req.sessionID);
  console.log('Cookies:', req.cookies);
  next();
});

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Server Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Greet the user
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <!-- Load Roboto from Google Fonts -->
        <link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Roboto', 'Segoe UI', sans-serif;
            font-size: 16px;
            line-height: 1.6;
            padding: 2rem;
            color: #333;
          }
          h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
          }
          a {
            color: #007BFF;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <h1>Welcome to DrMeet!</h1>
        <p>
          Please login at 
          <a href="https://drmeeet.netlify.app/" target="_blank">
            https://drmeeet.netlify.app
          </a>
        </p>
      </body>
    </html>
  `);
});

// Mount routes at /auth, /api/products, and /api/sales
app.use('/', authRoutes);

app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/login', authRoutes);

export { app };
