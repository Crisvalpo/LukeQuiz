# Diccionario de Datos - LukeQUIZ

Este documento detalla la estructura de la base de datos Supabase para el proyecto LukeQUIZ. Sirve como referencia técnica para el desarrollo y auditoría de datos.

## 📊 Tablas del Sistema

### 1. `quizzes`
Almacena la configuración principal de cada cuestionario.
- **id** (uuid, PK): Identificador único del cuestionario.
- **title** (text): Título del quiz comercial o educativo.
- **description** (text, nullable): Descripción detallada del contenido.
- **background_music_url** (text, nullable): Enlace al audio ambiental durante el juego.
- **user_id** (uuid, FK): Propietario del quiz (public.profiles).
- **visibility** (text): Visibilidad del quiz ('public' o 'private').
- **is_ai_generated** (bool): Flag para indicar si fue creado por IA.
- **created_at** (timestamptz): Fecha de creación del registro.

> [!IMPORTANT]
> La eliminación de un registro en `quizzes` dispara un **DELETE CASCADE** en `questions` y `games`.

### 2. `questions`
| column | type | description |
| :--- | :--- | :--- |
| id | uuid | PK auto |
| quiz_id | uuid | FK a quizzes.id |
| text | text | Enunciado de la pregunta. |
| option_a | text | Respuesta Opción A. |
| option_b | text | Respuesta Opción B. |
| option_c | text | Respuesta Opción C. |
| option_d | text | Respuesta Opción D. |
| correct_option | text | Letra (A,B,C,D) de la respuesta correcta. |
| time_limit | int | Segundos para responder (Default: 10). |
| order_index | int | Posición en la secuencia del quiz. |
| image_url | text | URL de la imagen (Unsplash, Google o manual). |
| audio_url | text | URL del archivo .mp3 generado por TTS. |
| last_tts_text | text | Último texto usado para generar el audio (Sincronización Engine 2.0). |
| is_cover | bool | Si es `true`, esta imagen será la portada del quiz. |
| created_at | timestamptz | Fecha de creación. |

> [!IMPORTANT]
> **Relación**: `quiz_id` tiene **ON DELETE CASCADE**. Al borrar la trivia, se borran sus preguntas automáticamente.
> La eliminación de una pregunta dispara un **DELETE CASCADE** en `answers`.

> [!NOTE]
> La columna `media_url` ha sido eliminada por obsolescencia en la versión TTS Engine 2.0.

### 3. `games`
Controla el estado de una partida en tiempo real.
- **id** (uuid, PK): Identificador único de la sesión de juego.
- **quiz_id** (uuid, FK): Referencia al quiz utilizado.
- **join_code** (text, unique): Código de 6 caracteres para que los jugadores se unan.
- **status** (text): Estado actual ('waiting', 'question', 'results', 'finished').
- **current_question_index** (int): Índice de la pregunta que se está mostrando.
- **question_started_at** (timestamptz): Timestamp para sincronización del timer.
- **settings** (jsonb): Configuraciones de la partida (ej: tempo).
- **user_id** (uuid, FK): El usuario que inició la partida (auth.users).
- **created_at** (timestamptz): Fecha de inicio.

> [!IMPORTANT]
> **Relación**: `quiz_id` tiene **ON DELETE CASCADE**. Al borrar la trivia, se borran sus partidas automáticamente.
> La eliminación de un juego dispara un **DELETE CASCADE** en `players`.

### 4. `players`
Jugadores conectados a una partida específica.
- **id** (uuid, PK): Identificador único del jugador.
- **game_id** (uuid, FK): Sesión de juego activa.
- **nickname** (text): Alias elegido por el usuario.
- **emoji** (text): Icono visual asociado.
- **score** (int): Puntaje acumulado en la sesión.
- **created_at** (timestamptz): Fecha de ingreso.

> [!IMPORTANT]
> **Relación**: `game_id` tiene **ON DELETE CASCADE**. Al borrar el juego, se borran sus jugadores automáticamente.
> La eliminación de un jugador dispara un **DELETE CASCADE** en `answers`.

### 5. `answers`
Registro de las respuestas enviadas por los jugadores.
- **id** (uuid, PK): Identificador de la respuesta.
- **player_id** (uuid, FK): Jugador que respondió.
- **question_id** (uuid, FK): Pregunta asociada.
- **selected_option** (text): Opción elegida (A, B, C, D).
- **answered_at** (timestamptz): Fecha exacta de la respuesta.
- **created_at** (timestamptz).

### 6. `tts_usage_logs`
**[NUEVA]** Historial detallado de consumo de la API de Google Cloud TTS.
| column | type | description |
| :--- | :--- | :--- |
| id | uuid | PK auto |
| quiz_id | uuid | FK a quizzes.id (Opcional). |
| question_id | uuid | FK a questions.id (Opcional). |
| chars_count | int | Número de caracteres procesados en este evento. |
| created_at | timestamptz | Fecha y hora de la generación. |

> [!NOTE]
> **Relación**: `quiz_id` y `question_id` tienen **ON DELETE SET NULL**. Se conservan los logs para auditoría aunque se borre el contenido original.

---

### Mantenimiento y Auditoría
- **Consumo Mensual**: Se monitorea en `system_usage`.
- **Auditoría Detallada**: Cada llamada a la API genera un registro en `tts_usage_logs`.

### 7. `system_usage`
Control de cuotas y costos de servicios externos (TTS).
- **id** (text, PK): Identificador del periodo o servicio (ej: '2026-04').
- **characters_used** (bigint): Total de caracteres procesados por Google Cloud TTS.
- **updated_at** (timestamptz): Última actualización de la cuota.

### 8. `profiles`
**[NUEVA]** Información extendida de los usuarios.
- **id** (uuid, PK): ID de usuario de auth.users.
- **nickname** (text): Nombre público del creador.
- **is_premium** (bool): Estado de suscripción premium (manual o permanente).
- **premium_until** (timestamptz, nullable): Fecha de fin del acceso premium temporal (pases de 24h).
- **ai_credits** (int): Créditos disponibles para generación IA.
- **created_at** (timestamptz).

### 9. `promo_codes`
**[NUEVA]** Gestión de cupones y pases mágicos.
- **id** (uuid, PK).
- **code** (text, unique): Código alfanumérico.
- **type** (text): 'magic_pass' o 'premium_trial'.
- **expires_at** (timestamptz).
- **used_by** (uuid, FK): Usuario que activó el código.

### 10. `reports`
**[NUEVA]** Sistema de moderación de contenido.
- **id** (uuid, PK).
- **quiz_id** (uuid, FK).
- **user_id** (uuid, FK): Denunciante.
- **reason** (text).
- **status** (text): 'pending', 'reviewed', 'dismissed'.

---

## 🔍 Hallazgos de Auditoría (Hallazgos Raros)

1. **`questions.media_url`**: No existe ninguna referencia en el código de la aplicación (`src/` ni `supabase/functions/`). Se sugiere su **borrado** para simplificar el esquema y evitar confusiones con `image_url`.
2. **`questions.media_type`**: Se actualiza en el editor pero no tiene un uso funcional crítico en la pantalla de visualización, la cual se basa directamente en la presencia de `image_url`. Se recomienda mantenerla por ahora para facilitar futuras inclusiones de video, pero documentar su subuso actual.

## 🛠️ Plan de Limpieza Sugerido
- Ejecutar un script de migración para eliminar `media_url`.
- Consolidar `media_type` como un ENUM estricto para evitar inconsistencias de texto manual.
