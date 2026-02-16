# Project: Strategic Survey Engine

## Core Concept
A survey platform that ensures psychological safety through a third-party moderator (Service Provider) and dynamic form generation.

## User Flows

### 1. Configuration Flow (Admin)
- Admin defines survey questions dynamically (Title, Type, Validation, Required status).
- Supports various types: Free text, Multi-choice, etc.

### 2. Contributor Flow (User)
- Frontend generates UI components based on the dynamic question definitions.
- **Personal Fields (Name, Email, Dept)**: Input for these fields is optional.
- **Disclosure Consent**: If a user provides personal information, they can choose to "Agree to Disclose" it. If agreed, this data is shared with the client manager for performance evaluation or hearings.
- Submissions are stored as "Raw Responses" and are NOT visible to the public initially.

### 3. Moderation Flow (Moderator)
- Moderator reviews "Raw Responses" for anonymity and constructive tone.
- Moderator creates "Published Opinions" from refined content.
- Calculate "Priority Score" (14-point scale) based on Importance, Urgency, Expected Impact, and Number of Supporters.

### 4. Social & Analysis Flow
- Users can view "Published Opinions" with filtering.
- Users can "Upvote" (Support) and add comments (with optional PII disclosure).
- **Analysis Report**: Client managers can generate an Analysis Report (Excel/PDF) at any time through the dashboard.