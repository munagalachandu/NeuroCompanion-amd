🧠 NeuroCompanion

🚀 *AI Assistive Learning Companion for Neurodiverse Students*

NeuroCompanion is an **agentic AI-powered assistive learning platform** designed to make education more accessible for students with:

* ADHD
* Dyslexia
* Reading difficulties
* Focus challenges
* Memory issues

It transforms dense study material into simplified, structured, and testable formats using a **RAG-powered + LLM-based architecture**.

Built for 💡 AMD Slingshot Hackathon — Social Good Track.

<img width="1902" height="894" alt="image" src="https://github.com/user-attachments/assets/0e3552ec-5989-4a8a-8e4d-6ddd0a1c76fc" />

# ✨ Core Idea

Instead of building "another chatbot", this system acts as an:

🧩 **Multi-Agent Learning Assistant**

Helping students to:

* Simplify content
* Stay focused
* Extract text from images
* Practice via quizzes

# 🧠 AI Architecture

The platform uses:
<img width="830" height="634" alt="image" src="https://github.com/user-attachments/assets/dbce7570-6e42-4d4f-809a-9a9b307d17cb" />

👉 **RAG (Retrieval Augmented Generation)**
👉 **LLM-based reasoning**

For:

### 📖 Simplify Mode

* Converts complex academic text → easy formats
* Paragraph / Bullets / Keywords / Summary / Steps
* Dyslexia-friendly output support

### 🧪 Quiz Mode

* Generates adaptive questions from content
* MCQ / Fill-in / True-False / Short Answers
* AI evaluates answers + gives feedback

RAG ensures:

✔ Context preservation
✔ No hallucinated simplification
✔ Content meaning remains intact


# 🧩 Agent Modules

| Agent      | Purpose                              |
| ---------- | ------------------------------------ |
| ✦ Simplify | Makes dense content readable         |
| ◎ Focus    | Pomodoro + distraction tracking      |
| ◉ Vision   | OCR → Extract text from notes/images |
| ⬡ Quiz     | Generate & evaluate questions        |

<img width="1892" height="914" alt="image" src="https://github.com/user-attachments/assets/fda24247-7165-4d66-9165-e3ff6709e3ec" />

# 🏗 Tech Stack

## 🎨 Frontend

* React
* Web Speech API (TTS)
* Browser OCR Flow
* Camera-based attention tracking

## ⚙ Backend

* FastAPI
* Python

## 🤖 AI Layer

* RAG Pipeline
* Multi-LLM Support (Groq / Google etc.)
* Modular agent architecture

# 🧬 System Design

Microservice-style modular AI:

Frontend (React)
        ↓
API Gateway (FastAPI)
        ↓
AI Agents
   ├── Simplify (RAG + LLM)
   ├── Quiz (RAG + LLM)
   ├── Focus (Behavior tracking)
   └── Vision (OCR → Pipeline)


<img width="1919" height="901" alt="image" src="https://github.com/user-attachments/assets/f617422a-33af-4aac-9bbd-4407e0315423" />
<img width="1917" height="897" alt="image" src="https://github.com/user-attachments/assets/e9c746b4-dcb8-4c22-a410-db40245b610c" />
<img width="1915" height="895" alt="image" src="https://github.com/user-attachments/assets/c6956d8b-0934-4ae4-99c8-a5a550faeb7a" />
<img width="1902" height="885" alt="image" src="https://github.com/user-attachments/assets/310048bb-50c2-41e7-b705-d1c57730fe5c" />
<img width="1919" height="887" alt="image" src="https://github.com/user-attachments/assets/daa8018f-d98b-454f-9ac9-67f73a4dbfab" />

# 🚀 How To Run

## 1️⃣ Clone Repo

git clone <your-repo-url>
cd neurocompanion
```


## 2️⃣ Backend Setup

```
cd backend
pip install -r requirements.txt
```

Create `.env`

```
OPENAI_API_KEY=your_key
GROQ_API_KEY=your_key
GOOGLE_API_KEY=your_key
```

Run backend:

```
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 3️⃣ Frontend Setup

```
cd frontend
npm install
npm run dev
```



Frontend runs on:

```
http://localhost:5173
```

Backend runs on:

```
http://localhost:8000
```


# 📡 API Endpoints

## Simplify

```
POST /simplify
```

Input:

```
{
  "text": "content",
  "mode": "bullet",
  "dyslexic_mode": true
}
```


## Quiz Generate

```
POST /quiz/generate
```


## Quiz Evaluate

```
POST /quiz/evaluate
```

---

## Vision OCR

```
POST /vision
```

# 🌍 Real World Impact

Designed for:

📚 Students with learning challenges
🧠 Neurodiverse learners
🎓 Inclusive classrooms


# 🏁 Hackathon Tag

✔ Social Good
✔ AI for Accessibility
✔ Agentic Systems


# 💡 Future Scope

* Personalized learning memory
* Emotion-aware AI
* Voice input mode
* Real-time classroom assist


# ❤️ Built to make learning fair — not harder.

