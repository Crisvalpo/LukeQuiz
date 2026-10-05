#!/bin/bash
set -e
export PATH=$PATH:$(ls -d ~/.nvm/versions/node/*/bin 2>/dev/null | head -1)

echo "=== 1. Actualizando /home/ubuntu/luke-quiz ==="
cd /home/ubuntu/luke-quiz

# Limpiar cambios locales no commiteados para sincronizar con origin/main
git reset --hard HEAD
git clean -fd
git fetch origin main
git checkout main
git reset --hard origin/main

echo "=== 2. Instalando dependencias si es necesario ==="
npm install --legacy-peer-deps

echo "=== 3. Compilando aplicación Vite ==="
npm run build

echo "=== 4. Reconfigurando PM2 quiz-prod con scripts/server.mjs ==="
# Eliminar el serve genérico anterior y lanzar el server optimizado con cache control
pm2 delete quiz-prod || true
PORT=3006 pm2 start scripts/server.mjs --name quiz-prod --time
pm2 save

echo "=== 5. Creando deploy-quiz.sh en /home/ubuntu/deploy/ ==="
cat << 'EOF' > /home/ubuntu/deploy/deploy-quiz.sh
#!/bin/bash
PROJECT_DIR="/home/ubuntu/luke-quiz"
LOG_FILE="/home/ubuntu/deploy/deploy-quiz.log"
NODE_BIN="$(ls -d /home/ubuntu/.nvm/versions/node/*/bin 2>/dev/null | head -1)"
export PATH=$PATH:$NODE_BIN
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "========================================" >> "$LOG_FILE"
echo "[$TIMESTAMP] Auto-Deploy LukeQuiz iniciado" >> "$LOG_FILE"

cd "$PROJECT_DIR" || exit 1

echo "[$TIMESTAMP] Pulling from GitHub main..." >> "$LOG_FILE"
/usr/bin/git fetch origin main >> "$LOG_FILE" 2>&1
/usr/bin/git reset --hard origin/main >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Instalando dependencias..." >> "$LOG_FILE"
$NODE_BIN/npm install --legacy-peer-deps >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Building Vite app..." >> "$LOG_FILE"
$NODE_BIN/npm run build >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Reiniciando PM2 quiz-prod..." >> "$LOG_FILE"
$NODE_BIN/pm2 restart quiz-prod >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Auto-Deploy DESPLEGADO CON ÉXITO ✅" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
EOF

chmod +x /home/ubuntu/deploy/deploy-quiz.sh

echo "=== 6. Actualizando webhook.js en Oracle para incluir LukeQuiz ==="
# Revisar si quiz ya está registrado en webhook.js
if ! grep -q "deploy-quiz.sh" /home/ubuntu/deploy/webhook.js; then
  sed -i "s/} else if (repoName === 'luke-tiktok-live') {/} else if (repoName === 'luke-tiktok-live') {\n      scriptPath = '\/home\/ubuntu\/deploy\/deploy-tiktok-live.sh';\n    } else if (repoName === 'Quiz' || repoName === 'LukeQuiz' || repoName === 'luke-quiz') {\n      scriptPath = '\/home\/ubuntu\/deploy\/deploy-quiz.sh';/" /home/ubuntu/deploy/webhook.js
  pm2 restart deploy-webhook
  echo "Webhook actualizado y deploy-webhook reiniciado."
else
  echo "Webhook ya tenía registrado deploy-quiz.sh."
fi

echo "=== 7. Verificación de servicio local 3006 ==="
sleep 2
curl -sI http://127.0.0.1:3006/ | head -10
curl -sI http://127.0.0.1:3006/sw.js | head -10
