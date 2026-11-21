# Abhiyantra — GATE Mock Test Series Platform

<p align="center">
  <img src="public/logo.avif" alt="Abhiyantra Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Official Computer-Based Test (CBT) Examination Portal, Persistent Question Bank &amp; Custom Paper Builder</strong><br />
  <em>Developed for Abhiyantra Educational Institute</em>
</p>

---

## 🌟 Overview

**Abhiyantra GATE Mock Test Series Platform** is a full-featured, responsive web platform designed to simulate the official GATE examination environment. The platform supports JSON-driven mock test generation, a persistent SQLite-backed Question Bank with strict two-level Subject → Topic hierarchy, content-hash deduplication, and a Custom Test Paper Builder.

---

## 🚀 Key Features

### 1. Official GATE Pattern & Scoring Engine
- **MCQ (Multiple Choice Questions)**: Single correct choice with official GATE negative marking (`+1 / −⅓` or `+2 / −⅔`).
- **MSQ (Multiple Select Questions)**: One or more correct choices with checkboxes. Full marks awarded only for exact matches; no partial or negative marking.
- **NAT (Numerical Answer Type)**: Real-time numeric input with an **on-screen virtual keypad** (`0-9`, `.`, `-`, `←`, `C`). Supports exact answers or tolerance intervals (`[min, max]`). No negative marking.
- **Auto-Calculated Timer**: Total duration is computed automatically based on question count using the official GATE formula:
  $$\text{duration} = \text{round}\left(N \times \frac{10800}{65}\right)$$
  Features live countdown (`HH:MM:SS`) and pulsing alert under 5 minutes.

### 2. Persistent Question Bank Repository
- **Backend Architecture**: Node.js + Express + TypeScript + **Prisma ORM** + **SQLite**. (Configured so `DATABASE_URL` can be switched to PostgreSQL without code changes).
- **Two-Level Hierarchy**: Strict categorization into **Subject (Level 1)** and **Topic (Level 2)**.
- **Never Lose a Question**:
  - Every uploaded, pasted, or custom test is permanently saved to the database.
  - **Content-Hash Deduplication**: SHA-256 normalized hash prevents duplicate entries when uploading the same file multiple times.
  - **Soft-Delete Only**: Deletions use `isArchived` flag for safe question management with zero accidental data loss.
- **Full Question Bank Backup**: Download all questions in standard GATE JSON format anytime.

### 3. Custom Test Paper Builder
- **Manual Mode (Pick & Choose)**: Browse and filter questions by subject, topic, type, and marks. Select individual questions or bulk-select with live metrics computation.
- **Rule-Based Mode (Syllabus Mix)**: Define custom distribution rules (e.g., 5 questions from *Data Structures*, 3 from *Operating Systems*) and auto-sample from your database.
- **Direct Test Launch**: Launch synthesized custom papers directly in the CBT testing interface or export them as reusable `.json` test files.

### 4. Official Report Card & Solutions Review
- **Score Analytics**: Score / Max Marks, Percentage, Accuracy, Correct / Incorrect / Unattempted counts, Positive and Negative Marks.
- **Performance Breakdown**: Categorized table breaking down performance by Question Type (`MCQ`, `MSQ`, `NAT`), Marks (`1-Mark`, `2-Mark`), and **Subject**.
- **Interactive Question Review**: Filter by All, Correct, Incorrect, and Unattempted with expandable detailed solution explanations.
- **Print Optimization**: Clean print and PDF stylesheet formatted with the official Abhiyantra header and branding.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, React Router DOM
- **Backend API**: Express, TypeScript, tsx, CORS
- **Database & ORM**: SQLite (`dev.db`), Prisma ORM v6
- **Branding**: Official Abhiyantra Educational Institute identity & logo

---

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Initialize Database**:
   ```bash
   npx prisma db push
   npm run seed
   ```

4. **Start Backend API Server**:
   ```bash
   npm run server
   ```
   *Runs on `http://localhost:3001`*

5. **Start Frontend Development Server**:
   ```bash
   npm run dev
   ```
   *Runs on `http://localhost:5173`*

---

## 📄 JSON Schema Standard

```json
{
  "title": "Abhiyantra GATE CS — Practice Set 1",
  "defaultSubject": "Data Structures",
  "defaultTopic": "Stacks & Queues",
  "description": "Practice test covering MCQ, MSQ, and NAT formats.",
  "questions": [
    {
      "id": 1,
      "subject": "Data Structures",
      "topic": "Stacks & Queues",
      "type": "MCQ",
      "marks": 1,
      "question": "Which data structure uses LIFO ordering?",
      "options": ["Queue", "Stack", "Linked List", "Binary Tree"],
      "answer": 1,
      "solution": "A Stack follows Last In, First Out (LIFO)."
    },
    {
      "id": 2,
      "subject": "Algorithms",
      "topic": "Sorting Algorithms",
      "type": "MSQ",
      "marks": 2,
      "question": "Which of the following sorting algorithms have O(n log n) worst-case time complexity?",
      "options": ["Merge Sort", "Quick Sort", "Heap Sort", "Bubble Sort"],
      "answer": [0, 2],
      "solution": "Merge Sort and Heap Sort guarantee O(n log n) in the worst case."
    },
    {
      "id": 3,
      "subject": "Engineering Mathematics",
      "topic": "Numerical Computation",
      "type": "NAT",
      "marks": 2,
      "question": "What is the value of 15 / 4? (Round to two decimal places)",
      "answer": { "min": 3.74, "max": 3.76 },
      "solution": "15 divided by 4 equals 3.75."
    }
  ]
}
```

---

## 📜 License

&copy; 2026 **abhiyantra**. All rights reserved.
Developed for Abhiyantra Educational Institute.
