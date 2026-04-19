# LukeQUIZ - Data Dictionary

Este archivo es la fuente de verdad técnica para la arquitectura de datos de LukeQUIZ.

## Roles y Permisos Especiales

### Administrador
El sistema utiliza una función auxiliar `public.is_admin()` para centralizar la verificación de privilegios elevados.

- **Email Administrador**: `cristianluke@gmail.com`
- **Lógica**: La función `is_admin()` extrae el email del JWT de autenticación (`auth.jwt() ->> 'email'`) y lo compara con el email autorizado.

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email' = 'cristianluke@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Tablas y Políticas RLS

### `quizzes`
Almacena las trivias creadas por los usuarios.

| Política | Comando | Condición (USING/WITH CHECK) |
| :--- | :--- | :--- |
| Gestión total de quizzes para dueños o admin | ALL | `(auth.uid() = user_id) OR is_admin()` |
| Quizzes visibles para dueños, públicos o admin | SELECT | `(visibility = 'public') OR (auth.uid() = user_id) OR is_admin()` |

### `questions`
Almacena las preguntas asociadas a cada quiz.

| Política | Comando | Condición (USING/WITH CHECK) |
| :--- | :--- | :--- |
| Gestión de preguntas por dueño o admin | ALL | `EXISTS (SELECT 1 FROM quizzes WHERE id = questions.quiz_id AND (auth.uid() = quizzes.user_id OR is_admin()))` |
| Lectura de preguntas vinculadas | SELECT | `EXISTS (SELECT 1 FROM quizzes WHERE id = questions.quiz_id AND (quizzes.visibility = 'public' OR auth.uid() = quizzes.user_id OR is_admin()))` |

### `promo_codes`
Gestiona los accesos premium temporales (24h pass).

| Política | Comando | Condición (USING/WITH CHECK) |
| :--- | :--- | :--- |
| Gestión total de códigos por admin | ALL | `is_admin()` |
| Lectura códigos por autenticados | SELECT | `auth.role() = 'authenticated'` |
| Uso de códigos | UPDATE | `auth.role() = 'authenticated'` |

### `games`
Gestiona las sesiones de juego activas.

| Política | Comando | Condición (USING/WITH CHECK) |
| :--- | :--- | :--- |
| Gestión total de juegos para dueños o admin | ALL | `(auth.uid() = user_id) OR is_admin()` |
| Permite a invitados crear juegos | INSERT | `true` |
| Lectura pública de juegos | SELECT | `true` |

### `players`
Jugadores unidos a una partida.

| Política | Comando | Condición (USING/WITH CHECK) |
| :--- | :--- | :--- |
| Cualquiera puede unirse | INSERT | `true` |
| Lectura pública de jugadores | SELECT | `true` |
| Actualizar info de jugador (scores) | UPDATE | `true` |

### `answers`
Respuestas enviadas por los jugadores.

| Política | Comando | Condición (USING/WITH CHECK) |
| :--- | :--- | :--- |
| Jugadores insertan respuestas | INSERT | `true` |
| Lectura pública de respuestas | SELECT | `true` |

---

*Última actualización: 2026-04-18 - Sincronización de respuestas para invitados y pantallas.*
