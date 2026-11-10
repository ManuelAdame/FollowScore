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

## Flujo inicial

1. El servidor mantiene los estados de las salas en memoria.
2. Los clientes se conectan por WebSocket indicando `matchId`.
3. El panel envía acciones (`INCREMENT_SCORE`, `DECREMENT_SCORE`, `UPDATE_TEAMS`).
4. El servidor valida la acción y difunde el nuevo estado solo a esa sala.

## Próximos pasos

1. Añadir autenticación sencilla para proteger el panel de control.
2. Modelar deportes concretos (sets, periodos, saques y faltas).
3. Persistir partidos y estadísticas en PostgreSQL.
4. Añadir configuración visual del overlay y una URL pública para OBS.
5. Probar reconexión, latencia y despliegue.
