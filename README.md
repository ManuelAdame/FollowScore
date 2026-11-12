# Marcador en tiempo real para OBS

Plataforma para controlar un marcador deportivo desde el móvil y mostrarlo en
un overlay transparente para OBS/Streamlabs.

## Estructura

- `apps/server`: servidor HTTP y WebSocket.
- `apps/web`: panel de control y overlay web.
- `packages/shared`: modelo compartido del estado del partido.

## Primer arranque

```bash
npm install
npm run dev
```

El servidor queda disponible en `http://localhost:3001` y la aplicación web en
`http://localhost:5173`.

- Panel de control: `http://localhost:5173/control/demo`
- Overlay para OBS: `http://localhost:5173/overlay/demo`

Desde el panel puedes crear un partido nuevo. Cada partido tendrá sus propias
URLs, por ejemplo `/control/abc123` y `/overlay/abc123`. En OBS se utiliza la
URL del overlay como **Fuente de navegador** con fondo transparente.

El panel requiere iniciar sesión. Para desarrollo local se puede usar
`admin` / `admin123`. En cualquier entorno compartido cambia estas credenciales
con las variables `ADMIN_USER` y `ADMIN_PASSWORD` antes de iniciar el servidor.
El overlay de OBS no requiere autenticación.

## Flujo inicial

1. El servidor mantiene los estados de las salas en memoria.
2. Los clientes se conectan por WebSocket indicando `matchId`.
3. El panel envía acciones (`INCREMENT_SCORE`, `DECREMENT_SCORE`, `UPDATE_TEAMS`).
4. El servidor valida la acción y difunde el nuevo estado solo a esa sala.

## Plantilla de baloncesto

Las salas utilizan actualmente la plantilla de baloncesto:

- Cuatro cuartos de 10 minutos.
- Prórrogas de 5 minutos desde el quinto periodo.
- Reloj compartido y controlado por el servidor.
- Indicador del cuarto o prórroga actual.
- Puntuaciones sin límite superior.
- Botones `+1`, `+2`, `+3` y `-1`.
- El marcador nunca puede bajar de cero.

El botón **Siguiente cuarto** prepara el siguiente periodo con el reloj parado.
El árbitro puede iniciar, pausar o reiniciar el reloj desde el panel.

## Próximos pasos

1. Añadir faltas, tiempos muertos y posesión.
2. Persistir partidos y estadísticas en PostgreSQL.
3. Añadir configuración visual del overlay y una URL pública para OBS.
4. Probar reconexión, latencia y despliegue.
