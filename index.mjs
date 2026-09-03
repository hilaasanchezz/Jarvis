import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os'; // <--- Añadido aquí arriba con el resto de imports
import { listarDirectorioLocal, leerArchivoLocal, escribirArchivoLocal } from './tools.mjs';

// Carga las variables de entorno desde el archivo .env
dotenv.config();

// Configuración de los endpoints y modelo de Ollama
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL_NAME = 'llama3';
const MEMORY_FILE = path.join(process.cwd(), 'memory.json');

// Configuración de la interfaz de lectura/escritura por consola (CLI)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Carga el historial de conversación desde el archivo JSON local.
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

    // Obtenemos la ruta base del usuario (ej: C:\Users\hilar)
    const userHome = os.homedir();
    const desktopPath = path.join(userHome, 'Desktop');
    const documentsPath = path.join(userHome, 'Documents');

    // Historial de uso de las herramientas
    return [
        { 
            role: 'system', 
            content: `Eres Jarvis, un asistente personal inteligente, eficiente y formal. Debes dirigirte siempre al usuario llamándole "señor" con un tono respetuoso al estilo de un mayordomo virtual avanzado.
Tienes acceso a herramientas locales para listar directorios, leer archivos y escribir/crear archivos.

RUTAS DEL SISTEMA DEL SEÑOR:
- Escritorio: ${desktopPath}
- Documentos: ${documentsPath}
- Carpeta Personal: ${userHome}

REGLAS DE HERRAMIENTAS:
1. Si el usuario te pide listar una carpeta o directorio, responde con:
[TOOL:listarDirectorioLocal|RUTADELACARPETA]

2. Si el usuario te pide leer un archivo, responde con:
[TOOL:leerArchivoLocal|RUTADELARCHIVO]

3. Si el usuario te pide crear o escribir un archivo, responde con:
[TOOL:escribirArchivoLocal|RUTADELARCHIVO|CONTENIDOATEXTO]

Nota: Si el usuario menciona "el escritorio", "mis documentos" o rutas relativas, utiliza siempre las RUTAS DEL SISTEMA indicadas arriba para construir la ruta absoluta correspondiente.` 
        }
    ];
}

/**
 * Guarda el array de historial actualizado en el archivo JSON local.
 */
function guardarHistorial(history) {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
        console.error("Error al guardar la memoria:", error.message);
    }
}

// Inicializamos la memoria cargándola desde el disco
let history = cargarHistorial();

/**
 * Envía el mensaje del usuario y el historial completo al endpoint de Ollama.
 */
async function preguntarJarvis(userInput) {
    history.push({ role: 'user', content: userInput });

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
        
        if (data.message && data.message.content) {
            let botReply = data.message.content.trim();

            // 1. Herramienta: listarDirectorioLocal
            const toolListarMatch = botReply.match(/\[TOOL:listarDirectorioLocal\|(.*?)\]/);
            if (toolListarMatch) {
                const targetPath = toolListarMatch[1].trim();
                console.log(`\n[SISTEMA]: Ejecutando herramienta local -> listarDirectorioLocal("${targetPath || 'Directorio actual'}")`);
                
                const toolResultJson = listarDirectorioLocal(targetPath);
                const parsedResult = JSON.parse(toolResultJson);

                if (parsedResult.exito) {
                    console.log(`\n[JARVIS]: Archivos encontrados en (${parsedResult.ruta}):`);
                    parsedResult.contenido.forEach(archivo => {
                        console.log(`  - ${archivo}`);
                    });
                    console.log();
                } else {
                    console.log(`\n[JARVIS]: No se pudo acceder a la ruta: ${parsedResult.error}\n`);
                }

                history.push({ role: 'assistant', content: botReply });
                history.push({ role: 'tool', content: toolResultJson });
                guardarHistorial(history);
                return;
            }

            // 2. Herramienta: leerArchivoLocal
            const toolLeerMatch = botReply.match(/\[TOOL:leerArchivoLocal\|(.*?)\]/);
            if (toolLeerMatch) {
                const targetPath = toolLeerMatch[1].trim();
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

                history.push({ role: 'assistant', content: botReply });
                history.push({ role: 'tool', content: toolResultJson });
                guardarHistorial(history);
                return;
            }

            // 3. Herramienta: escribirArchivoLocal
            const toolEscribirMatch = botReply.match(/\[TOOL:escribirArchivoLocal\|(.*?)\|(.*?)\]/s);
            if (toolEscribirMatch) {
                const targetPath = toolEscribirMatch[1].trim();
                const contenido = toolEscribirMatch[2].trim();
                console.log(`\n[SISTEMA]: Ejecutando herramienta local -> escribirArchivoLocal("${targetPath}")`);
                
                const toolResultJson = escribirArchivoLocal(targetPath, contenido);
                const parsedResult = JSON.parse(toolResultJson);

                if (parsedResult.exito) {
                    console.log(`\n[JARVIS]: El archivo ha sido creado/actualizado correctamente en: ${parsedResult.ruta}\n`);
                } else {
                    console.log(`\n[JARVIS]: No se pudo guardar el archivo: ${parsedResult.error}\n`);
                }

                history.push({ role: 'assistant', content: botReply });
                history.push({ role: 'tool', content: toolResultJson });
                guardarHistorial(history);
                return;
            }

            // Si no hay herramientas involucradas
            console.log(`\n[JARVIS]: ${botReply}\n`);
            history.push({ role: 'assistant', content: botReply });
            guardarHistorial(history);

        } else {
            console.log("\n[JARVIS]: (No se recibió respuesta válida de Ollama)\n");
        }

    } catch (error) {
        console.error("Error conectando con Ollama:", error.message);
    }
}

/**
 * Bucle recursivo para mantener la sesión interactiva abierta en la consola.
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

console.log("=== SISTEMA JARVIS (ESCRITURA DE ARCHIVOS) INICIADO ===");
console.log("Escribe tu mensaje o 'salir' para terminar.\n");
iniciarChat();