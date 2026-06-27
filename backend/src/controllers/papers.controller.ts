import { Request, Response } from 'express';
import pool from '../config/db';
import { uploadPaper } from '../services/storage.service';

type MulterRequest = Request & { file?: any };
export async function listPapers(req: Request, res: Response): Promise<void> {
  const { curriculum, grade, exam_type, term, year } = req.query;
  const conditions: string[] = ['active = TRUE'];
  const values: unknown[] = [];

  if (curriculum) { values.push(curriculum);  conditions.push(`curriculum = $${values.length}`); }
  if (grade)      { values.push(grade);        conditions.push(`grade = $${values.length}`); }
  if (exam_type)  { values.push(exam_type);    conditions.push(`exam_type = $${values.length}`); }
  if (term)       { values.push(term);         conditions.push(`term = $${values.length}`); }
  if (year)       { values.push(Number(year)); conditions.push(`year = $${values.length}`); }

  const { rows } = await pool.query(
    `SELECT id, title, curriculum, grade, subject, exam_type, term, year,
            price, is_bundle
     FROM papers
     WHERE ${conditions.join(' AND ')}
     ORDER BY is_bundle DESC, grade ASC, subject ASC`,
    values
  );

  res.json(rows);
}

export async function createPaper(req: MulterRequest, res: Response): Promise<void> {
  const { title, curriculum, grade, subject, exam_type, term, year, price, is_bundle } = req.body;

  if (!req.file)   { res.status(400).json({ error: 'File is required' }); return; }
  if (!title)      { res.status(400).json({ error: 'title is required' }); return; }
  if (!curriculum) { res.status(400).json({ error: 'curriculum is required (CBC or 844)' }); return; }
  if (!grade)      { res.status(400).json({ error: 'grade is required' }); return; }
  if (!exam_type)  { res.status(400).json({ error: 'exam_type is required' }); return; }
  if (!term)       { res.status(400).json({ error: 'term is required' }); return; }
  if (!year)       { res.status(400).json({ error: 'year is required' }); return; }
  if (!price)      { res.status(400).json({ error: 'price is required' }); return; }

  const bundle = is_bundle === 'true' || is_bundle === true;
  const fileKey = `papers/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;

  await uploadPaper(fileKey, req.file.buffer, req.file.mimetype);

  const { rows } = await pool.query(
    `INSERT INTO papers
       (title, curriculum, grade, subject, exam_type, term, year, price, is_bundle, file_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      title,
      curriculum,
      grade,
      bundle ? null : (subject || null),
      exam_type,
      term,
      Number(year),
      Number(price),
      bundle,
      fileKey,
    ]
  );

  res.status(201).json({ id: rows[0].id, message: 'Paper uploaded successfully' });
}