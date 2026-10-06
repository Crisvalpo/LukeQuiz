import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = parseInt(process.env.PORT || '3006', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    '/home/ubuntu/luke-quiz/.env',
    '/home/ubuntu/luke-tiktok-live/.env'
  ];
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch {
      // Ignorar error al leer ruta alternativa
    }
  }
  return null;
}

async function handleGenerateQuiz(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { topic, description, count } = JSON.parse(body || '{}');
      const apiKey = getGeminiApiKey();

      if (!apiKey) {
        console.error('[API /api/generate-quiz] GEMINI_API_KEY no encontrada');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Configuración incompleta: GEMINI_API_KEY no encontrada en el servidor' }));
      }

      const safeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
      const safeTopic = String(topic || '').slice(0, 200);
      const safeDescription = String(description || '').slice(0, 500);

      const prompt = `ACTÚA COMO UN API DE DATOS.
TEMA PRINCIPAL: "${safeTopic}".
CONTEXTO ADICIONAL: "${safeDescription || 'No se proporcionó contexto extra'}".
CANTIDAD DE PREGUNTAS: ${safeCount}.
IDIOMA: ESPAÑOL.
REGLA CRÍTICA 1: RESPONDE ÚNICAMENTE CON UN ARRAY JSON. SIN SALUDOS, SIN COMENTARIOS, SIN BLOQUES DE MARKDOWN.
REGLA CRÍTICA 2: Las preguntas deben ser EXTREMADAMENTE CORTAS (MÁXIMO 14 PALABRAS).
REGLA CRÍTICA 3: Las opciones DEBEN ser de una o dos palabras máximo.
REGLA CRÍTICA 4: La correcta DEBE ser una letra mayúscula: "A", "B", "C" o "D".
REGLA CRÍTICA 5: "keyword" debe ser 1 a 3 palabras visuales sobre la pregunta para buscar una fotografía real.
FORMATO JSON: [{"text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "image_url": "", "keyword": "..."}]`;

      const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      let lastError = '';
      let generatedJson = null;

      for (const model of models) {
        try {
          console.log(`[API /api/generate-quiz] Consultando Gemini modelo ${model}...`);
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  response_mime_type: 'application/json'
                }
              })
            }
          );

          const result = await resp.json();
          if (!resp.ok) {
            console.warn(`[API /api/generate-quiz] Error con ${model}:`, result.error?.message || resp.statusText);
            lastError = result.error?.message || `HTTP ${resp.status}`;
            continue;
          }

          const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const match = rawText.match(/\[[\s\S]*\]/);
            if (match) {
              generatedJson = JSON.parse(match[0]);
              break;
            }
          }
        } catch (err) {
          console.warn(`[API /api/generate-quiz] Excepción con ${model}:`, err.message);
          lastError = err.message;
        }
      }

      if (!generatedJson || !Array.isArray(generatedJson)) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Fallo al generar preguntas con IA: ${lastError}` }));
      }

      console.log(`[API /api/generate-quiz] ${generatedJson.length} preguntas generadas exitosamente`);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(generatedJson));
    } catch (err) {
      console.error('[API /api/generate-quiz] Error general:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS y cabeceras de seguridad
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Ruta API para generación de trivias con Gemini
  if (urlPath === '/api/generate-quiz' || urlPath === '/api/generate-quiz/') {
    if (req.method === 'POST') {
      return handleGenerateQuiz(req, res);
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }
    res.writeHead(405);
    return res.end();
  }

  // Rutas estáticas normales
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }

  let filePath = path.join(DIST_DIR, urlPath);

  // Seguridad: evitar path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Comprobar existencia del archivo solicitado
  let stat;
  let isSpaFallback = false;
  try {
    stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }
  } catch {
    // Si no existe y es una ruta de navegación, fallback a index.html (SPA)
    filePath = path.join(DIST_DIR, 'index.html');
    isSpaFallback = true;
    try {
      stat = fs.statSync(filePath);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Dist not found. Run npm run build.');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  // Control de caché estricto
  const isSW = urlPath === '/sw.js' || urlPath.endsWith('sw.js');
  const isManifest = ext === '.webmanifest' || urlPath.includes('manifest');
  const isHTML = ext === '.html' || isSpaFallback || urlPath === '/';
  const isHashedAsset = urlPath.startsWith('/assets/');

  if (isSW || isHTML || isManifest) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (isHashedAsset) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }

  res.writeHead(200);
  if (req.method === 'HEAD') {
    return res.end();
  }

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[LukeQuiz] Servidor en ejecución en http://0.0.0.0:${PORT} (dist: ${DIST_DIR})`);
});
