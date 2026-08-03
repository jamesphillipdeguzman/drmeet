import request from 'supertest';
import express from 'express';
import organizationRoutes from '../src/routes/organization.routes.js';
import adminRoutes from '../src/routes/admin.routes.js';

// Helper for chainable Mongoose query mocks (must start with 'mock' for Jest hoisting)
function mockCreateChainableQuery(data) {
  const p = Promise.resolve(data);
  p.populate = jest.fn().mockImplementation(() => mockCreateChainableQuery(data));
  p.select = jest.fn().mockImplementation(() => mockCreateChainableQuery(data));
  p.lean = jest.fn().mockImplementation(() => mockCreateChainableQuery(data));
  return p;
}

// Mock auth middleware for testing
jest.mock('../src/middlewares/auth.middleware.js', () => ({
  hybridAuth: (req, res, next) => {
    req.user = {
      id: 'mockUser123',
      _id: 'mockUser123',
      role: 'admin',
      subscriptionPlan: 'enterprise',
      organizationId: 'mockOrg123',
    };
    next();
  },
  requireRoles: (roles) => (req, res, next) => next(),
}));

jest.mock('../src/middlewares/organization.middleware.js', () => ({
  requireEnterpriseAccess: (req, res, next) => next(),
}));

// Mock Models & Controllers behavior
jest.mock('../src/models/organization.model.js', () => {
  const mockOrg = {
    _id: 'mockOrg123',
    name: "St. Luke's Medical Center",
    slug: 'st-lukes-med',
    tier: 'enterprise',
    maxDoctorSeats: 150,
    maxRooms: 50,
    departments: [
      { name: 'Cardiology', headDoctor: null },
      { name: 'Pediatrics', headDoctor: null },
    ],
    save: jest.fn().mockResolvedValue(true),
  };
  return {
    __esModule: true,
    default: {
      findById: jest.fn().mockResolvedValue(mockOrg),
      findOne: jest.fn().mockResolvedValue(mockOrg),
      create: jest.fn().mockResolvedValue(mockOrg),
      find: jest.fn().mockImplementation(() => mockCreateChainableQuery([mockOrg])),
    },
  };
});

jest.mock('../src/models/room.model.js', () => {
  const mockRoom = {
    _id: 'mockRoom101',
    organizationId: 'mockOrg123',
    roomName: 'Room 101',
    department: 'Cardiology',
    dailyPatientCap: 30,
  };
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockImplementation(() => mockCreateChainableQuery([mockRoom])),
      countDocuments: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockRoom),
      findByIdAndDelete: jest.fn().mockResolvedValue(mockRoom),
    },
  };
});

jest.mock('../src/models/doctor.model.js', () => {
  const mockDoc = {
    _id: 'mockDoc001',
    firstName: 'Lynne',
    lastName: 'Ramos',
    title: 'Dra.',
    specialty: 'Cardiology',
    department: 'Cardiology',
    organizationId: 'mockOrg123',
    subscriptionPlan: 'enterprise',
    assignedRoom: 'mockRoom101',
    save: jest.fn().mockResolvedValue(true),
  };

  return {
    __esModule: true,
    default: {
      find: jest.fn().mockImplementation(() => mockCreateChainableQuery([mockDoc])),
      findById: jest.fn().mockResolvedValue(mockDoc),
      findOne: jest.fn().mockResolvedValue(mockDoc),
      countDocuments: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    },
  };
});

jest.mock('../src/models/user.model.js', () => {
  const mockUser = {
    _id: 'mockUser123',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@stlukes.com',
    role: 'admin',
    subscriptionPlan: 'enterprise',
    organizationId: 'mockOrg123',
    createdAt: new Date(),
  };
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockImplementation(() => mockCreateChainableQuery([mockUser])),
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockUser),
      updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    },
  };
});

jest.mock('../src/models/patient.model.js', () => {
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockImplementation(() => mockCreateChainableQuery([])),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
  };
});

const app = express();
app.use(express.json());
app.use('/api/organization', organizationRoutes);
app.use('/api/admin', adminRoutes);

describe('Enterprise Tier & Super-Admin API Endpoints', () => {
  test('GET /api/organization/tree should return populated nested hierarchy', async () => {
    const res = await request(app).get('/api/organization/tree');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', "St. Luke's Medical Center");
    expect(res.body).toHaveProperty('tier', 'enterprise');
    expect(Array.isArray(res.body.departments)).toBe(true);
    expect(res.body.departments.length).toBeGreaterThan(0);
  });

  test('GET /api/organization/my-org should return facility profile & seat counts', async () => {
    const res = await request(app).get('/api/organization/my-org');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('activeDoctors', 1);
    expect(res.body).toHaveProperty('maxDoctorSeats', 150);
  });

  test('POST /api/organization/departments should add new department', async () => {
    const res = await request(app)
      .post('/api/organization/departments')
      .send({ name: 'Neurology' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Department created successfully.');
  });

  test('POST /api/organization/rooms should create consultation room', async () => {
    const res = await request(app)
      .post('/api/organization/rooms')
      .send({ roomName: 'Room 202', department: 'Pediatrics', dailyPatientCap: 25 });
    expect(res.statusCode).toBe(201);
    expect(res.body.room).toHaveProperty('roomName', 'Room 101');
  });

  test('POST /api/organization/doctors should attach doctor', async () => {
    const res = await request(app)
      .post('/api/organization/doctors')
      .send({ doctorId: 'mockDoc001', department: 'Cardiology' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Doctor attached successfully.');
  });

  test('PATCH /api/organization/doctors/:doctorId should update doctor assignment', async () => {
    const res = await request(app)
      .patch('/api/organization/doctors/mockDoc001')
      .send({ department: 'Pediatrics', orgRole: 'department_head' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Doctor assignment updated.');
  });

  test('GET /api/admin/subscriptions-overview should return aggregated tier breakdown', async () => {
    const res = await request(app).get('/api/admin/subscriptions-overview');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('enterpriseCount');
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
