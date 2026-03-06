# Requirements Document

## Introduction

The Strategic Survey Engine is a multi-tenant feedback collection platform. Admins create surveys with dynamic question definitions. Contributors submit opinions anonymously via a "Search-First" flow: browse existing opinions, upvote if similar, or post new if unique. Moderators review raw submissions, create published opinions with priority scores, and approve upvote comments. Managers access a dashboard with PII (for consented users), priority scores, and export to Excel/PDF.

## Requirements

### Requirement 1: Survey Provisioning and Admin

**Objective:** As an admin, I want to create and manage surveys with per-survey isolation, so that each client project has its own data and access controls.

#### Acceptance Criteria

1. WHEN an admin creates a new survey THEN the system SHALL generate a unique UUID, Access Code, and create an isolated PostgreSQL schema for that survey
2. IF a survey is created THEN the system SHALL create tenant tables (questions, raw_responses, raw_answers, published_opinions, upvotes) within the survey schema
3. WHEN an admin lists surveys THEN the system SHALL return all surveys from the public registry with status, contract dates, and access code (if stored)
4. WHEN an admin deletes a survey THEN the system SHALL drop the tenant schema and remove the survey from the public registry
5. WHERE admin operations are performed THE system SHALL require Admin API Key (X-Admin-API-Key) or password verification against the same secret
6. IF ADMIN_API_KEY is not configured THEN the system SHALL allow all admin requests (dev mode)

### Requirement 2: Dynamic Question Definition

**Objective:** As an admin, I want to define survey questions dynamically, so that each survey can have custom form fields with validation and PII tagging.

#### Acceptance Criteria

1. WHEN an admin adds a question THEN the system SHALL support types: text, textarea, select, radio
2. IF question type is select or radio THEN the system SHALL store options as JSONB (e.g., ["IT", "HR", "Sales"])
3. WHEN a question is marked is_required THEN contributors SHALL be required to fill it before submission
4. WHEN a question is marked is_personal_data THEN the system SHALL treat answers as PII and apply disclosure consent logic
5. WHEN an admin deletes a question THEN the system SHALL cascade delete associated raw_answers

### Requirement 3: Schema-Switching and Multi-Tenancy

**Objective:** As the system, I want to route database operations to the correct tenant schema based on the survey UUID, so that data is physically isolated per survey.

#### Acceptance Criteria

1. WHEN a request includes a survey UUID (path or X-Survey-UUID header) THEN the system SHALL resolve schema_name from public.surveys and set request.state.survey_schema_name
2. WHEN get_db yields a session THEN the system SHALL execute SET search_path TO {schema_name} if survey_schema_name is set
3. WHERE search_path is set THE system SHALL use NullPool so each request has a clean connection and correct schema context
4. IF the survey UUID is invalid or not found THEN the system SHALL return 404

### Requirement 4: Contributor Submission

**Objective:** As a contributor, I want to submit responses to a survey without authentication, so that participation is frictionless while preserving anonymity options.

#### Acceptance Criteria

1. WHEN a contributor requests survey questions THEN the system SHALL return survey name, status, and all questions (label, type, options, is_required, is_personal_data)
2. IF survey status is not 'active' THEN the system SHALL block new submissions (POST submit)
3. WHEN a contributor submits a response THEN the system SHALL create raw_responses and raw_answers in the tenant schema
4. WHERE an answer is for a PII question and the contributor agrees to disclose THEN the system SHALL set is_disclosure_agreed for that answer
5. WHEN a response is submitted THEN the system SHALL generate a UUID for the response and store submitted_at
6. IF required questions are missing THEN the system SHALL return 422 with validation errors

### Requirement 5: Search-First Public View and Upvoting

**Objective:** As a contributor, I want to search existing opinions and upvote or add comments before posting new ones, so that duplicates are reduced and ideas evolve.

#### Acceptance Criteria

1. WHEN a contributor requests opinions (with or without search query) THEN the system SHALL return published opinions with title, content, priority_score, and supporter count
2. IF a search query is provided THEN the system SHALL use full-text search (GIN index on title+content) to filter opinions
3. WHEN a contributor upvotes an opinion THEN the system SHALL create an upvote with user_hash (SHA-256 of User-Agent+IP) to prevent duplicate votes
4. IF a contributor adds a comment when upvoting THEN the system SHALL store raw_comment with status 'pending' for moderator review
5. WHEN displaying opinions with upvotes THEN the system SHALL include published_comment for upvotes with status 'published'
6. WHERE opinions are displayed THE system SHALL exclude disclosed_pii from public API responses

### Requirement 6: Moderation and Published Opinions

**Objective:** As a moderator, I want to review raw submissions, create published opinions with priority scores, and moderate upvote comments, so that high-quality feedback reaches managers.

#### Acceptance Criteria

1. WHEN a moderator lists raw responses THEN the system SHALL return all submissions for the survey with submitted_at and answer count
2. WHEN a moderator fetches a response detail THEN the system SHALL return all answers with question labels and is_disclosure_agreed
3. WHEN a moderator creates a published opinion THEN the system SHALL compute priority_score from importance (0-2)*2 + urgency (0-2)*2 + expected_impact (0-2)*2 + supporter_points (0-2), max 14
4. IF is_disclosure_agreed is true for PII answers THEN the system SHALL store disclosed_pii (name, dept, email) in the published opinion
5. WHEN a moderator updates an opinion (title, content, score components) THEN the system SHALL recompute priority_score and persist
6. WHEN a moderator approves or rejects an upvote comment THEN the system SHALL set published_comment or status 'rejected' accordingly

### Requirement 7: Manager Dashboard and Export

**Objective:** As a manager, I want to view opinions with PII for consented users and export reports, so that I can identify contributors and act on feedback.

#### Acceptance Criteria

1. WHEN a manager authenticates with survey UUID and access code THEN the system SHALL issue a JWT containing survey_id and schema_name, valid for configurable duration (e.g., 8 hours)
2. WHEN a manager requests opinions THEN the system SHALL return full data including disclosed_pii and priority_score
3. WHEN a manager requests upvotes for an opinion THEN the system SHALL return upvotes with disclosed_pii for those who consented
4. WHEN a manager requests export THEN the system SHALL support format=xlsx (openpyxl) and format=pdf (reportlab)
5. WHERE export is requested THE system SHALL generate a report of current filtered opinions including PII columns for consented users
6. IF the access code is invalid THEN the system SHALL return 401

### Requirement 8: Survey Lifecycle

**Objective:** As the system, I want to manage survey lifecycle (active, suspended, deleted), so that contracts and data retention are enforced.

#### Acceptance Criteria

1. WHEN a survey is created THEN the system SHALL set contract_end_date (e.g., +30 days) and deletion_due_date (contract_end + 90 days)
2. IF contract_end_date has passed THEN the system SHALL block new submissions (status suspended implied by business logic)
3. WHEN a survey is deleted (manual) THEN the system SHALL execute DROP SCHEMA {schema_name} CASCADE and remove from public.surveys
4. WHERE status is used THE system SHALL support active, suspended, deleted

### Requirement 9: Frontend and UX

**Objective:** As a user, I want a responsive web interface for admin, manager, and contributor flows, so that I can complete tasks without technical knowledge.

#### Acceptance Criteria

1. WHEN an admin visits /admin THEN the system SHALL require Admin API Key (or password verification) and display survey list, create, detail, moderation views
2. WHEN a manager visits /manager/{surveyId} THEN the system SHALL require access code, then display opinions with PII and export buttons
3. WHEN a contributor visits /survey/{surveyId} THEN the system SHALL display searchable opinions and "Post your own" link
4. WHEN a contributor visits /survey/{surveyId}/post THEN the system SHALL display a dynamic form based on questions and allow submission
5. WHERE API calls are made THE frontend SHALL use TanStack Query for caching and mutation
6. IF the API returns an error THEN the frontend SHALL display a user-friendly message

### Requirement 10: CI/CD and Quality

**Objective:** As a developer, I want automated CI on push/PR to main, so that quality is maintained before merge.

#### Acceptance Criteria

1. WHEN code is pushed or a PR is opened to main THEN the system SHALL run backend job (Ruff, mypy, pytest with coverage) and frontend job (ESLint, Prettier, Jest with coverage)
2. IF any check fails THEN the workflow SHALL fail and report the error
3. WHERE dependencies exist THE system SHALL cache pip and npm for faster runs
4. WHEN backend tests run THEN the system SHALL use a PostgreSQL service and run migrations
5. WHEN tests succeed THEN the system SHALL upload coverage artifacts
