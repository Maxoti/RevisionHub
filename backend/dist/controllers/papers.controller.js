"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPapers = listPapers;
exports.listPapersAdmin = listPapersAdmin;
exports.createPaper = createPaper;
exports.updatePaper = updatePaper;
exports.deletePaper = deletePaper;
const db_1 = __importDefault(require("../config/db"));
const storage_service_1 = require("../services/storage.service");
async function listPapers(req, res) {
    const { curriculum, grade, exam_type, term, year } = req.query;
    const conditions = ['active = TRUE'];
    const values = [];
    if (curriculum) {
        values.push(curriculum);
        conditions.push(`curriculum = $${values.length}`);
    }
    if (grade) {
        values.push(grade);
        conditions.push(`grade = $${values.length}`);
    }
    if (exam_type) {
        values.push(exam_type);
        conditions.push(`exam_type = $${values.length}`);
    }
    if (term) {
        values.push(term);
        conditions.push(`term = $${values.length}`);
    }
    if (year) {
        values.push(Number(year));
        conditions.push(`year = $${values.length}`);
    }
    const { rows } = await db_1.default.query(`SELECT id, title, curriculum, grade, subject, exam_type, term, year,
            price, is_bundle
     FROM papers
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, is_bundle DESC, grade ASC, subject ASC`, values);
    res.json(rows);
}
async function listPapersAdmin(req, res) {
    const { rows } = await db_1.default.query(`SELECT id, title, curriculum, grade, subject, exam_type, term, year,
            price, is_bundle, active, file_key, created_at
     FROM papers
     ORDER BY created_at DESC`);
    res.json(rows);
}
async function createPaper(req, res) {
    const { title, curriculum, grade, subject, exam_type, term, year, price, is_bundle } = req.body;
    if (!req.file) {
        res.status(400).json({ error: 'File is required' });
        return;
    }
    if (!title) {
        res.status(400).json({ error: 'title is required' });
        return;
    }
    if (!curriculum) {
        res.status(400).json({ error: 'curriculum is required (CBC or 844)' });
        return;
    }
    if (!grade) {
        res.status(400).json({ error: 'grade is required' });
        return;
    }
    if (!exam_type) {
        res.status(400).json({ error: 'exam_type is required' });
        return;
    }
    if (!term) {
        res.status(400).json({ error: 'term is required' });
        return;
    }
    if (!year) {
        res.status(400).json({ error: 'year is required' });
        return;
    }
    if (!price) {
        res.status(400).json({ error: 'price is required' });
        return;
    }
    const bundle = is_bundle === 'true' || is_bundle === true;
    const fileKey = `papers/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    await (0, storage_service_1.uploadPaper)(fileKey, req.file.buffer, req.file.mimetype);
    const { rows } = await db_1.default.query(`INSERT INTO papers
       (title, curriculum, grade, subject, exam_type, term, year, price, is_bundle, file_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`, [
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
    ]);
    res.status(201).json({ id: rows[0].id, message: 'Paper uploaded successfully' });
}
async function updatePaper(req, res) {
    const { id } = req.params;
    const { title, curriculum, grade, subject, exam_type, term, year, price, is_bundle, active } = req.body;
    try {
        const { rows: existingRows } = await db_1.default.query('SELECT id FROM papers WHERE id = $1', [id]);
        if (existingRows.length === 0) {
            res.status(404).json({ error: 'Paper not found' });
            return;
        }
        const fields = [];
        const values = [];
        function set(column, value) {
            values.push(value);
            fields.push(`${column} = $${values.length}`);
        }
        if (title !== undefined)
            set('title', title);
        if (curriculum !== undefined)
            set('curriculum', curriculum);
        if (grade !== undefined)
            set('grade', grade);
        if (subject !== undefined)
            set('subject', subject || null);
        if (exam_type !== undefined)
            set('exam_type', exam_type);
        if (term !== undefined)
            set('term', term);
        if (year !== undefined)
            set('year', Number(year));
        if (price !== undefined)
            set('price', Number(price));
        if (is_bundle !== undefined)
            set('is_bundle', is_bundle === 'true' || is_bundle === true);
        if (active !== undefined)
            set('active', active === 'true' || active === true);
        if (fields.length === 0) {
            res.status(400).json({ error: 'No fields provided to update' });
            return;
        }
        values.push(id);
        await db_1.default.query(`UPDATE papers SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        res.json({ message: 'Paper updated successfully' });
    }
    catch (err) {
        console.error('[updatePaper]', err);
        res.status(500).json({ error: 'Failed to update paper' });
    }
}
async function deletePaper(req, res) {
    const { id } = req.params;
    try {
        const { rows } = await db_1.default.query('SELECT file_key FROM papers WHERE id = $1', [id]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Paper not found' });
            return;
        }
        await db_1.default.query('UPDATE papers SET active = FALSE WHERE id = $1', [id]);
        res.json({ message: 'Paper deactivated successfully' });
    }
    catch (err) {
        console.error('[deletePaper]', err);
        res.status(500).json({ error: 'Failed to delete paper' });
    }
}
