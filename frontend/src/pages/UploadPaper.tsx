import { useState, useEffect, FormEvent } from 'react';

const CBC_GRADES = [
  'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
];
const FORM_GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

type Status = { type: 'ok' | 'err'; message: string } | null;

export default function UploadPaper() {
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [curriculum, setCurriculum] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('2026');
  const [price, setPrice] = useState('');
  const [isBundle, setIsBundle] = useState(false);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const gradeOptions =
    curriculum === 'CBC' ? CBC_GRADES : curriculum === '844' ? FORM_GRADES : [];

  // Reset grade whenever curriculum changes
  useEffect(() => {
    setGrade('');
  }, [curriculum]);

  // Auto-generate the title unless the user has manually edited it
  useEffect(() => {
    if (titleTouched) return;
    if (grade && examType && term && year) {
      const subjectPart = isBundle ? 'Full Set' : subject;
      const parts = [grade, subjectPart, examType, 'Term', term, year].filter(Boolean);
      setTitle(parts.join(' '));
    }
  }, [grade, subject, examType, term, year, isBundle, titleTouched]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!file) {
      setStatus({ type: 'err', message: 'Please choose a file to upload.' });
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('curriculum', curriculum);
    formData.append('grade', grade);
    formData.append('subject', subject);
    formData.append('exam_type', examType);
    formData.append('term', term);
    formData.append('year', year);
    formData.append('price', price);
    formData.append('is_bundle', String(isBundle));
    formData.append('file', file);

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/papers', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${adminUser}:${adminPass}`),
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setStatus({ type: 'ok', message: `Uploaded successfully — Paper ID ${data.id}` });
      setFile(null);
      setTitleTouched(false);
      // Reset the native file input element too
      const fileInput = document.getElementById('file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setStatus({ type: 'err', message: 'Error: ' + (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Upload Exam Paper</h2>
        <p style={styles.subtitle}>RevisionHub Admin</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.grid}>
            <Field label="Admin username">
              <input
                style={styles.input}
                autoComplete="username"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
              />
            </Field>
            <Field label="Admin password">
              <input
                style={styles.input}
                type="password"
                autoComplete="current-password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
              />
            </Field>

            <hr style={styles.hr} />

            <Field label="Curriculum">
              <select
                style={styles.input}
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="CBC">CBC (PP1–Grade 10)</option>
                <option value="844">8-4-4 (Form 1–4)</option>
              </select>
            </Field>

            <Field label="Grade / Class">
              <select
                style={styles.input}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={!gradeOptions.length}
              >
                <option value="">
                  {gradeOptions.length ? '-- Select --' : '-- Select curriculum first --'}
                </option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>

            <Field label="Subject (leave blank for Full Set bundle)" full>
              <input
                style={styles.input}
                placeholder="e.g. Mathematics"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>

            <Field label="Exam type">
              <select
                style={styles.input}
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="Opener">Opener</option>
                <option value="Mid Term">Mid Term</option>
                <option value="End Term">End Term</option>
              </select>
            </Field>
            <Field label="Term">
              <select style={styles.input} value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value="">-- Select --</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </Field>

            <Field label="Year">
              <input
                style={styles.input}
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
            <Field label="Price (KES)">
              <input
                style={styles.input}
                type="number"
                placeholder="50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>

            <div style={{ ...styles.full, ...styles.checkboxRow }}>
              <input
                type="checkbox"
                id="is_bundle"
                style={styles.checkbox}
                checked={isBundle}
                onChange={(e) => setIsBundle(e.target.checked)}
              />
              <label htmlFor="is_bundle" style={{ marginTop: 0, fontWeight: 600, fontSize: '0.875rem' }}>
                This is a Full Set bundle (all subjects)
              </label>
            </div>
            <p style={{ ...styles.hint, ...styles.full, marginTop: '-0.75rem' }}>
              Full Set bundles should be uploaded as a .zip file containing all subject PDFs.
            </p>

            <Field label="Title (auto-generated, or override)" full>
              <input
                style={styles.input}
                placeholder="e.g. Grade 5 Mathematics Mid Term 2 2026"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
              />
            </Field>

            <Field label="File (PDF or ZIP for bundles)" full>
              <input
                id="file"
                style={styles.input}
                type="file"
                accept=".pdf,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>

            <div style={styles.full}>
              <button type="submit" style={styles.button} disabled={submitting}>
                {submitting ? 'Uploading…' : 'Upload Paper'}
              </button>
            </div>
          </div>
        </form>

        {status && (
          <p style={status.type === 'ok' ? styles.statusOk : styles.statusErr}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={full ? styles.full : undefined}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: 'system-ui, sans-serif',
    color: '#1a1a1a',
    background: '#ffffff',
    minHeight: '100vh',
    width: '100%',
    padding: '3rem 4rem',
    boxSizing: 'border-box',
  },
  card: { width: '100%' },
  heading: { margin: '0 0 0.25rem', color: '#0a7d2c', fontSize: '1.5rem' },
  subtitle: { margin: '0 0 1.5rem', color: '#666', fontSize: '0.85rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '3rem',
  },
  full: { gridColumn: '1 / -1' },
  label: { display: 'block', marginTop: '1rem', fontWeight: 600, fontSize: '0.875rem' },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    marginTop: '0.3rem',
    border: '1px solid #ccc',
    borderRadius: 6,
    fontSize: '0.9rem',
    background: '#fff',
    boxSizing: 'border-box',
  },
  hr: { gridColumn: '1 / -1', border: 'none', borderTop: '1px solid #eee', marginTop: '1.5rem' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' },
  checkbox: { width: 'auto', accentColor: '#00a651' },
  hint: { fontSize: '0.75rem', color: '#888', marginTop: '0.3rem' },
  button: {
    marginTop: '1.75rem',
    width: '100%',
    padding: '0.85rem',
    background: 'linear-gradient(180deg, #00b85c 0%, #008f45 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
  statusOk: {
    marginTop: '1.25rem',
    fontWeight: 600,
    padding: '0.75rem',
    borderRadius: 6,
    fontSize: '0.9rem',
    background: '#e3f7ea',
    color: '#0a7d2c',
    border: '1px solid #b6e8c8',
  },
  statusErr: {
    marginTop: '1.25rem',
    fontWeight: 600,
    padding: '0.75rem',
    borderRadius: 6,
    fontSize: '0.9rem',
    background: '#fbe9e9',
    color: '#a4282c',
    border: '1px solid #f1c4c4',
  },
};