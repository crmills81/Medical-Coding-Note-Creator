import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import {
  CPT_TEMPLATE_PROMPT,
  ICD10_TEMPLATE_PROMPT,
  MODIFIER_TEMPLATE_PROMPT,
  MEDTERM_TEMPLATE_PROMPT,
  detectNoteType,
} from './templates.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Local JSON persistence (personal use only — never committed, see .gitignore) ---
const DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'vault-notes.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, '[]', 'utf-8');
}

function readStoredNotes() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error reading notes file:', err);
    return [];
  }
}

function saveStoredNotes(notes) {
  ensureDataDir();
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

// --- Routes ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL, timestamp: new Date().toISOString() });
});

app.get('/api/notes', (_req, res) => {
  res.json(readStoredNotes());
});

app.post('/api/notes', (req, res) => {
  const note = req.body;
  if (!note || !note.id || !note.markdown) {
    return res.status(400).json({ error: 'Invalid note payload' });
  }
  const notes = readStoredNotes();
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) notes[idx] = note;
  else notes.unshift(note);
  saveStoredNotes(notes);
  res.json({ success: true, note });
});

app.delete('/api/notes/:id', (req, res) => {
  const notes = readStoredNotes().filter((n) => n.id !== req.params.id);
  saveStoredNotes(notes);
  res.json({ success: true });
});

app.post('/api/generate-note', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_API_KEY is not set. Copy .env.example to .env and add your key.' });
    }

    const { codeOrTerm, noteType: requestedType } = req.body;
    if (!codeOrTerm || typeof codeOrTerm !== 'string') {
      return res.status(400).json({ error: 'Please provide a CPT code, ICD-10-CM code, modifier, or medical term.' });
    }

    const trimmed = codeOrTerm.trim();
    const noteType = ['cpt', 'icd10', 'modifier', 'medterm'].includes(requestedType)
      ? requestedType
      : detectNoteType(trimmed);

    const systemPrompt = {
      cpt: CPT_TEMPLATE_PROMPT,
      icd10: ICD10_TEMPLATE_PROMPT,
      modifier: MODIFIER_TEMPLATE_PROMPT,
      medterm: MEDTERM_TEMPLATE_PROMPT,
    }[noteType];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Code or term: ${trimmed}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const markdown = candidate?.content?.parts?.map((p) => p.text).join('') || '';

    if (!markdown.trim()) {
      return res.status(502).json({ error: 'Gemini returned an empty response. Try again, or check your API quota.' });
    }

    res.json({ markdown, noteType, modelUsed: MODEL, filenamePrefix: trimmed });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate note.' });
  }
});

app.listen(PORT, () => {
  console.log(`Medical Coding Note Creator running on http://localhost:${PORT}`);
  console.log(`Model: ${MODEL} (Google Gemini)`);
});
