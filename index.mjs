import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { 
    listarDirectorioLocal, 
    leerArchivoLocal, 
    escribirArchivoLocal, 
    moverArchivoLocal, 
    crearCarpetaLocal,
    ejecutarComandoLocal 
} from './tools.mjs';
import { obtenerSystemPrompt } from './systemPrompt.mjs';

// Carga las variables de entorno definidas en el archivo .env
dotenv.config();

// Configuración de conexión con el servicio local de Ollama y el archivo de memoria
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL_NAME = 'llama3';
const MEMORY_FILE = path.join(process.cwd(), 'memory.json');

// Interfaz para la interacción por consola de comandos (CLI)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Carga el historial de conversación guardado en disco para mantener la memoria.
 * Si el archivo de memoria no existe, inicia un nuevo historial configurando el System Prompt.
 * 
 * @returns {Array} Array con la estructura de mensajes para Ollama.
 */
function cargarHistorial() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = fs.readFileSync(MEMORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error al cargar la memoria:", error.message);
    }

    // Inicialización del historial con la instrucción general e integración del System Prompt
    return [
        { 
            role: 'system', 
            content: obtenerSystemPrompt()
        }
    ];
}

/**
 * Persiste el estado actual de la conversación en el archivo JSON local.
 * 
 * @param {Array} history - Array de objetos de mensajes que representan la memoria del modelo.
 */
function guardarHistorial(history) {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
        console.error("Error al guardar la memoria:", error.message);
    }
}

// Carga inicial de la memoria persistente del asistente
let history = cargarHistorial();

/**
 * Procesa la entrada del usuario, detecta TODAS las herramientas invocadas
 * por Ollama en un turno y las ejecuta secuencialmente con reportes individuales.
 * 
 * @param {string|null} userInput - Texto ingresado por el usuario o null durante llamadas recursivas.
 */
async function preguntarJarvis(userInput) {
    if (userInput !== null && userInput !== undefined) {
        history.push({ role: 'user', content: userInput });
    }

    try {
        console.log("\n[SISTEMA]: Pensando respuesta...");

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: history,
                stream: false
            })
        });

        const data = await response.json();
        const rawContent = data.message?.content || "";

        // RegEx que tolera tanto TOOL como TASK
        const regexHerramientas = /\[(?:TOOL|TASK):(crearCarpetaLocal|listarDirectorioLocal|leerArchivoLocal|escribirArchivoLocal|moverArchivoLocal|ejecutarComandoLocal)\|(.*?)\]/gs;
        const llamadasEncontradas = [...rawContent.matchAll(regexHerramientas)];

        // SI HAY HERRAMIENTAS: Las ejecutamos todas
        if (llamadasEncontradas.length > 0) {
            history.push({ role: 'assistant', content: rawContent });

            for (const match of llamadasEncontradas) {
                const tipoHerramienta = match[1];
                const parametrosStr = match[2];

                // 1. crearCarpetaLocal
                if (tipoHerramienta === 'crearCarpetaLocal') {
                    const targetPath = parametrosStr.trim();
                    console.log(`\n[SISTEMA]: Ejecutando herramienta local -> crearCarpetaLocal("${targetPath}")`);
                    const toolResultJson = crearCarpetaLocal(targetPath);
                    const parsedResult = JSON.parse(toolResultJson);

                    if (parsedResult.exito) {
                        console.log(`\n[JARVIS]: Carpeta procesada en: ${parsedResult.ruta}\n`);
                    } else {
                        console.log(`\n[JARVIS]: Error al crear carpeta: ${parsedResult.error}\n`);
                    }
                    history.push({ role: 'tool', content: toolResultJson });
                }

                // 2. listarDirectorioLocal
                else if (tipoHerramienta === 'listarDirectorioLocal') {
                    const targetPath = parametrosStr.trim();
                    console.log(`\n[SISTEMA]: Ejecutando herramienta local -> listarDirectorioLocal("${targetPath || 'Directorio actual'}")`);
                    const toolResultJson = listarDirectorioLocal(targetPath);
                    const parsedResult = JSON.parse(toolResultJson);

                    if (parsedResult.exito) {
                        console.log(`\n[JARVIS]: Archivos encontrados en (${parsedResult.ruta}):`);
                        parsedResult.contenido.forEach(archivo => console.log(`  - ${archivo}`));
                        console.log();
                    } else {
                        console.log(`\n[JARVIS]: No se pudo acceder a la ruta: ${parsedResult.error}\n`);
                    }
                    history.push({ role: 'tool', content: toolResultJson });
                }

                // 3. leerArchivoLocal
                else if (tipoHerramienta === 'leerArchivoLocal') {
                    const targetPath = parametrosStr.trim();
                    console.log(`\n[SISTEMA]: Ejecutando herramienta local -> leerArchivoLocal("${targetPath}")`);
                    const toolResultJson = leerArchivoLocal(targetPath);
                    const parsedResult = JSON.parse(toolResultJson);

                    if (parsedResult.exito) {
                        console.log(`\n[JARVIS]: Contenido del archivo (${parsedResult.ruta}):\n----------------------------------------`);
                        console.log(parsedResult.contenido);
                        console.log(`----------------------------------------\n`);
                    } else {
                        console.log(`\n[JARVIS]: No se pudo leer el archivo: ${parsedResult.error}\n`);
                    }
                    history.push({ role: 'tool', content: toolResultJson });
                }

                // 4. escribirArchivoLocal
                else if (tipoHerramienta === 'escribirArchivoLocal') {
                    const partes = parametrosStr.split('|');
                    const targetPath = partes[0].trim();
                    const contenido = partes.slice(1).join('|').trim();
                    console.log(`\n[SISTEMA]: Ejecutando herramienta local -> escribirArchivoLocal("${targetPath}")`);
                    const toolResultJson = escribirArchivoLocal(targetPath, contenido);
                    const parsedResult = JSON.parse(toolResultJson);

                    if (parsedResult.exito) {
                        console.log(`\n[JARVIS]: El archivo ha sido creado/actualizado correctamente en: ${parsedResult.ruta}\n`);
                    } else {
                        console.log(`\n[JARVIS]: No se pudo guardar el archivo: ${parsedResult.error}\n`);
                    }
                    history.push({ role: 'tool', content: toolResultJson });
                }

                // 5. moverArchivoLocal
                else if (tipoHerramienta === 'moverArchivoLocal') {
                    const partes = parametrosStr.split('|');
                    const origenPath = partes[0].trim();
                    const destinoPath = partes.slice(1).join('|').trim();
                    console.log(`\n[SISTEMA]: Ejecutando herramienta local -> moverArchivoLocal("${origenPath}" -> "${destinoPath}")`);
                    const toolResultJson = moverArchivoLocal(origenPath, destinoPath);
                    const parsedResult = JSON.parse(toolResultJson);

                    if (parsedResult.exito) {
                        console.log(`\n[JARVIS]: Elemento movido correctamente a: ${parsedResult.destino}\n`);
                    } else {
                        console.log(`\n[JARVIS]: No se pudo mover el elemento: ${parsedResult.error}\n`);
                    }
                    history.push({ role: 'tool', content: toolResultJson });
                }

                // 6. ejecutarComandoLocal
                else if (tipoHerramienta === 'ejecutarComandoLocal') {
                    const comando = parametrosStr.trim();
                    console.log(`\n[SISTEMA]: Ejecutando comando de consola -> "${comando}"`);

                    // Como ejecutarComandoLocal devuelve una Promise, usamos await
                    const toolResultJson = await ejecutarComandoLocal(comando);
                    const parsedResult = JSON.parse(toolResultJson);

                    if (parsedResult.exito) {
                        console.log(`\n[JARVIS]: Resultado del comando:\n----------------------------------------`);
                        console.log(parsedResult.salida);
                        console.log(`----------------------------------------\n`);
                    } else {
                        console.log(`\n[JARVIS]: Error al ejecutar comando: ${parsedResult.error}\n`);
                    }
                    history.push({ role: 'tool', content: toolResultJson });
                }
            }

            // Tras ejecutar todas las herramientas, imprimimos confirmación directa sin depender de otra respuesta de Ollama
            const msjExito = "Todas las operaciones solicitadas han sido completadas con éxito, señor.";
            console.log(`[JARVIS]: ${msjExito}\n`);
            history.push({ role: 'assistant', content: msjExito });
            guardarHistorial(history);
            return;
        }

        // SI NO HAY HERRAMIENTAS: Mostramos la respuesta normal de texto si existe
        if (rawContent.trim() !== '') {
            console.log(`\n[JARVIS]: ${rawContent.trim()}\n`);
            history.push({ role: 'assistant', content: rawContent.trim() });
            guardarHistorial(history);
        } else {
            console.log("\n[JARVIS]: Instrucción procesada, señor.\n");
        }

    } catch (error) {
        console.error("Error conectando con Ollama:", error.message);
    }
}

/**
 * Bucle recursivo para gestionar la entrada del usuario a través de la CLI.
 */
function iniciarChat() {
    rl.question('Tú: ', async (input) => {
        if (input.toLowerCase() === 'salir') {
            console.log("¡Hasta luego!");
            rl.close();
            return;
        }
        
        if (input.trim() !== '') {
            await preguntarJarvis(input);
        }
        
        iniciarChat();
    });
}

console.log("=== SISTEMA JARVIS INICIADO ===");
console.log("Escribe tu mensaje o 'salir' para terminar.\n");
iniciarChat();