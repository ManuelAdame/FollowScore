# Marcador deportivo en tiempo real para OBS

Aplicación web para editar marcadores deportivos en directo y mostrarlos en OBS
o Streamlabs mediante un overlay transparente. El panel y el overlay reciben
actualizaciones en tiempo real por WebSocket.

## Deportes disponibles

- **Baloncesto**
- **Tenis / Pádel**
- Fútbol y otros deportes aparecen como opciones próximamente.

## Estructura

- `apps/server`: API HTTP, autenticación, estado de los partidos y WebSocket.
- `apps/web`: panel de control y overlays.
- `packages/shared`: estado inicial, acciones y reglas de puntuación compartidas.
- `tests`: pruebas de reglas, estados y acciones deportivas.

## Requisitos e inicio

Se necesita Node.js y npm. Desde la raíz del proyecto:

```bash
npm install
npm run dev
```

La aplicación web estará en `http://localhost:5173` y el servidor en
`http://localhost:3001`.

- Panel de control: `http://localhost:5173/control/demo`
- Overlay de OBS: `http://localhost:5173/overlay/demo`

El panel requiere iniciar sesión. Para desarrollo local, las credenciales por
defecto son `admin` / `admin123`. Se pueden cambiar antes de iniciar el servidor:

```powershell
$env:ADMIN_USER = "tu_usuario"
$env:ADMIN_PASSWORD = "una_contraseña_segura"
npm run dev --workspace @marcador/server
```

No uses las credenciales predeterminadas en un entorno accesible desde otras
personas. El overlay no requiere iniciar sesión.

## Crear y editar partidos

En el panel, pulsa **Nuevo partido** y elige un deporte:

- Baloncesto abre su marcador directamente.
- Tenis / Pádel permite elegir la modalidad de puntuación y crea un marcador
  específico.
- Los demás deportes todavía no se pueden crear.

Cada partido tiene una URL de control y otra para OBS, por ejemplo:

```text
http://localhost:5173/control/<id-del-partido>
http://localhost:5173/overlay/<id-del-partido>
```

Los cambios realizados en el panel se validan en el servidor y se distribuyen a
los clientes conectados a ese partido.

## Marcador de baloncesto

- Marcador de dos equipos, nombres y logos.
- Los logos se pueden seleccionar desde el ordenador; se aceptan PNG, JPEG,
  WebP y GIF de hasta 500 KB.
- Reloj de partido, pausa, reinicio y avance de cuartos.
- Cuatro cuartos de 10 minutos y prórrogas de 5 minutos.
- Puntuación manual de `+1`, `+2`, `+3` y `−1`, sin permitir bajar de cero.
- Faltas de equipo, limitadas a cinco, con indicador de **BONUS** y reinicio
  automático al cambiar de cuarto.
- Plantilla de hasta 30 jugadores por equipo y registro de faltas personales.
- Registro de tiros libres, canastas de dos y triples asociados a un jugador.
- Avisos de anotación y faltas personales en el overlay durante cinco segundos.
- Cabecera y línea inferior editables.

## Marcador de tenis / pádel

- Partidos al mejor de tres sets: se gana al obtener dos sets.
- Nombres de jugador o pareja y banderas de país; se pueden combinar dos
  banderas en una sola insignia.
- Puntuación del juego `0`, `15`, `30`, `40` y ventaja.
- Antes de crear el partido se elige una modalidad:
  - **Bola de oro**: el primer punto tras el 40-40 gana el juego.
  - **Ventajas**: se necesitan dos puntos seguidos después del 40-40.
  - **Star Point**: tras dos vueltas a iguales, el siguiente punto es de oro.
- Un set se gana con al menos seis juegos y una diferencia de dos. Al llegar a
  6-6, se juega un tie-break a siete puntos con diferencia de dos.
- Las casillas de puntos se resaltan en dorado cuando el siguiente punto decide
  el juego.
- Botón para deshacer el último punto, incluidos puntos que cerraron un juego o
  set. Se conservan hasta los últimos 100 puntos para deshacer.
- La cabecera del overlay se puede editar u ocultar dejándola vacía.

## Configurar OBS

1. Añade una fuente de **Navegador**.
2. Introduce la URL `/overlay/<id-del-partido>` que aparece en el panel.
3. Ajusta la anchura y altura a las dimensiones que necesites para el marcador.
4. Mantén fondo transparente; el overlay está diseñado para no pintar el fondo
   de la página.
5. Si los cambios no aparecen, actualiza la caché de la fuente de navegador.

Para acceder al marcador desde otro dispositivo de la misma red, sustituye
`localhost` por la IP del ordenador que ejecuta la aplicación.

## Tests y compilación

Ejecuta la suite de pruebas:

```bash
npm test
```

Compila los workspaces:

```bash
npm run build
```

Los tests utilizan el runner integrado de Node.js y cubren tanto las reglas de
baloncesto como las de tenis / pádel.

## Limitaciones actuales

- Los partidos se mantienen en memoria y se pierden al reiniciar el servidor.
- Tenis / Pádel se presenta con dos lados (jugador o pareja) y una bandera
  combinada opcional; no incluye todavía estadísticas individuales.
- Fútbol y los deportes personalizados aún no tienen marcador funcional.
