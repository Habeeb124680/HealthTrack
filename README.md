# HealthTrack — Frontend

**BeTechified Capstone Project — Group 2**

HealthTrack is a healthcare routine management web application that helps users create, schedule, manage, and track their health routines in one place. This repository contains the frontend application, built with React and Vite and integrated with the HealthTrack backend API.

**Live Application:** https://health-track-seven-rho.vercel.app/
**GitHub Repository:** https://github.com/Habeeb124680/HealthTrack

## 1. Tech Stack

**Frontend**
- React
- Vite
- JavaScript (ES6+)
- React Router
- HTML5
- CSS3
- Lucide React
- REST API integration
- Local Storage

**Development and Deployment Tools**
- Git
- GitHub
- VS Code
- Vercel

## 2. Getting Started

Clone the repository:

```bash
git clone https://github.com/Habeeb124680/HealthTrack.git
cd HealthTrack
npm install
npm run dev
```

The application will normally be available at `http://localhost:5173`.

## 3. Environment Variables

Create a `.env` file in the project root:

```bash
VITE_API_URL=https://health-track-api-j0m5.onrender.com/api
```

The frontend uses this value as the base URL for API requests. API communication is handled through `src/api.js`.

## 4. Frontend Architecture

```
src/
  App.jsx
  App.css
  api.js
  main.jsx
```

- **App.jsx** — contains routing, authentication, onboarding, dashboard, routine management, calendar, medications, appointments, checkups, vitals, progress, and settings.
- **App.css** — contains the application's styling, responsive design, navigation, forms, buttons, cards, and themes.
- **api.js** — provides the API abstraction layer for HTTP requests, authentication, JWT handling, routine requests, local routine logs, and error handling.

## 5. Key Features Implemented

- **User Authentication** — Register, log in, log out, maintain an authenticated session, and access protected pages.
- **Onboarding** — Multi-step introduction covering routine tracking, reminders, and HealthTrack.
- **Routine Management** — View, create, edit, delete, activate/deactivate, categorize, schedule, and track routines.
- **Default Routines** — New users are set up with *Morning Run — Exercise — Daily — 7:00 AM* and *Drink Water — Hydration — Daily — 8:00 AM*.
- **Routine Progress** — Status flow is `Pending -> Completed -> Missed -> Pending`. Logs are currently stored locally.
- **Dashboard** — Personalized greeting, today's routines, status, health shortcuts, and progress.
- **Calendar** — Visual interface for scheduled routines and health-related activities.
- **Medications** — Dedicated medication section.
- **Appointments** — Appointment management interface.
- **Checkups** — Health checkup interface.
- **Vitals** — Blood pressure, heart rate, weight, and temperature interfaces.
- **Progress** — Routine completion and adherence overview.
- **Settings** — Profile, notification preferences, email notification preferences, dark mode, and logout.

## 6. API Integration

The frontend communicates with the HealthTrack backend through REST API requests.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/users/register` | Register a new user |
| POST | `/users/login` | Authenticate a user |
| GET | `/routine/getAllRoutines` | Retrieve routines |
| GET | `/routine/getRoutineById/:id` | Retrieve a routine by ID |
| POST | `/routine/createRoutine` | Create a routine |
| PUT | `/routine/editRoutine/:id` | Update a routine |
| DELETE | `/routine/deleteRoutine/:id` | Delete a routine |

Authenticated requests use:

```
Authorization: Bearer <token>
```

## 7. Authentication Flow

```
User submits registration
        |
POST /users/register
        |
Account is created
        |
Frontend automatically logs the user in
        |
POST /users/login
        |
JWT token is returned
        |
Token is stored in localStorage
        |
Authenticated API requests
```

## 8. Routine Data Flow

```
React Component
      |
  routinesApi
      |
   api.js
      |
HealthTrack REST API
      |
    Backend
      |
   Database
      |
 API Response
      |
React Application
```

The API response is normalized by the frontend before being used by React components.

## 9. API Error Handling

The API request helper checks the HTTP response status. When the backend returns an unsuccessful response, the frontend attempts to display the backend's returned error message.

## 10. Local Storage

The frontend uses browser local storage for:

- Authentication token
- Current user information
- Routine logs
- Local application state where required

The authentication token is used for protected API requests. Routine logs are currently stored locally because the dedicated routine-log API has not been connected to the frontend.

## 11. Responsive Design

HealthTrack is designed for desktop, tablet, and mobile. Desktop uses sidebar navigation while smaller screens use a mobile-friendly navigation layout.

## 12. Light and Dark Mode

HealthTrack supports both light mode and dark mode. Users can switch themes from Settings.

## 13. Design

The interface follows the project's product design direction with purple/violet accents, rounded cards, soft backgrounds, clear status indicators, responsive layouts, and light/dark themes. Lucide React provides interface icons.

## 14. Project Structure

```
HealthTrack/
  public/
  src/
    App.jsx
    App.css
    api.js
    main.jsx
  .env
  package.json
  package-lock.json
  README.md
```

## 15. Current MVP Scope

**Implemented**
- User registration
- User login and logout
- Authentication token handling
- Onboarding
- Dashboard
- Routine CRUD
- Routine status tracking
- Routine progress tracking
- Default routine setup
- Calendar interface
- Medication interface
- Appointment interface
- Checkup interface
- Vitals interface
- Progress interface
- Settings
- Light and dark mode
- Responsive design
- REST API integration

**Future Improvements**
- Persistent routine logs
- Medication persistence
- Appointment persistence
- Checkup persistence
- Vitals persistence
- Dashboard health statistics
- Email notifications
- Push notifications
- Advanced health analytics

## 16. Scripts

```bash
npm run dev       # Start development server
npm run build     # Create production build
npm run preview   # Preview production build locally
```

## 17. Deployment

The frontend is deployed at:
https://health-track-seven-rho.vercel.app/

The application can be updated by pushing changes to the connected GitHub repository.

## 18. Repository

Frontend source code:
https://github.com/Habeeb124680/HealthTrack

## 19. Team

**BeTechified Capstone Project — Group 2**
**Project:** HealthTrack
**Development Area:** Frontend Development
**Frontend Technology:** React + Vite

## 20. Documentation Purpose

This README provides technical documentation for developers working on the HealthTrack frontend. It documents the frontend technology stack, project structure, installation and setup, environment configuration, API integration, authentication, routine management, key application features, local storage usage, development scripts, and deployment information.

The backend API is maintained separately from this frontend repository.