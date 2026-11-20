require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const Analysis = require("./models/Analysis");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.use(cors());

// Serve the frontend folder (works from any working directory)
app.use(express.static(path.join(__dirname, "..", "frontend")));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err.message));

// Send the resume + job description to the Python AI service
async function callAI(file, jd) {
  const form = new FormData();
  form.append("resume", new Blob([file.buffer]), file.originalname);
  form.append("job_description", jd);

  const res = await fetch(`${process.env.AI_URL}/analyze`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120000), // 2 minutes (the AI service can be asleep on the free plan)
  });
  if (!res.ok) throw new Error("AI service error");

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function saveResult(d) {
  return Analysis.create({
    candidateName: d.candidate_name,
    jobTitle: d.job_role,
    score: d.score,
    matchingSkills: d.matching_skills,
    missingSkills: d.missing_skills,
    experienceMet: d.experience_met,
    verdict: d.verdict,
  });
}

// Simple check route (open /health in the browser to see if the server is up)
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Candidate mode: 1 resume
app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file || !req.body.jobDescription) {
      return res.status(400).json({ error: "Please provide both a resume and a job description." });
    }
    const data = await callAI(req.file, req.body.jobDescription);

    // A database problem should not hide a successful AI result
    try {
      await saveResult(data);
    } catch (dbError) {
      console.error("Could not save result:", dbError.message);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recruiter mode: many resumes, ranked by score
app.post("/api/rank", upload.array("resumes", 20), async (req, res) => {
  try {
    if (!req.files || !req.files.length || !req.body.jobDescription) {
      return res.status(400).json({ error: "Please provide resumes and a job description." });
    }

    const results = [];
    for (const f of req.files) {
      // One by one, to stay inside the AI rate limit
      try {
        const d = await callAI(f, req.body.jobDescription);
        try {
          await saveResult(d);
        } catch (dbError) {
          console.error("Could not save result:", dbError.message);
        }
        results.push({ file: f.originalname, ...d });
      } catch (e) {
        results.push({ file: f.originalname, error: e.message });
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/history", async (_, res) => {
  try {
    res.json(await Analysis.find().sort({ createdAt: -1 }).limit(50));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Render gives the port through the PORT variable. Locally it stays 5000.
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));