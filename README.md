# DrMeet

**DrMeet** is a modern, cloud-based healthcare management application designed to scale seamlessly from individual medical practices to large enterprise hospital networks. It empowers healthcare providers to manage appointments, room queues, clinical staff, and multi-tenant patient directories efficiently through an intuitive, secure online workspace.

## 🌐 Live Demo

- **Frontend Application:** [https://mydrmeet.netlify.app](https://mydrmeet.netlify.app)
- **Backend API:** [https://drmeet-wqws.onrender.com](https://drmeet-wqws.onrender.com)

---

## ✨ Key Features

### 🏥 Enterprise Hospital & Organizational Hierarchy
- **Interactive Hierarchy Tree View:** Top-to-bottom visual directory mapping out Hospitals → Departments → Consultation Rooms → Medical Providers.
- **Department & Specialization Categories:** Categorize clinical staff by specialty (Cardiology, Pediatrics, Orthopedics, etc.) with dedicated Department Heads.
- **Consultation Room & Daily Queue Caps:** Manage facility rooms with daily patient load caps and assign doctors dynamically.
- **Capacity Controls:** Enforce strict seat limits for enterprise contracts (default `maxDoctorSeats: 150`, `maxRooms: 50`).
- **Safe Cascading Operations:** Room and department updates gracefully manage doctor assignments without breaking staff profiles.

### 📊 Super-Admin Subscription Management
- **Subscriptions Breakdown Dashboard:** Master overview table for system administrators showing user tier distribution (Starter, Pro, Enterprise), active patient load metrics, and registration metadata.
- **Role-Based Access Control (RBAC):** Server-side route guards (`requireEnterpriseAccess`) ensuring proper authorization for facility management tools.

### 🛡️ Multi-Tenant Data Isolation
- **Tenant-Aware Querying:** Automatic query scoping by `organizationId` ensuring strict patient data isolation between medical facilities.

### 👨‍⚕️ Core Clinical Workflows
- **Doctor & Patient Management:** Full CRUD management for medical staff rosters, specialty profiles, and patient health records.
- **Appointment Scheduling:** Real-time scheduling with status tracking (`pending`, `confirmed`, `completed`).
- **Secure Authentication:** Multi-strategy authentication including Google OAuth 2.0 and JWT authorization headers.

---

## 🏗️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3, Hash Routing |
| **Backend API** | Node.js, Express.js |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Authentication** | Passport.js, Google OAuth 2.0, JSON Web Tokens (JWT) |
| **Testing** | Jest, Supertest |
| **Hosting & Deployment** | Render (Backend API), Netlify (Frontend) |

---

## 🧱 Project Structure

```text
drmeet/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Organization, Admin, Doctor, Patient, & Auth controllers
│   │   ├── middlewares/       # Enterprise route guards, JWT auth & validation
│   │   ├── models/            # Organization, Room, User, Doctor, Patient schemas
│   │   ├── routes/            # Isolated API endpoints (/api/organization, /api/admin, etc.)
│   │   └── app.js             # Express app setup & route mounting
│   └── tests/                 # Jest automated unit & integration test suites
└── frontend/
    └── src/
        ├── js/                # App views, Navigation Router, Enterprise Tree UI
        └── index.html         # Application entry point
