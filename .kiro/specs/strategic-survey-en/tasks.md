# Implementation Plan

## Task List

- [ ] 1. Set up project foundation
- [ ] 1.1 Initialize backend structure
 - Create Python 3.11 project with pyproject.toml (requires-python >=3.11)
 - Add requirements.txt: FastAPI, Uvicorn, SQLAlchemy 2.0, asyncpg, Alembic, Pydantic, pydantic-settings, python-dotenv, PyJWT, openpyxl, reportlab
 - Add requirements-dev.txt: ruff, mypy, pytest, pytest-asyncio, pytest-cov, httpx
 - Create app/ package: main.py, config.py, database.py
 - Configure Settings (database_url, admin_api_key, jwt_secret_key, jwt_expire_minutes) from env
 - Create async engine with NullPool, AsyncSessionLocal, get_db dependency
 - _Requirements: 1.5, 3.2, 3.3_

- [ ] 1.2 Initialize frontend structure
 - Create Vite + React 18 + TypeScript project
 - Add dependencies: react-router-dom, @tanstack/react-query, lucide-react, tailwindcss
 - Add devDependencies: jest, @testing-library/react, eslint, prettier
 - Configure Vite proxy: /api -> backend
 - Create src/App.tsx with Routes, Layout, index.css
 - _Requirements: 9.5_

- [ ] 1.3 Set up Docker and database
 - Create backend Dockerfile (python:3.11-slim, libpq-dev, requirements)
 - Create frontend Dockerfile (Node 20)
 - Create docker-compose.yml: db (postgres:15-alpine), backend, frontend
 - Create .env.example with DATABASE_URL, ADMIN_API_KEY, JWT_SECRET_KEY
 - _Requirements: 10.4_

- [ ] 2. Implement public schema and migrations
- [ ] 2.1 Create public models and migration
 - Create app/models/base.py (DeclarativeBase)
 - Create app/models/public.py: Survey (id, name, schema_name, status, contract_end_date, deletion_due_date, access_code_plain, notes), SurveyStatus enum
 - Create Alembic config and 001_public_surveys migration (survey_status enum, surveys table)
 - _Requirements: 1.2, 8.1_

- [ ] 2.2 Implement schema-switching middleware
 - Create app/middleware/schema_middleware.py
 - Extract survey UUID from path (regex) or X-Survey-UUID header
 - Query public.surveys for schema_name by UUID
 - Set request.state.survey_schema_name and survey_id
 - Add SchemaSwitchingMiddleware to FastAPI app (before CORS)
 - Update get_db to SET search_path when survey_schema_name is set
 - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Implement tenant models and provisioning
- [ ] 3.1 Create tenant models
 - Create app/models/tenant.py: Question (QuestionType enum), RawResponse, RawAnswer, PublishedOpinion, Upvote (UpvoteStatus enum)
 - Define all columns per design (JSONB for options, disclosed_pii; enums for question_type, upvote_status)
 - _Requirements: 2.1, 2.2, 2.4_

- [ ] 3.2 Implement survey provisioning service
 - Create app/services/survey_provisioning.py
 - Implement _schema_name_from_uuid, _generate_access_code, _tenant_ddl_statements (CREATE TYPE, CREATE TABLE, GIN index)
 - Implement create_survey: CREATE SCHEMA, run DDL, insert Survey with contract_end_date (+30), deletion_due_date (+90)
 - Implement delete_survey: DROP SCHEMA CASCADE, delete Survey
 - _Requirements: 1.1, 1.2, 1.4, 8.1_

- [ ] 4. Build Admin API
- [ ] 4.1 Implement admin auth and survey CRUD
 - Create app/routers/admin.py with _require_admin (X-Admin-API-Key)
 - POST /verify-password (password vs admin_api_key)
 - POST /surveys, GET /surveys, GET /surveys/{id}, POST /surveys/{id}/reset-access-code, DELETE /surveys/{id}
 - Create schemas: SurveyCreate, SurveyCreateResponse, SurveyResponse
 - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [ ] 4.2 Implement question management
 - POST /surveys/{id}/questions, GET /surveys/{id}/questions, DELETE /surveys/{id}/questions/{qid}
 - Create QuestionCreate, QuestionResponse schemas
 - Use search_path from middleware (admin/surveys/{id} sets schema)
 - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ] 4.3 Implement moderation endpoints
 - GET /moderation/{id}/submissions, GET /surveys/{id}/responses/{rid}
 - POST /surveys/{id}/opinions, GET /moderation/{id}/opinions
 - PATCH /moderation/{id}/opinions/{oid}, GET /moderation/{id}/opinions/{oid}/upvotes, PATCH /moderation/{id}/upvotes/{uid}
 - Create RawResponseDetail, RawResponseListItem, PublishOpinionCreate, OpinionUpdate, UpvoteUpdate schemas
 - Implement _score_from_components for priority_score
 - Exclude disclosed_pii from public schemas; include in admin/manager
 - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 5. Build Public Survey API
- [ ] 5.1 Implement questions and submission
 - Create app/routers/survey.py
 - GET /{id}/questions: return survey name, status, questions (block if not found)
 - POST /{id}/submit: validate body (answers per question), block if status != active
 - Create raw_responses (uuid4), raw_answers with is_disclosure_agreed for PII
 - Create SubmitRequest, SubmitResponse schemas
 - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.2_

- [ ] 5.2 Implement opinions and search
 - GET /{id}/opinions: list published_opinions with supporter count
 - GET /{id}/search?q=: full-text search with to_tsvector/plainto_tsquery
 - Create PublicOpinionItem schema (no disclosed_pii)
 - _Requirements: 5.1, 5.2_

- [ ] 5.3 Implement upvoting
 - POST /{id}/opinions/{oid}/upvote: user_hash (SHA-256 User-Agent+IP), raw_comment optional
 - Deduplicate by (opinion_id, user_hash)
 - Include published_comment for status=published in opinion responses
 - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [ ] 6. Build Manager API
- [ ] 6.1 Implement manager auth
 - Create app/routers/manager.py
 - POST /auth: body survey_id, access_code; verify against Survey.access_code_plain
 - Issue JWT with survey_id, schema_name, exp (jwt_expire_minutes)
 - _Requirements: 7.1, 7.6_

- [ ] 6.2 Implement manager endpoints
 - GET /{id}/survey, GET /{id}/opinions (with disclosed_pii), GET /{id}/opinions/{oid}/upvotes
 - Require Authorization: Bearer <token>, validate JWT and survey_id match
 - _Requirements: 7.2, 7.3_

- [ ] 6.3 Implement export
 - Create app/routers/manager_export.py: build_xlsx (openpyxl), build_pdf (reportlab)
 - GET /{id}/export?format=xlsx|pdf: stream file with opinions and PII columns
 - _Requirements: 7.4, 7.5_

- [ ] 7. Build Admin frontend
- [ ] 7.1 Implement AdminGuard and API client
 - Create AdminGuard: verify password or use VITE_ADMIN_API_KEY, store key in sessionStorage
 - Create src/lib/api.ts: headers with X-Admin-API-Key, listSurveys, createSurvey, getSurvey, deleteSurvey, listQuestions, createQuestion, deleteQuestion, listResponses, getResponse, createOpinion, listOpinions, updateOpinion, listUpvotes, updateUpvote
 - Create src/types/api.ts for all API types
 - _Requirements: 9.1_

- [ ] 7.2 Implement admin pages
 - Home: landing with links
 - SurveyList: list surveys, create, delete
 - SurveyCreate: name, notes → create, show access_code once
 - SurveyDetail: questions CRUD, link to moderation, access code block
 - SurveyModeration: list responses, select → detail, create opinion form, list opinions, edit opinion, upvote moderation
 - _Requirements: 9.1_

- [ ] 8. Build Manager frontend
- [ ] 8.1 Implement ManagerDashboard
 - Access code form → POST /manager/auth → store JWT
 - List opinions with PII, priority score, star display
 - Export buttons (xlsx, pdf)
 - Logout (clear JWT)
 - _Requirements: 9.2_

- [ ] 9. Build Contributor frontend
- [ ] 9.1 Implement SurveySearch
 - GET opinions (and search), display cards with upvote count
 - Upvote modal: optional comment, PII fields, disclosure checkbox
 - Link to "Post your own" (/survey/{id}/post)
 - _Requirements: 9.3_

- [ ] 9.2 Implement SurveyPost
 - GET questions, render dynamic form (text, textarea, select, radio)
 - PII section with disclosure checkbox
 - Submit → POST submit
 - Handle status !== active
 - _Requirements: 9.4, 4.2_

- [ ] 10. Add CI/CD
- [ ] 10.1 Create GitHub Actions workflow
 - Trigger: push, pull_request to main
 - Backend job: Python 3.11, PostgreSQL service, pip cache, Ruff check/format, mypy, alembic upgrade, pytest --cov
 - Frontend job: Node LTS, npm cache, ESLint, Prettier check, Jest --coverage
 - Upload coverage artifacts
 - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 11. Backend tests
- [ ] 11.1 Create pytest fixtures and tests
 - conftest.py: AsyncClient, admin_client with X-Admin-API-Key
 - test_happy_path: create survey, add questions, submit, publish opinion, manager auth, export
 - test_edge_cases: invalid survey id, empty answers, invalid types, 404s
 - _Requirements: Validation_

- [ ] 12. Frontend tests
- [ ] 12.1 Create Jest tests
 - SurveyPost.test.tsx, SurveyList, SurveyCreate, AdminGuard, etc.
 - Mock API, test render and interactions
 - _Requirements: Validation_

## Requirements Coverage Summary

- **Requirement 1 (Survey Provisioning)**: Tasks 1.1, 3.2, 4.1
- **Requirement 2 (Questions)**: Tasks 3.1, 4.2
- **Requirement 3 (Schema Switching)**: Tasks 1.1, 2.2
- **Requirement 4 (Submission)**: Tasks 5.1, 9.2
- **Requirement 5 (Search/Upvote)**: Tasks 5.2, 5.3, 9.1
- **Requirement 6 (Moderation)**: Tasks 4.3, 7.2
- **Requirement 7 (Manager)**: Tasks 6.1, 6.2, 6.3, 8.1
- **Requirement 8 (Lifecycle)**: Tasks 2.1, 3.2, 5.1
- **Requirement 9 (Frontend)**: Tasks 7.1, 7.2, 8.1, 9.1, 9.2
- **Requirement 10 (CI)**: Task 10.1
