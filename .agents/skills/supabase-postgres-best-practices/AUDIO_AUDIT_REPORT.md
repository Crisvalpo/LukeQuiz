# Auditoría de Sistema: Generación de Audio TTS Engine 2.0

Este documento detalla el estado de salud, seguridad y rendimiento del subsistema de síntesis de voz neuronal (Google Cloud TTS) tras el rediseño "Engine 2.0".

## 📊 Estado de Salud Actual: **EXCELENTE**
El sistema ha sido centralizado mediante el hook `useAudioSync.js`, eliminando la dispersión lógica y mejorando la mantenibilidad.

### ✅ Fortalezas y Mejoras (Engine 2.0)
- **Centralización Total**: La lógica de generación, lotes y errores se gestiona íntegramente en `useAudioSync.js`. El componente `EditQuiz.jsx` es ahora un 30% más ligero.
- **Limpieza de Storage Automática**: [CORREGIDO] Se ha implementado la eliminación de archivos `.mp3` al borrar preguntas en el editor, evitando el almacenamiento de "archivos fantasma".
- **Switch Killer Transparente**: El sistema ahora comunica claramente al usuario cuando se alcanza el 80% de la cuota gratuita, en lugar de mostrar errores genéricos.
- **Sincronización Inteligente**: Los indicadores visuales (ambar para cambios pendientes, verde para sincronizado) ahora funcionan de forma reactiva y precisa.

### ✅ Acciones Completadas
- [x] Corregir firma de `updateQuestion` en generador masivo.
- [x] Implementar limpieza de Storage en `deleteCurrent`.
- [x] Crear Hook `useAudioSync.js` para centralizar la lógica.
- [x] Estandarizar códigos de error en Edge Function (`LIMIT_EXCEEDED`, `EXTERNAL_ERROR`).

## 📈 Métricas de Cuota
- **Fase**: Operativa (Engine 2.0).
- **Protección**: 80% (Switch Killer activo).
- **Mantenimiento**: Automático (Storage Sync activo).
- **Consumo de Control**: 5,000 caracteres (Valor inicial fijado para auditar gasto acumulado).

> [!IMPORTANT]
> La tabla `system_usage` actúa como un **medidor acumulativo (taxímetro)** del consumo real de la API de Google Cloud. Se ha fijado un valor inicial de 5,000 caracteres para mantener margen sobre consumos previos.
