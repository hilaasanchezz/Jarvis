# Estado del Proyecto: Jarvis Assistant (Node.js)

## 1. Visión General
Jarvis es un asistente virtual personal en Node.js (ES Modules) configurado para actuar como un mayordomo formal en español ("señor"). Funciona mediante un modelo de lenguaje local ejecutado en Ollama (`llama3`) a través de un bucle CLI interactivo (`readline`).

El modelo se comunica con el sistema operativo interceptando invocaciones de herramientas mediante sintaxis de corchetes: `[TOOL:nombreHerramienta|parametros]`.

---

## 2. Arquitectura del Proyecto

* **`index.mjs`**: Punto de entrada principal y ejecutor del bucle de chat.
  * Mantiene la persistencia de la conversación en un archivo `memory.json`.
  * Realiza peticiones POST a `http://localhost:11434/api/chat`.
  * Utiliza un motor de Regex de coincidencia múltiple (`/\[(?:TOOL|TASK):...\]/gs`) para detectar, parsear y ejecutar de forma secuencial **todas** las herramientas devueltas por Ollama en un mismo turno.
  * Inicializa la autenticación del servicio de Spotify antes de abrir la consola.

* **`systemPrompt.mjs`**:
  * Define la personalidad del asistente y mapea las rutas principales del SO (`os.homedir()`, Escritorio, Documentos).
  * Proporciona la guía estricta de sintaxis `[TOOL:nombre|parametro]` y ejemplos de uso para evitar que el modelo responda con texto simulado sin ejecutar las acciones.

* **`tools.mjs`**:
  * Módulo unificado que exporta las funciones locales del sistema operativo y re-exporta la función `reproducirSpotify`.
  * Contiene operaciones del sistema de archivos (`fs`), ejecutor de comandos CLI (`child_process`), buscador recursivo y reproducción multimedia con `yt-search`.

* **`spotify.mjs`**:
  * Implementa autenticación OAuth 2.0 (Authorization Code + Refresh Token) de Spotify.
  * Gestiona tokens de forma persistente en `spotify_tokens.json`.
  * Estrategia de reproducción: Intenta enviar la orden `PUT /v1/me/player/play` a un dispositivo activo vía Web API. Si no hay dispositivos activos (aplicación cerrada), levanta el proceso nativo en Windows (`start spotify`), espera 5 segundos de cortesía para estabilizar el socket y reintenta la llamada API (con un fallback directo mediante URI URI `start spotify:track:...`).

---

## 3. Catálogo Completo de Herramientas (10 Tools)

1. `crearCarpetaLocal|RUTA` — Crea directorios locales.
2. `listarDirectorioLocal|RUTA` — Lista el contenido de carpetas.
3. `leerArchivoLocal|RUTA` — Lee contenido de archivos de texto plano.
4. `escribirArchivoLocal|RUTA|CONTENIDO` — Escribe o crea archivos con texto.
5. `moverArchivoLocal|ORIGEN|DESTINO` — Mueve o renombra archivos/directorios.
6. `ejecutarComandoLocal|COMANDO` — Ejecuta comandos de terminal (PowerShell/CMD/Git). Devuelve una Promesa.
7. `buscarArchivosLocal|RUTABASE|PATRON` — Búsqueda recursiva de archivos.
8. `abrirAplicacionLocal|OBJETIVO` — Abre ejecutables (`calc`, `notepad`) o URLs en el navegador.
9. `reproducirMusicaLocal|TERMINO` — Busca en YouTube vía `yt-search` y abre el mejor resultado en el navegador predeterminado.
10. `reproducirSpotify|TERMINO` — Autentica, busca y reproduce tracks de Spotify.

---

## 4. Reglas Críticas de Desarrollo
1. **Promesas y Asincronía:** En `index.mjs`, herramientas como `ejecutarComandoLocal`, `buscarArchivosLocal`, `abrirAplicacionLocal`, `reproducirMusicaLocal` y `reproducirSpotify` son **asíncronas** y devuelven Promesas. DEBEN ejecutarse con `await` antes de parsear su JSON de respuesta.
2. **Formato de Respuestas de Herramientas:** Todas las herramientas en `tools.mjs` y `spotify.mjs` deben devolver obligatoriamente una cadena JSON válida formateada con la clave `{ "exito": boolean, ... }`.
3. **Roles en el Historial de Ollama:** Los resultados de las ejecuciones de herramientas se guardan en el array de memoria con el rol `tool` (`{ role: 'tool', content: toolResultJson }`).