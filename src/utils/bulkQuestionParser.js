/**
 * Parser universal e inteligente para importación masiva de preguntas en LukeQuiz.
 * Soporta múltiples formatos:
 * 1. Formato Pipe (|): estándar y tablas Markdown (| Pregunta | A | B | C | D | Correcta | Keyword |)
 * 2. Formato Tabulado (\t): copiado directo desde Excel o Google Sheets
 * 3. Formato Punto y coma (;): CSVs y tablas exportadas
 * 4. Formato Bloques / Examen (IA texto libre): 1. Pregunta \n A) ... \n B) ... \n Respuesta: B
 * 5. Formato JSON: arrays devueltos por APIs o LLMs
 */

export function parseBulkQuestions(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return [];
    }

    // 1. Normalizar saltos de línea y remover delimitadores de código markdown envolventes (```)
    let cleaned = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();

    // 2. Intento JSON
    if (cleaned.startsWith('[') || cleaned.startsWith('{') || (cleaned.includes('[{') && cleaned.includes('}]'))) {
        try {
            let jsonString = cleaned;
            const match = cleaned.match(/\[[\s\S]*\]/);
            if (match) jsonString = match[0];
            const parsed = JSON.parse(jsonString);
            const list = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.preguntas || [parsed]);
            
            const results = [];
            for (const item of list) {
                if (!item || typeof item !== 'object') continue;
                const text = item.text || item.question || item.pregunta || item.title || '';
                const opts = item.options || item.opciones || [item.option_a, item.option_b, item.option_c, item.option_d];
                const rawCorr = item.correct_option || item.correct || item.respuesta || item.correcta || 'A';
                const kw = item.keyword || item.image_keyword || item.palabra_clave || '';
                const img = item.image_url || '';

                if (text && Array.isArray(opts) && opts.length >= 2) {
                    const cleanCorr = resolveCorrectOption(rawCorr, opts);
                    results.push({
                        text: cleanQuestionText(text),
                        option_a: String(opts[0] || '').trim(),
                        option_b: String(opts[1] || '').trim(),
                        option_c: String(opts[2] || '').trim(),
                        option_d: String(opts[3] || '').trim(),
                        correct_option: cleanCorr,
                        image_url: img,
                        image_keyword: kw
                    });
                }
            }
            if (results.length > 0) return results;
        } catch {
            // No fue JSON válido, continuar con otros parsers
        }
    }

    // 3. Intento Formato Bloques / Examen (pregunta + opciones A-D en líneas separadas)
    const blockQuestions = parseBlockFormat(cleaned);
    if (blockQuestions.length > 0) {
        return blockQuestions;
    }

    // 4. Intento Delimitado por Líneas (Pipes '|', Tabs '\t', Punto y coma ';')
    return parseDelimitedLines(cleaned);
}

/**
 * Limpia prefijos numerados al inicio de la pregunta como "1. ", "1) ", "Q1: ", etc.
 */
function cleanQuestionText(text) {
    if (!text) return '';
    return text
        .replace(/^(\d+[\.\-\)]\s*|Q\d+[:\.]\s*|Pregunta\s*\d+[:\.\-]?\s*)/i, '')
        .trim();
}

/**
 * Resuelve la letra correcta (A, B, C o D). Si se proporcionó el texto completo de la opción,
 * busca qué opción coincide para devolver la letra correspondiente.
 */
function resolveCorrectOption(corrInput, options = []) {
    if (!corrInput) return 'A';
    const str = String(corrInput).trim();

    // Caso directo: "A", "B", "C", "D" o "Opción A", etc.
    const directLetterMatch = str.match(/^[oOpPcC]?\s*([A-D])\b/i) || str.match(/\b([A-D])\b/i);
    if (directLetterMatch) {
        return directLetterMatch[1].toUpperCase();
    }

    // Si pasaron el texto de la respuesta (ej: "París" en vez de "B")
    const lower = str.toLowerCase();
    for (let i = 0; i < 4; i++) {
        const opt = String(options[i] || '').trim().toLowerCase();
        if (opt && (opt === lower || lower.includes(opt) || opt.includes(lower))) {
            return ['A', 'B', 'C', 'D'][i];
        }
    }

    return 'A';
}

/**
 * Parsea formato tipo examen / IA multilínea:
 * 1. ¿Cuál es la capital de Italia?
 * A) Madrid
 * B) Roma
 * C) París
 * D) Berlín
 * Respuesta: B (o Respuesta: Roma)
 */
function parseBlockFormat(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const questions = [];

    let currentQ = null;

    const finalizeCurrent = () => {
        if (currentQ && currentQ.text && currentQ.option_a && currentQ.option_b) {
            currentQ.correct_option = resolveCorrectOption(currentQ.raw_corr, [
                currentQ.option_a,
                currentQ.option_b,
                currentQ.option_c,
                currentQ.option_d
            ]);
            delete currentQ.raw_corr;
            questions.push({ ...currentQ });
        }
        currentQ = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detección de inicio de pregunta numerada o con signo de interrogación
        const isQuestionStart = /^\d+[\.\)]\s+/.test(line) ||
            /^pregunta\s+\d+[:\.]/i.test(line) ||
            (/^¿/i.test(line) && !/^[A-D][\)\.\:\-]/i.test(line));

        // Detección de opciones A, B, C, D
        const optionMatch = line.match(/^[\*\-]?\s*([A-D])[\)\.\:\-]\s*(.+)$/i);

        // Detección de respuesta correcta
        const answerMatch = line.match(/^(?:respuesta|solución|correcta|rpta|resp|answer|correct)[\s\:\-]+\s*(.+)$/i);

        if (isQuestionStart) {
            finalizeCurrent();
            currentQ = {
                text: cleanQuestionText(line),
                option_a: '',
                option_b: '',
                option_c: '',
                option_d: '',
                raw_corr: 'A',
                image_url: '',
                image_keyword: ''
            };
        } else if (optionMatch && currentQ) {
            const letter = optionMatch[1].toUpperCase();
            const optVal = optionMatch[2].trim();
            if (letter === 'A') currentQ.option_a = optVal;
            else if (letter === 'B') currentQ.option_b = optVal;
            else if (letter === 'C') currentQ.option_c = optVal;
            else if (letter === 'D') currentQ.option_d = optVal;
        } else if (answerMatch && currentQ) {
            currentQ.raw_corr = answerMatch[1].trim();
        } else if (currentQ && !currentQ.option_a && !currentQ.text.endsWith('?')) {
            // Continuación del texto de la pregunta si ocupa 2 líneas
            currentQ.text = `${currentQ.text} ${line}`.trim();
        }
    }

    finalizeCurrent();
    return questions;
}

/**
 * Parsea formato por líneas delimitadas (Pipes, Tabs o Punto y coma)
 */
function parseDelimitedLines(text) {
    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const questions = [];

    for (const rawLine of rawLines) {
        // Ignorar separadores de tablas Markdown como "|---|---|---|" o ":---:"
        if (/^\|?\s*[-:]+[-|\s:]+$/.test(rawLine)) continue;

        // Ignorar encabezados típicos de tabla como "Pregunta | Opción A |..."
        if (/^\|?\s*pregunta\s*(\||;|\t)/i.test(rawLine) || /^pregunta\t/i.test(rawLine)) continue;

        let parts = [];
        if (rawLine.includes('|')) {
            // Eliminar pipes al inicio y al final si proviene de una tabla Markdown
            let line = rawLine;
            if (line.startsWith('|')) line = line.substring(1);
            if (line.endsWith('|')) line = line.substring(0, line.length - 1);
            parts = line.split('|').map(s => s.trim());
        } else if (rawLine.includes('\t')) {
            parts = rawLine.split('\t').map(s => s.trim());
        } else if (rawLine.includes(';') && (rawLine.match(/;/g) || []).length >= 4) {
            parts = rawLine.split(';').map(s => s.trim());
        }

        // Si tenemos al menos pregunta y al menos 2 opciones
        if (parts.length >= 3) {
            let [t, a, b, c, d, corr, imgOrKeyword] = parts;
            if (!t) continue;

            const opts = [a || '', b || '', c || '', d || ''];
            const cleanCorr = resolveCorrectOption(corr, opts);
            const isUrl = /^https?:\/\//i.test(imgOrKeyword || '');

            questions.push({
                text: cleanQuestionText(t),
                option_a: opts[0],
                option_b: opts[1],
                option_c: opts[2],
                option_d: opts[3],
                correct_option: cleanCorr,
                image_url: isUrl ? imgOrKeyword : '',
                image_keyword: isUrl ? '' : (imgOrKeyword || '')
            });
        }
    }

    return questions;
}
