# DrMeet Frontend Refactoring Walkthrough
**Date:** July 12, 2026  
**Objective:** Deconstruct monolithic SPA architecture (`app.js`) into isolated domain modules.

---

## 🏗️ Architectural Overview
The core application orchestrator has been split from a single massive file into tightly-scoped modules located in `src/js/modules/` and `src/js/core/`. Global handlers and environmental variables are dynamically injected into these modules upon application startup to preserve the Single Page Application state without maintaining overlapping side-effects.

---

## 📦 Decoupled Modules

### 1. 🔐 Core Authentication (`src/js/core/auth.js`)
Handles all user session logic, local cache updates, and OAuth flows.
* **Key Functions:** `isLoggedIn()`, `checkAuthStatus()`, `updateSidebarAccountInfo()`, `googleLogin()`, `handleGoogleAuthMessage()`.
* **Startup Binding:** Initialized via `initAuthModule({...})` to securely pass application routing callbacks.

### 2. 💬 Real-Time Messaging Layer (`src/js/modules/messaging.js`)
Encapsulates all Socket.IO real-time event routing, chat state management, and messaging UI layers.
* **Key Functions:** `setupSocket()`, `loadConversations()`, `loadMessages()`, `sendMessage()`, `mountFloatingChatWidget()`.
* **State Management:** Isolates `dashboardState` and `dashboardSubscribers` away from global window execution.

### 3. 👥 Patient Lifecycle & Management (`src/js/modules/patients.js`)
Manages patient directory parsing, profile type filters, record document submissions, and relationship dependencies.
* **Key Functions:** `renderPatients()`, `showPatientForm()`, `sortPatientsByCreated()`, `formatPatientAddress()`.
* **Compatibility Layer:** Dynamic formatting helpers like `formatPatientDisplayName` and `formatPatientFullNameOnly` are re-exported through `app.js` to prevent regressions in downstream scheduling layouts.

### 4. 🩺 Doctor Profile & Staff Management (`src/js/modules/doctors.js`) [NEW]
Handles doctor directory searches, specialty classification, clinic registrations, receptionist management, and license verification flows.
* **Key Functions:** `renderDoctors()`, `showDoctorForm()`, `getDoctorSpecialties()`, `formatDoctorDisplayName()`, `editDoctor()`, `deleteDoctor()`.
* **Compatibility Layer:** Specialty loaders and formatters (`formatDoctorDisplayName`, `ensureDoctorSpecialtiesLoaded`, `getDoctorSpecialties`) are re-exported through `app.js` to prevent reference breaks in downstream calendar layouts.

### 5. 📅 Appointments & Calendar Scheduling (`src/js/modules/appointments.js`)
Handles the clinical billing logic, calendar grid rendering, and appointment lifecycle CRUD.
* **Key Functions:** `renderAppointments()`, `renderCalendar()`, `showAppointmentForm()`, `resolveAppointmentDoctorName()`, `buildBookingTimeGridHtml()`.
* **State Management:** Decoupled local caching for doctor overviews and billing constants.
* **Compatibility Layer:** Shared appointment status pills and date formatting helpers are now centralized, making it easier to add new views to the calendar.

### 👤 6. User Management (`src/js/modules/users.js`) [NEW]
Isolates administrative user-management CRUD utilities and directory searches from the main flow.
* **Key Functions:** `renderUsers()`, `showUserForm()`, `editUser()`, `deleteUser()`.
* **Startup Binding:** Initialized via `initUsersModule({...})` at app startup to bind core handlers.

### 🐚 7. App Bootstrap & Shell UI (`src/js/core/shell.js`) [NEW]
Orchestrates global theme bootstrapping and layout interaction handlers like sidebar toggles.
* **Key Functions:** `setupShellInteractions()`, `bootstrapTheme()`, `applyTheme()`.
* **Startup Binding:** Initialized via `initShell({...})` to secure orchestrator and logout callbacks.

---

## 🛠️ Verification & Maintenance Checkpoints
* Run a local terminal check via `git status` to ensure all structural additions map to the tracking rules.
* When executing future features (e.g., Appointments modifications), target the module lifecycle hook models implemented above instead of letting features bloat `app.js`.