const codeInput = document.getElementById('codeInput');
const typeOverride = document.getElementById('typeOverride');
const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');
const outputRow = document.getElementById('outputRow');
const outputArea = document.getElementById('outputArea');
const outputMeta = document.getElementById('outputMeta');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const savedList = document.getElementById('savedList');
const quickSuggestions = document.getElementById('quickSuggestions');

const SUGGESTIONS = [
  { code: '67820', label: 'CPT 67820 — Trichiasis correction' },
  { code: '52000', label: 'CPT 52000 — Cystourethroscopy' },
  { code: 'G35.D', label: 'ICD-10 G35.D — MS, unspecified' },
  { code: 'N23', label: 'ICD-10 N23 — Renal colic' },
  { code: '-25', label: 'Modifier -25' },
  { code: '-50', label: 'Modifier -50' },
];

function renderSuggestions() {
  quickSuggestions.innerHTML = '';
  SUGGESTIONS.forEach((s) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = s.label;
    btn.onclick = () => {
      codeInput.value = s.code;
      generate();
    };
    quickSuggestions.appendChild(btn);
  });
}

function setStatus(text, isError = false) {
  statusEl.textContent = text || '';
  statusEl.className = 'status' + (isError ? ' error' : '');
}

async function generate() {
  const codeOrTerm = codeInput.value.trim();
  if (!codeOrTerm) {
    setStatus('Enter a code or term first.', true);
    return;
  }

  generateBtn.disabled = true;
  setStatus('Generating…');
  outputRow.style.display = 'none';

  try {
    const res = await fetch('/api/generate-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeOrTerm, noteType: typeOverride.value || undefined }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Generation failed.', true);
      return;
    }

    outputArea.value = data.markdown;
    outputMeta.textContent = `${data.noteType.toUpperCase()} · ${data.modelUsed}`;
    outputRow.style.display = 'block';
    setStatus('Done. Review before using — check any ⚠️ Verify flags against your source data.');
  } catch (err) {
    setStatus(err.message || 'Network error.', true);
  } finally {
    generateBtn.disabled = false;
  }
}

async function loadSavedNotes() {
  const res = await fetch('/api/notes');
  const notes = await res.json();
  savedList.innerHTML = '';
  if (!notes.length) {
    savedList.innerHTML = '<p class="empty">No saved notes yet.</p>';
    return;
  }
  notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <span>${note.filenamePrefix || note.id}</span>
      <div>
        <button data-action="load">Load</button>
        <button data-action="delete">Delete</button>
      </div>
    `;
    item.querySelector('[data-action="load"]').onclick = () => {
      outputArea.value = note.markdown;
      outputMeta.textContent = note.filenamePrefix || note.id;
      outputRow.style.display = 'block';
    };
    item.querySelector('[data-action="delete"]').onclick = async () => {
      await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      loadSavedNotes();
    };
    savedList.appendChild(item);
  });
}

generateBtn.addEventListener('click', generate);
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputArea.value);
  setStatus('Copied to clipboard.');
});

saveBtn.addEventListener('click', async () => {
  const id = `${Date.now()}`;
  const filenamePrefix = codeInput.value.trim();
  await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, filenamePrefix, markdown: outputArea.value }),
  });
  loadSavedNotes();
  setStatus('Saved to local vault.');
});

renderSuggestions();
loadSavedNotes();
