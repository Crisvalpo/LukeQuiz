import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImapFlow } from 'imapflow';
import { createClient } from '@supabase/supabase-js';

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

function getEnvValue(key, defaultValue = '') {
  if (process.env[key]) return process.env[key];
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    '/home/ubuntu/luke-quiz/.env',
    '/home/ubuntu/luke-tiktok-live/.env',
    '/home/ubuntu/LukeCore/.env',
    '/home/ubuntu/supabase-docker/docker/.env'
  ];
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch {
      // Ignorar error al leer ruta alternativa
    }
  }
  return defaultValue;
}

const SUPABASE_URL = getEnvValue('SUPABASE_URL', getEnvValue('VITE_SUPABASE_URL', 'https://api-oracle.lukeapp.cl'));
const SUPABASE_SERVICE_ROLE_KEY = getEnvValue(
  'SUPABASE_SERVICE_ROLE_KEY',
  getEnvValue('SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxNzM5NzI5MjcyLCJleHAiOjIwNTUwODkyNzJ9.OEpjObm93DhWMupkDmBQt-9YqrbD18Go_tsPnLCxtUc')
);
const GMAIL_USER = getEnvValue('GMAIL_USER', 'cristianluke@gmail.com');
const GMAIL_APP_PASSWORD = getEnvValue('GMAIL_APP_PASSWORD', 'zwtidhnoncttspkn');

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'quiz' }
});

function getGeminiApiKey() {
  return getEnvValue('GEMINI_API_KEY', null);
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

async function handleGenerateTts(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { text, questionId, quizId } = JSON.parse(body || '{}');
      if (!text || !questionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Faltan parámetros requeridos (text, questionId)' }));
      }

      const safeText = String(text).slice(0, 300);
      const safeQuizId = String(quizId || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeQuestionId = String(questionId).replace(/[^a-zA-Z0-9_-]/g, '');

      // Guardar en dist/uploads/audio/quizId/questionId.mp3
      const audioDir = path.join(DIST_DIR, 'uploads', 'audio', safeQuizId);
      fs.mkdirSync(audioDir, { recursive: true });
      const filePath = path.join(audioDir, `${safeQuestionId}.mp3`);

      // Descargar audio MP3 de Google TTS
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=es&client=tw-ob`;
      const ttsResp = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!ttsResp.ok) {
        throw new Error(`TTS respondió con código ${ttsResp.status}`);
      }

      const arrayBuffer = await ttsResp.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

      const publicUrl = `/uploads/audio/${safeQuizId}/${safeQuestionId}.mp3`;
      console.log(`[API /api/generate-tts] Audio generado exitosamente: ${publicUrl}`);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ publicUrl }));
    } catch (err) {
      console.error('[API /api/generate-tts] Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function handleVerifyTransfer(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Debes iniciar sesión para activar tu pase premium' }));
      }

      // Validar usuario mediante JWT en Supabase
      const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authData?.user?.id) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Sesión no válida o expirada. Por favor recarga e inicia sesión nuevamente.' }));
      }

      const userId = authData.user.id;
      const { operationNumber } = JSON.parse(body || '{}');
      const cleanOp = String(operationNumber || '').replace(/\D/g, '');

      if (!cleanOp || cleanOp.length < 5 || cleanOp.length > 12) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'El número de operación debe contener entre 5 y 10 dígitos numéricos.' }));
      }

      console.log(`[API /api/verify-transfer] Verificando operación ${cleanOp} para usuario ${userId}...`);

      // 1. Revisar si la transferencia ya fue utilizada en quiz.promo_codes
      const { data: existingCode, error: queryErr } = await supabaseAdmin
        .schema('quiz')
        .from('promo_codes')
        .select('*')
        .eq('code', `BE-${cleanOp}`)
        .maybeSingle();

      if (queryErr) {
        console.error('[API /api/verify-transfer] Error consultando promo_codes:', queryErr);
      }

      if (existingCode && existingCode.used_at) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: false,
          error: `Esta transferencia (N° ${cleanOp}) ya fue utilizada anteriormente el ${new Date(existingCode.used_at).toLocaleDateString('es-CL')}.`
        }));
      }

      // 2. Conectar a Gmail vía IMAP y buscar comprobante
      const imapClient = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD
        },
        logger: false
      });

      let matchFound = null;
      try {
        await imapClient.connect();
        const lock = await imapClient.getMailboxLock('INBOX');
        try {
          const sinceDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
          let seqs = await imapClient.search({ since: sinceDate, body: cleanOp });

          if (!seqs || seqs.length === 0) {
            // Intentar búsqueda en remitentes bancoestado
            seqs = await imapClient.search({ since: sinceDate, from: 'bancoestado' });
          }

          if (!seqs || seqs.length === 0) {
            // Fallback a correos recientes de los últimos 2 días
            seqs = await imapClient.search({ since: sinceDate });
          }

          if (seqs && seqs.length > 0) {
            const reversed = [...seqs].reverse().slice(0, 30);
            for (const seq of reversed) {
              for await (let msg of imapClient.fetch(seq, { source: true, envelope: true })) {
                const raw = msg.source.toString('utf8');
                if (raw.includes(cleanOp)) {
                  const montoMatch = raw.match(/Monto(?:\s*transferido)?[\s\S]{0,30}?\$\s*([0-9.]+)/i)
                    || raw.match(/\$\s*([0-9.]+)/i);
                  const monto = montoMatch ? parseInt(montoMatch[1].replace(/\./g, ''), 10) : 1000;
                  matchFound = {
                    subject: msg.envelope?.subject,
                    date: msg.envelope?.date,
                    monto
                  };
                  break;
                }
              }
              if (matchFound) break;
            }
          }
        } finally {
          lock.release();
        }
        await imapClient.logout();
      } catch (imapErr) {
        console.error('[API /api/verify-transfer] Error en conexión IMAP:', imapErr);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: false,
          error: 'Servicio de verificación bancaria momentáneamente no disponible. Por favor reintenta en unos instantes o envía tu comprobante por WhatsApp.'
        }));
      }

      if (!matchFound) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: false,
          notFound: true,
          message: `Aún no recibimos el comprobante con la operación N° ${cleanOp}. Si acabas de transferir, espera 20 a 30 segundos a que BancoEstado procese la notificación y vuelve a presionar "Verificar".`
        }));
      }

      if (matchFound.monto < 1000) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: false,
          error: `El comprobante recibido registra un monto de $${matchFound.monto.toLocaleString('es-CL')}, que es inferior al valor del Pase Diario ($1.000 CLP).`
        }));
      }

      // 3. Registrar el código en promo_codes para prevenir reutilización
      const { error: insertErr } = await supabaseAdmin
        .schema('quiz')
        .from('promo_codes')
        .upsert({
          code: `BE-${cleanOp}`,
          type: 'bancoestado_tef',
          used_at: new Date().toISOString(),
          used_by: userId
        }, { onConflict: 'code' });

      if (insertErr) {
        console.error('[API /api/verify-transfer] Error guardando promo_code:', insertErr);
      }

      // 4. Activar o extender las 24 horas del usuario
      const { data: profileData, error: profileErr } = await supabaseAdmin
        .schema('quiz')
        .from('profiles')
        .select('premium_until')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.error('[API /api/verify-transfer] Error leyendo perfil:', profileErr);
      }

      const currentUntil = profileData?.premium_until ? new Date(profileData.premium_until).getTime() : 0;
      const baseTime = Math.max(Date.now(), currentUntil);
      const newPremiumUntil = new Date(baseTime + 24 * 60 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabaseAdmin
        .schema('quiz')
        .from('profiles')
        .update({ premium_until: newPremiumUntil })
        .eq('id', userId);

      if (updateErr) {
        console.error('[API /api/verify-transfer] Error actualizando profile:', updateErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Error al activar pase en tu cuenta: ' + updateErr.message }));
      }

      console.log(`[API /api/verify-transfer] ¡Operación ${cleanOp} validada exitosamente para usuario ${userId}! Premium hasta: ${newPremiumUntil}`);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({
        ok: true,
        message: '¡Pago verificado exitosamente! Tu Pase Diario de 24 horas está activo.',
        premiumUntil: newPremiumUntil,
        operationNumber: cleanOp
      }));

    } catch (err) {
      console.error('[API /api/verify-transfer] Excepción:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS y cabeceras de seguridad
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Ruta API para verificación bancaria automática
  if (urlPath === '/api/verify-transfer' || urlPath === '/api/verify-transfer/') {
    if (req.method === 'POST') {
      return handleVerifyTransfer(req, res);
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

  // Ruta API para generación de TTS neuronal
  if (urlPath === '/api/generate-tts' || urlPath === '/api/generate-tts/') {
    if (req.method === 'POST') {
      return handleGenerateTts(req, res);
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
