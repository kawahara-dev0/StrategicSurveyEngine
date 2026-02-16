# Strategic Survey Engine - UI Design Specification

## 1. User Flow Overview
To improve data quality and prevent duplicate submissions, users are guided through a "Search-First" flow.

**Search/Browse Opinions** -> **(If duplicate exists) Upvote with Comment** -> **(If unique) New Submission**

---

## 2. Screen Definitions

### 2.1 Public: List & Search View (`/survey/[uuid]/results`)
* **Purpose**: Encourage users to read existing opinions before posting and reduce duplicate submissions.
* **Key Features**:
    - **Keyword Search Bar**: Real-time filtering of `published_opinions`.
        - **Optimization**: If search results are 0, display a prominent **"Your opinion is unique! Post it here"** button to encourage new, high-quality feedback.
    - **Opinion Cards**:
        - Displays **Title**, **Category**, **Content**, and **Upvote Count**.
        - **[Additional Comments]**: If an opinion has upvotes with moderated comments (`published_comment`), display them directly under the main content, prefixed with `[Additional Comment]`. This ensures the evolution of the idea is visible to all users.
    - **"No similar opinion found? Post your own" Button**: A secondary call-to-action that links to the Submission Screen.

### 2.2 Public: Upvote Modal
* **Purpose**: Capture support and high-value supplemental feedback.
* **Key Features**:
    - **Comment Field (Optional)**: For adding context or specific examples to the existing opinion.
    - **PII Section (Optional)**: Fields for Dept, Name, and Email.
    - **Disclosure Agreement**: A checkbox to agree to share PII for performance evaluation or hearings.

### 2.3 Public: New Submission Screen (`/survey/[uuid]/post`)
* **Purpose**: Collect unique, high-quality feedback.
* **Key Features**:
    - **Dynamic Form**: Questions generated based on the `questions` table.
    - **PII Section & Agreement**: Similar to the Upvote Modal, allowing users to be identified for evaluation.

### 2.4 Manager Dashboard (`/manager/[uuid]`)
* **Purpose**: For Client HR to analyze feedback and identify key contributors.
* **Access**: Restricted by Survey UUID + Access Code.
* **Key Features**:
    - **Enhanced Opinion List**: Includes `priority_score` and all `upvotes` with supplemental comments.
    - **PII Viewer**: Displays identity for both original posters and upvoters who agreed to disclosure.
    - **Export Tools**: Buttons to generate **Excel (.xlsx)** or **PDF** reports of the current filtered view.

### 2.5 Super Admin Dashboard (`/admin`)
* **Purpose**: Global system management and moderation.
* **Access**: Restricted by Master Admin Password.
* **Key Features**:
    - **Moderation Workspace**: Review `raw_answers`, calculate `priority_score`, rewrite for anonymity, and publish.
    - **Survey Provisioning**: UI to input client name and auto-generate Schema, UUID, and Access Code.
    - **Cleanup Monitor**: View surveys scheduled for deletion (90-day rule) with an option to halt if a contract is renewed.

---

## 3. UI/UX Requirements
- **Responsive Design**: All public-facing screens must be mobile-friendly.
- **Anonymity First**: Ensure PII is visually distinguished so Managers know who is "Evaluating-ready" vs "Anonymous".

---

## 4. Priority Score Logic (14-Point Scale)
Each opinion is evaluated by the Admin on 4 criteria:
1. **Importance** (0-2 pts) x2 weight
2. **Urgency** (0-2 pts) x2 weight
3. **Expected Impact** (0-2 pts) x2 weight
4. **Number of Supporters** (0-2 pts) x1 weight
   - *Total Score Calculation: (Imp+Urg+Exp)*2 + (Supporters)*

### Score Visualization:
- **12-14**: ★★★★★ (Immediate action recommended)
- **9-11**: ★★★★☆ (Consider including in improvement plan)
- **6-8**: ★★★☆☆ (Worth monitoring for future action)
- **3-5**: ★★☆☆☆ (Low priority)
- **0-2**: ★☆☆☆☆ (Currently not needed / archived)
