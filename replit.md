# Overview

TimeFlow is a modern task management and calendar application built with React and Express. It provides a comprehensive view of tasks across different time periods (day, week, month, year) with real-time progress tracking and an intuitive interface. The application features a sidebar with progress indicators, multiple calendar views, and full CRUD operations for task management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built using React with TypeScript and follows a component-based architecture:

- **Routing**: Uses `wouter` for client-side routing with a single main calendar page
- **State Management**: React Query (`@tanstack/react-query`) for server state management and caching
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

The application uses a modern monorepo structure with shared types between client and server, located in the `/shared` directory.

## Backend Architecture

The backend is a REST API built with Express.js:

- **API Structure**: RESTful endpoints for task CRUD operations (`/api/tasks`)
- **Data Storage**: In-memory storage implementation with an interface-based design for easy database swapping
- **Validation**: Zod schemas for request validation shared between client and server
- **Development**: Hot module replacement and middleware logging for development experience

The storage layer uses an abstract interface (`IStorage`) allowing for different implementations - currently using memory storage with sample data initialization.

## Database Design

The application is configured to use PostgreSQL with Drizzle ORM:

- **Schema**: Defined in `/shared/schema.ts` with tasks and users tables
- **Tasks Table**: Includes title, description, start/end times, completion status, and priority levels
- **Users Table**: Basic user structure with username and password fields
- **Migrations**: Drizzle Kit manages schema migrations with configuration in `drizzle.config.ts`

The schema uses UUIDs for primary keys and includes proper indexing for date-based queries.

## UI/UX Architecture

The interface features multiple calendar views with consistent design patterns:

- **Time Views**: Day, week, month, and year views with different levels of detail
- **Progress Tracking**: Real-time progress indicators using custom progress rings and bars
- **Task Management**: Modal-based task creation/editing with form validation
- **Responsive Design**: Mobile-first approach with adaptive layouts

Custom UI components include progress rings, minimaps for week overview, and time-based urgency indicators.

## Development Workflow

The project uses modern development practices:

- **TypeScript**: Full type safety across frontend, backend, and shared code
- **Path Mapping**: Clean import paths using TypeScript path mapping
- **Hot Reloading**: Vite HMR for frontend and tsx for backend development
- **Code Quality**: ESLint configuration and consistent code formatting

The build process creates optimized bundles for both client and server deployment.

# External Dependencies

## Core Framework Dependencies

- **React 18**: Frontend framework with hooks and concurrent features
- **Express.js**: Node.js web framework for REST API
- **TypeScript**: Type system for enhanced development experience
- **Vite**: Build tool and development server

## Database and ORM

- **Drizzle ORM**: Type-safe SQL toolkit for database operations
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **Drizzle Kit**: Database migration and schema management tool

## UI and Styling

- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI component library for accessibility
- **shadcn/ui**: Pre-built component library built on Radix
- **Lucide React**: Icon library for consistent iconography

## Form and Validation

- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation
- **@hookform/resolvers**: Integration between React Hook Form and Zod

## State Management and Data Fetching

- **TanStack Query**: Server state management and caching
- **Wouter**: Lightweight routing library for React

## Date and Time Handling

- **date-fns**: Modern JavaScript date utility library for time calculations and formatting

## Development Tools

- **tsx**: TypeScript execution environment for Node.js
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **PostCSS**: CSS processing tool
- **Autoprefixer**: CSS vendor prefix automation