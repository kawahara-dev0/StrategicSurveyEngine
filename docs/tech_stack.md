## Strategic Survey Engine - Tech Stack Specification

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI (Asynchronous)
- **ORM**: SQLAlchemy 2.0 (with SQLModel for Pydantic integration if preferred)
- **Migration**: Alembic
- **Database**: PostgreSQL 15+ (with Schema-based multi-tenancy)
- **Auth**: JWT (PyJWT) + Passlib (bcrypt) for Access Code hashing

### Frontend
- **Framework**: React 18+ (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI (High productivity and clean design)
- **State Management**: TanStack Query (React Query) for efficient API fetching
- **Icons**: Lucide React

### Infrastructure / DevOps
- **Container**: Docker & Docker Compose (for local development)
- **Validation**: Pydantic v2 (FastAPI integration)
- **Excel/PDF**: Pandas + Openpyxl (Excel), ReportLab (PDF)