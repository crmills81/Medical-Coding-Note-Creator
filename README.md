# Medical Coding Note Creator (v2 — rebuilt prompts, Google Gemini API)

A personal tool: type a CPT code, ICD-10-CM code, modifier, or medical term, and get back an Obsidian-formatted note built to your note conventions. Still runs on Google's Gemini API (same provider as the original build) — what changed is the prompts, not the provider.

## What changed from the original build

- **Billability-first gate.** The model checks whether a code is currently valid/billable *before* writing anything. If it's a retired, restructured, or non-billable parent code, it tells you that instead of generating a fabricated note (this is what caught the G35 → G35.D restructure the old build missed).
- **No invented numbers.** wRVU, HCC RAF weights, and MS-DRG weights are flagged with "⚠️ Verify" instead of confidently-stated guesses.
- **Real inline citations.** Superscript markers actually appear in the body text next to the claims they support, not just promised in a footer disclaimer.
- **Wikilink discipline enforced** — parent/non-billable/retired codes are never wikilinked.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and add your key:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and paste in an API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. Run it:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`.

## Model choice

Defaults to `gemini-3.1-pro-preview` for maximum accuracy on numeric/coding recall — the old build ran on Flash-tier models, which are cheaper and faster but more prone to confidently guessing at specific numbers. If you want faster/cheaper generation and are fine trading a little precision, set `GEMINI_MODEL=gemini-3.1-flash-lite` in `.env`.

## Notes are not gospel

This tool still generates notes from a language model's training knowledge — it has no live connection to your CMS PFS files, CMS-HCC model files, or IPPS Final Rule data. Anything flagged "⚠️ Verify" in the output needs an actual check against those sources before you rely on it. The billability gate reduces the risk of a confidently wrong note, but doesn't replace independent verification for numeric fields.

## Pushing this to GitHub

If you want to replace the contents of your existing `Medical-Coding-Note-Creator` repo:

```bash
cd medical-coding-note-creator
git init
git add .
git commit -m "Rebuild on Claude API with billability gate and verification flagging"
git remote add origin https://github.com/crmills81/Medical-Coding-Note-Creator.git
git branch -M main
git push -f origin main
```

The `-f` force-pushes and overwrites the old Gemini-based history — only do this if you're fine losing the old commit history. If you'd rather keep the old repo intact and start fresh:

```bash
cd medical-coding-note-creator
git init
git add .
git commit -m "Initial commit — Claude-powered rebuild"
gh repo create medical-coding-note-creator-v2 --public --source=. --push
```

(The `gh repo create` command requires the [GitHub CLI](https://cli.github.com/) — install with `brew install gh` on Mac, then `gh auth login` once.)

Either way, **never commit your `.env` file** — it's already in `.gitignore`, but double-check with `git status` before your first push that it isn't staged.
