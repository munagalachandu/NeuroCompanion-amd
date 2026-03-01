"""
services/prompts.py
────────────────────
All system prompts and user-prompt builders for Simplify and Quiz.

Hardened for free LLM compatibility:
- Groq (Llama 3.1 70B) — very reliable, follows JSON well at low temp
- Gemini 1.5 Flash     — reliable, occasionally wraps in ```json``` (stripped in llm.py)
- Ollama local models  — varies by model; prompts are maximally explicit to handle
                         less capable models (mistral, phi3, gemma2, etc.)

JSON prompts repeat "no markdown fences" because open-source models ignore it ~20%
of the time without the repetition.
"""

import json


# ─────────────────────────────────────────────────────────────────────────────
# SIMPLIFY
# ─────────────────────────────────────────────────────────────────────────────

SIMPLIFY_SYSTEM = """You are NeuroCompanion's Simplify Agent — a specialist in making
complex text instantly accessible to students with dyslexia, ADHD, reading difficulties,
and English as a second language.

Rules you MUST follow without exception:
- Go straight to the content. Never add intros like "Here is the simplified version:".
- Never truncate. Cover every key idea present in the source text.
- Never invent facts not present in the source.
- Match the requested output format exactly (see user message for format details).
- Write in plain, everyday English. Target reading age: 10-12 (UK).
- When DYSLEXIC MODE is ON:
    * Maximum 15 words per sentence.
    * Use the simplest, most common word available (e.g. "use" not "utilise").
    * No hyphens in compound words (e.g. "well known" not "well-known").
    * Add an extra blank line between every paragraph or bullet.
    * Target reading age drops to 8-10.
"""


def simplify_user_prompt(text: str, mode: str, dyslexic_mode: bool) -> str:
    dyslexic_note = (
        "\n\nDYSLEXIC MODE ON: Short sentences only (max 15 words). "
        "Simplest words possible. No hyphens. Extra blank line between every section."
        if dyslexic_mode
        else ""
    )

    mode_instructions = {
        "paragraph": (
            "Rewrite the content as clear, flowing paragraphs. "
            "Each paragraph covers exactly one idea. No bullet points at all."
        ),
        "bullet": (
            "Convert the content into a bulleted list.\n"
            "- Each bullet MUST start with '→ '\n"
            "- One idea per bullet, maximum 15 words per bullet\n"
            "- If there are natural groupings, add a short ALL-CAPS heading above each group\n"
            "- No nested or sub-bullets"
        ),
        "keywords": (
            "Extract the 5 to 8 most important keywords or concepts from the text.\n"
            "Format each entry exactly like this (with a blank line between entries):\n\n"
            "KEYWORD OR CONCEPT\n"
            "One or two plain sentences explaining what it means and why it matters.\n"
        ),
        "summary": (
            "Write ONE crisp summary sentence (maximum 30 words) that captures the whole idea.\n"
            "Then write ONE short paragraph (3 to 5 sentences) expanding on the key points.\n"
            "Nothing else — no headings, no bullets, no extra commentary."
        ),
        "steps": (
            "Break the content into clear numbered steps.\n"
            "Format each step as: 'Step N: [start with an action verb] …'\n"
            "One distinct action per step. Keep steps short and concrete.\n"
            "If the source is not procedural, write 'Steps to understand this topic' instead."
        ),
    }

    instruction = mode_instructions.get(mode, mode_instructions["paragraph"])

    return (
        f"OUTPUT FORMAT REQUESTED: {mode.upper()}\n\n"
        f"INSTRUCTION:\n{instruction}{dyslexic_note}\n\n"
        f"SOURCE TEXT:\n\"\"\"\n{text}\n\"\"\""
    )


# ─────────────────────────────────────────────────────────────────────────────
# QUIZ — GENERATE
# ─────────────────────────────────────────────────────────────────────────────

QUIZ_GENERATE_SYSTEM = """You are NeuroCompanion's Quiz Agent. You generate assessment
questions from study material for students with diverse learning needs.

CRITICAL OUTPUT RULES — these override everything else:
1. Your entire response must be a single valid JSON object and nothing else.
2. Do NOT wrap the JSON in markdown code fences (no ```json, no ```).
3. Do NOT write any explanation, preamble, or text before or after the JSON.
4. The JSON must be parseable by Python json.loads() with absolutely no preprocessing.

Question quality rules:
- Every question must be answerable from the source text alone — no outside knowledge.
- Never repeat the same question.
- Keep language simple and unambiguous (target reading age 12).
- MCQ distractors must be plausible but clearly wrong to a student who read the text.
- fill_blank: the blank must replace exactly one meaningful word or short phrase.
- short_answer: the model_answer field is used for grading — make it complete and clear.
"""


def quiz_generate_user_prompt(text: str, question_type: str, num_questions: int) -> str:
    type_schemas = {
        "mcq": (
            '{"id": <integer starting at 1>, "type": "mcq", '
            '"question": "<clear question>", '
            '"options": ["A. <option>", "B. <option>", "C. <option>", "D. <option>"], '
            '"answer": "<single letter: A, B, C, or D>"}'
        ),
        "true_false": (
            '{"id": <integer starting at 1>, "type": "true_false", '
            '"question": "<statement that is unambiguously true or false>", '
            '"answer": "<exactly the string True or the string False>"}'
        ),
        "fill_blank": (
            '{"id": <integer starting at 1>, "type": "fill_blank", '
            '"question": "What word or phrase fills the blank?", '
            '"blank_sentence": "<complete sentence with ___ replacing the key word or phrase>", '
            '"answer": "<the exact missing word or short phrase>"}'
        ),
        "short_answer": (
            '{"id": <integer starting at 1>, "type": "short_answer", '
            '"question": "<open question requiring a 1-3 sentence answer>", '
            '"model_answer": "<ideal 1-3 sentence answer used for grading — be thorough>"}'
        ),
    }

    schema = type_schemas.get(question_type, type_schemas["mcq"])
    q_label = question_type.replace("_", " ")

    return (
        f"Generate exactly {num_questions} {q_label} question(s) from the source text below.\n\n"
        f"Return ONLY the following JSON object — no markdown fences, no extra text:\n"
        f"{{\n"
        f'  "source_summary": "<one sentence describing what the source text is about>",\n'
        f'  "questions": [\n'
        f"    {schema},\n"
        f"    ... (repeat for all {num_questions} questions)\n"
        f"  ]\n"
        f"}}\n\n"
        f"Each question object schema:\n{schema}\n\n"
        f"SOURCE TEXT:\n\"\"\"\n{text}\n\"\"\""
    )


# ─────────────────────────────────────────────────────────────────────────────
# QUIZ — EVALUATE
# ─────────────────────────────────────────────────────────────────────────────

QUIZ_EVALUATE_SYSTEM = """You are NeuroCompanion's Quiz Evaluator. You grade student
answers accurately and give warm, constructive feedback for neurodiverse learners.

Grading rules:
- MCQ: correct only if the letter matches exactly (e.g. "B" == "B").
- True/False: correct only if "True" or "False" matches exactly (case-insensitive).
- fill_blank: accept close synonyms and minor spelling errors as correct.
- short_answer: correct if the key concept is present — exact wording does not matter.
- Explanations must be 1-2 short sentences. Be warm. Never use "wrong" or "incorrect" —
  say "not quite" or "the answer is actually…" instead.

CRITICAL OUTPUT RULES — these override everything else:
1. Your entire response must be a single valid JSON object and nothing else.
2. Do NOT wrap the JSON in markdown code fences (no ```json, no ```).
3. Do NOT write any explanation, preamble, or text before or after the JSON.
4. The JSON must be parseable by Python json.loads() directly.
"""


def quiz_evaluate_user_prompt(questions: list[dict], answers: list[dict]) -> str:
    qa_pairs = []
    for q, a in zip(questions, answers):
        qa_pairs.append({
            "id": q["id"],
            "type": q.get("type", ""),
            # For fill_blank, show the sentence not just "What fills the blank?"
            "question": q.get("blank_sentence") or q.get("question", ""),
            "correct_answer": q.get("answer") or q.get("model_answer", ""),
            "user_answer": a.get("answer", ""),
        })

    qa_json = json.dumps(qa_pairs, indent=2)
    n = len(qa_pairs)

    return (
        f"Evaluate the following {n} student answer(s).\n\n"
        f"Return ONLY this JSON object — no markdown fences, no extra text:\n"
        f"{{\n"
        f'  "results": [\n'
        f"    {{\n"
        f'      "id": <integer>,\n'
        f'      "correct": <true or false>,\n'
        f'      "user_answer": "<echo the student answer here>",\n'
        f'      "correct_answer": "<the right answer>",\n'
        f'      "explanation": "<1-2 sentence warm, constructive feedback>"\n'
        f"    }}\n"
        f"  ],\n"
        f'  "score": <number of correct answers as integer>,\n'
        f'  "total": {n},\n'
        f'  "percentage": <score/total * 100 rounded to nearest integer>,\n'
        f'  "grade": <"A" if percentage>=90, "B" if >=75, "C" if >=60, "D" if >=40, "F" otherwise>,\n'
        f'  "study_tip": "<one specific, encouraging tip based on the pattern of errors seen>"\n'
        f"}}\n\n"
        f"QUESTIONS AND STUDENT ANSWERS:\n{qa_json}"
    )