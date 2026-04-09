# 🚀 LukeQuiz - Plataforma de Quiz en Tiempo Real

¡El clon de Kahoot! con diseño premium y tiempo real ya está listo!

## 🛠️ Configuración de Supabase

Para que la aplicación funcione, debes seguir estos pasos en tu proyecto de Supabase:

### 1. Ejecutar el SQL de las Tablas
Copia y pega el SQL proporcionado para crear las tablas: `quizzes`, `questions`, `games`, `players` y `answers`.

### 2. Habilitar Realtime
Es **CRÍTICO** habilitar Realtime para las tablas que lo necesitan. Ejecuta esto en el SQL Editor:
```sql
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz de `Kahoot-Luke/` basado en `.env.example`:
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

## 📂 Estructura del Proyecto

- `/join`: Vista para jugadores (PIN + Nickname + Emoji).
- `/host/:id`: Control para el administrador.
- `/screen/:id`: Pantalla para TV con QR y Ranking.
- `/edit/:id`: Editor de preguntas.
- `/`: Biblioteca de quizzes.

## 🎨 Características Premium
- **Glassmorphism UI**
- **Suscripciones Realtime** (Supabase)
- **Efectos de Confetti**
- **Mobile-first**

## 🏎️ Cómo Ejecutar
1. `npm install`
2. `npm run dev`
