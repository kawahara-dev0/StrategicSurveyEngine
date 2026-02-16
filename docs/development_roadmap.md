# Strategic Survey Engine - Development Roadmap

## Phase 1: Foundation & Multi-Tenant Infrastructure
**Goal**: Establish the core backend that handles dynamic schema switching and ensures data isolation.
- **Tasks**:
    - Initialize project based on `tech_stack.md` (FastAPI + SQLAlchemy 2.0).
    - Implement Public and Tenant models as defined in `db_design.md`.
    - Create the **Schema-switching Middleware** to dynamically set `search_path` using the Survey UUID.
- **Checkpoints**:
    - Verify that database operations are routed to the correct schema based on the UUID in the request.

## Phase 2: Admin Operations & Survey Provisioning
**Goal**: Automate the creation of new survey environments.
- **Tasks**:
    - Build Admin API to create new surveys (Generates UUID, Access Code, and triggers schema creation).
    - Implement dynamic question definition (`questions` table).
- **Checkpoints**:
    - Confirm that a new schema and its associated tables are automatically generated upon survey creation.

## Phase 3: Contributor Submission & PII Protection
**Goal**: Ensure raw responses are stored safely with proper PII handling.
- **Tasks**:
    - Create the Submission API for `raw_responses` and `raw_answers`.
    - Implement **PII Disclosure Consent** logic: users provide personal information optionally and must "Agree to Disclose" for it to be shared with managers.
- **Checkpoints**:
    - Validate that raw data is physically isolated within the tenant schema and PII is handled according to consent.

## Phase 4: Moderation & Priority Scoring
**Goal**: Enable the Moderator to refine data and assign strategic importance scores.
- **Tasks**:
    - Build the Moderation Workspace API to create `published_opinions`.
    - Implement the **14-point Priority Score** calculation (Importance, Urgency, Expected Impact, and Number of Supporters).
- **Checkpoints**:
    - Verify the accuracy of the priority score and the star-rating visualization logic in the manager dashboard.

## Phase 5: Search-First Public View & Social Features
**Goal**: Implement the "Search-First" flow and moderated supplemental comments.
- **Tasks**:
    - Implement the Keyword Search API using **GIN index** for performance.
    - Build the Upvote API with moderated `published_comment` support.
    - Logic to append `[Additional Comment]` to opinion cards in the UI.
- **Checkpoints**:
    - Ensure search results are accurate and the "Post your own" button appears correctly when no results exist.

## Phase 6: Manager Dashboard & On-demand Reporting
**Goal**: Provide Client HR with actionable insights and data export tools.
- **Tasks**:
    - Build the Manager Dashboard API (includes `disclosed_pii` and `priority_score`).
    - Implement **On-demand Export** for Excel (.xlsx) and PDF reports, generated at the manager's request.
- **Checkpoints**:
    - Confirm that managers can only see PII for users who consented and can successfully export reports.