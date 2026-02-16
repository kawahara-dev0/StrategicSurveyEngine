# Strategic Survey Engine - System & Database Design Specification

## 1. Architecture: Multi-Tenancy via Schema Isolation
This system implements a **Schema-per-Survey** architecture in PostgreSQL to ensure maximum data isolation and psychological safety.

- **Public Schema**: Contains shared metadata and survey lifecycle management.
- **Tenant Schemas (`survey_[id]`)**: Each survey project has its own dedicated schema. This physically isolates raw feedback and PII from other survey projects.

---

## 2. Database Schema Definition

### 2.1 Public Schema (Global Management)

#### `surveys` table
| Column | Type | Description |
| :--- | :--- | :--- |
| id | UUID (PK) | Unique identifier for the survey project. |
| name | String | Name of the survey. |
| schema_name | String (Unique) | The physical PG schema name (e.g., survey_a_123). |
| status | Enum | active, suspended, deleted. |
| contract_end_date | Date | End of the 30-day billing cycle. |
| deletion_due_date | Date | contract_end_date + 90 days (Hard deletion trigger). |

---

### 2.2 Tenant Schema (Per Survey Isolation)
The following tables are dynamically created within each survey-specific schema.

#### `questions` (Dynamic Form Definition)
| Column | Type | Description |
| :--- | :--- | :--- |
| id | Int (PK) | |
| survey_id | UUID (FK) | Reference to public.surveys.id. |
| label | String | Question text (e.g., "Name (Optional)", "Improvement Idea"). |
| question_type | Enum | text, textarea, select, radio. |
| options | JSONB (Null) | List of choices for select/radio (e.g., ["IT", "HR", "Sales"]). |
| is_required | Boolean | If True, this field must be filled by the contributor. |
| is_personal_data | Boolean | True for Dept, Name, Email fields. |

#### `raw_responses`
| Column | Type | Description |
| :--- | :--- | :--- |
| id | UUID (PK) | Unique ID for each submission. |
| submitted_at | Timestamp | |

#### `raw_answers` (User Submissions)
| Column | Type | Description |
| :--- | :--- | :--- |
| id | Int (PK) | |
| response_id | UUID (FK) | Reference to raw_responses.id. |
| question_id | Int (FK) | Reference to questions.id. |
| answer_text | Text | The original input from the contributor. |
| is_disclosure_agreed | Boolean | If True, PII will be disclosed to the client for evaluation. |

#### `published_opinions` (Moderated Content)
| Column | Type | Description |
| :--- | :--- | :--- |
| id | Int (PK) | |
| raw_response_id | UUID (FK) | For Moderator traceability back to raw data. |
| title | String | Anonymized summary title created by Moderator. |
| content | Text | Refined and filtered content by Moderator. |
| priority_score | Int | 0-14 calculated score. |
| disclosed_pii | JSONB (Null) | Stores {name, dept, email} ONLY if is_disclosure_agreed was TRUE. |

#### `upvotes` (Tenant Schema)
| Column | Type | Description |
| :--- | :--- | :--- |
| id | Int (PK) | |
| opinion_id | Int (FK) | Reference to `published_opinions.id`. |
| user_hash | String | SHA-256 hash of User-Agent + IP to prevent duplicate votes. |
| raw_comment | Text (Null) | Original supplemental feedback from the user. |
| published_comment | Text (Null) | Refined/Moderated version of the comment for public view. |
| status | Enum | `pending`, `published`, `rejected`. |
| is_disclosure_agreed | Boolean | If True, PII will be disclosed to the client for evaluation. |
| disclosed_pii | JSONB (Null) | Stores {name, dept, email} ONLY if is_disclosure_agreed was TRUE. |
| created_at | Timestamp | |

### 2.3 Optimization
- **Search Optimization**: Apply **GIN index (Generalized Inverted Index)** to `published_opinions.title` and `published_opinions.content` to support efficient keyword-based Full Text Search (FTS).

---

## 3. Business Logic & Lifecycle

### 3.1 PII & Evaluation
- If `is_disclosure_agreed` is TRUE: The Moderator links the contributor's PII to the `published_opinions`. This data is used by the client for direct hearings and performance evaluations.
- Security: `disclosed_pii` must be excluded from public API responses. Only Moderator/Admin can access this field.

### 3.2 Automated Lifecycle (30/90 Day Rule)
- **Active (30 Days)**: Normal operations.
- **Suspended (Post 30 Days)**: Contract expired. Block new submissions (`INSERT` to `raw_responses`).
- **Deleted (Post 90 Days of Suspension)**: Execute `DROP SCHEMA [schema_name] CASCADE;`.

---

## 4. Implementation Guidance for Cursor
1. Use **FastAPI** and **SQLAlchemy**.
2. Implement a middleware to switch the PostgreSQL `search_path` based on the survey ID in the request header.
3. Ensure PII fields are protected via Pydantic schemas (use `exclude=True` for public models).
4. Use **Alembic** to manage migrations across multiple schemas.

---

### 5.1 Access Tiers
1. **Public Contributor (End-User)**:
   - **Access Method**: Access via `https://domain.com/survey/[survey_uuid]`.
   - **Security**: The UUID itself acts as the authorization to submit responses. No password required.
2. **Survey Manager (Client HR)**:
   - **Access Method**: Access via `https://domain.com/manager/[survey_uuid]`.
   - **Security**: Requires both the **Survey UUID** and a specific **Access Code** (Password).
   - **Session**: Upon successful validation, a JWT containing `survey_id` and `schema_name` is issued.
3. **Super Admin**:
   - **Access Method**: Access via `https://domain.com/admin`.
   - **Security**: Requires a Master Admin Password.

### 5.2 Schema Switching Mechanism
- For every request to `/survey/` or `/manager/`, the backend identifies the target `schema_name` from the `public.surveys` table using the `survey_uuid`.
- The Middleware executes `SET search_path TO [schema_name]` before processing any database operations.