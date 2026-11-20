import os
import json
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------
# Setup
# ---------------------------------------------------------------
load_dotenv()
my_api_key = os.getenv("GROQ_API_KEY")

if not my_api_key:
    raise ValueError("API key kaha hai bhai")

client = Groq(api_key=my_api_key)
model = "openai/gpt-oss-120b"


# ---------------------------------------------------------------
# Models (schemas)
# ---------------------------------------------------------------
class JobD(BaseModel):
    role: str
    required_skills: list[str]
    preferred_skills: list[str]
    minimum_experience: float | None
    education_requirements: list[str]
    responsibilities: list[str]


class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None
    skills_used: list[str] = []


class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None

    total_experience_years: float | None = None

    skills: list[str] = []
    experiences: list[Experience] = []
    education: list[str] = []
    projects: list[str] = []
    certifications: list[str] = []


# details: dict hata ke fixed fields, taaki frontend me easily dikha sako
class MatchResult(BaseModel):
    score: float
    matching_skills: list[str]
    missing_skills: list[str]
    experience_met: bool
    verdict: str


jobd_schema = JobD.model_json_schema()
resume_schema = Resume.model_json_schema()
match_schema = MatchResult.model_json_schema()


# ---------------------------------------------------------------
# Helper: LLM call jo JSON return kare
# ---------------------------------------------------------------
def ask_llm_json(messages):
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


# ---------------------------------------------------------------
# 1) Job description parse karna
# ---------------------------------------------------------------
JOB_SYSTEM_PROMPT = f"""
You are an expert HR assistant.

Your job is to analyze job descriptions and extract
structured information from them.

Return ONLY valid JSON matching this schema:

{jobd_schema}
IMPORTANT:
Do NOT return the schema itself.
Do NOT return fields like "properties", "title" or "type".
Fill the schema with actual information extracted from the job description.

If minimum experience is not mentioned, return null.
If information for a list is missing, return an empty list.
Do not invent information.
"""


@lru_cache(maxsize=64)
def parse_job(jd_text: str) -> JobD:
    # lru_cache: HR mode me same JD ke liye baar baar LLM call nahi hogi
    messages = [
        {"role": "system", "content": JOB_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze the following job description:\n\n{jd_text}"},
    ]
    return JobD(**ask_llm_json(messages))


# ---------------------------------------------------------------
# 2) Resume parse karna
# ---------------------------------------------------------------
RESUME_SYSTEM_PROMPT = f"""
You are an expert resume parser.

Extract information from the resume based on its meaning,
not only based on exact section headings.

Different resumes may use different headings.

For example:
- Experience
- Professional Experience
- Work History
- Employment
- Internships

These may all contain relevant experience.

Skills may also appear in the skills section, work experience,
internships or projects.

Return ONLY valid JSON matching this schema:

{resume_schema}

Important rules:

1. Do not invent information.
2. If a value is not available, return null.
3. If a list has no information, return an empty list.
4. Include internships inside experiences.
5. Extract skills mentioned across the entire resume.
6. Do NOT return the schema itself, return actual extracted values.
"""


def parse_resume(resume_text: str) -> Resume:
    messages = [
        {"role": "system", "content": RESUME_SYSTEM_PROMPT},
        {"role": "user", "content": f"Parse the following resume:\n\n{resume_text}"},
    ]
    return Resume(**ask_llm_json(messages))


# ---------------------------------------------------------------
# 3) Match score nikalna
# ---------------------------------------------------------------
def final_score(job: JobD, resume: Resume) -> MatchResult:
    prompt = f"""
    You are an HR recruiter.

    Compare the candidate's resume with the job description.

    JOB DESCRIPTION:
    {job.model_dump_json(indent=2)}

    CANDIDATE RESUME:
    {resume.model_dump_json(indent=2)}

    Return ONLY valid JSON matching this schema:

    {match_schema}

    Do NOT return the schema itself. Fill it with real values:

    - score: overall match percentage from 0 to 100
    - matching_skills: skills the candidate has that the job needs
    - missing_skills: important skills the job needs that the candidate lacks
    - experience_met: true if the experience requirement is met, else false
    - verdict: a short final verdict (2-3 sentences)

    Be honest and do not invent information.
    """
    messages = [{"role": "user", "content": prompt}]
    result = MatchResult(**ask_llm_json(messages))
    result.score = max(0.0, min(100.0, result.score))  # 0-100 ke beech rakho
    return result


# ---------------------------------------------------------------
# File readers (PDF / DOCX)
# file path ya file-like object, dono chalte hain
# ---------------------------------------------------------------
def read_pdf(file):
    reader = PdfReader(file)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def read_docx(file):
    document = Document(file)
    text = ""
    for paragraph in document.paragraphs:
        if paragraph.text.strip():
            text += paragraph.text + "\n"

    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    text += cell.text + "\n"
    return text


# ---------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------
app = FastAPI(title="Resume Screener AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(resume: UploadFile = File(...), job_description: str = Form(...)):
    ext = Path(resume.filename or "").suffix.lower()

    try:
        if ext == ".pdf":
            text = read_pdf(resume.file)
        elif ext == ".docx":
            text = read_docx(resume.file)
        else:
            return {"error": "Only PDF or DOCX allowed"}
    except Exception:
        return {"error": "Resume file read nahi ho paayi (corrupt ya protected ho sakti hai)"}

    if not text.strip():
        return {"error": "Resume me text nahi mila (scanned/image PDF ho sakta hai)"}

    try:
        job = parse_job(job_description.strip())
        parsed = parse_resume(text)
        result = final_score(job, parsed)
    except Exception as e:
        return {"error": f"AI processing failed: {e}"}

    return {
        "candidate_name": parsed.name,
        "job_role": job.role,
        **result.model_dump(),
    }
