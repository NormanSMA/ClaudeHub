---
description: Guarda en ClaudeHub el uso actual de tu plan de Claude (5 horas y semanal)
---

Actualiza los limites del plan en ClaudeHub.

1. Llama la herramienta `get_usage`.
2. Toma las ventanas "5-hour limit" y "Weekly · all models". De cada una lee `percentUsed` y `resetsAt` (fecha ISO).
3. Ejecuta con Bash, reemplazando los valores:

```
node "<ruta-de-ClaudeHub>/scripts/write-limits.cjs" --five <percentUsed 5-hour> --five-reset <resetsAt 5-hour> --seven <percentUsed Weekly> --seven-reset <resetsAt Weekly>
```

4. Muestra el resultado en 2 lineas, una por ventana: porcentaje usado y hora de reinicio.

Si `get_usage` no devuelve una ventana, omite sus dos argumentos. Si el comando falla, muestra el mensaje de error sin reintentar.
