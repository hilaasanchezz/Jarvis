import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { listarDirectorioLocal } from './tools.mjs';

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

    // Historial base con instrucciones para extraer la ruta en la etiqueta
    return [
        { 
            role: 'system', 
            content: `Eres Jarvis, un asistente personal inteligente y eficiente con memoria persistente.
Tienes acceso a una herramienta local para listar archivos.
Si el usuario te pide listar una carpeta específica, ruta o directorio, DEBES responder incluyendo la etiqueta con la ruta exacta en este formato:
[TOOL:listarDirectorioLocal|RUTADELACARPETA]
Si solo pide listar archivos en general sin indicar ruta, usa la etiqueta así:
[TOOL:listarDirectorioLocal|]
Si no necesitas usar herramientas, respóndele normalmente en lenguaje natural.` 
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

            // Buscamos la etiqueta de herramienta y capturamos la ruta opcional tras el pipe '|'
            const toolMatch = botReply.match(/\[TOOL:listarDirectorioLocal\|(.*?)\]/);

            if (toolMatch) {
                const targetPath = toolMatch[1].trim();
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

console.log("=== SISTEMA JARVIS (MODULARIZADO) INICIADO ===");
console.log("Escribe tu mensaje o 'salir' para terminar.\n");
iniciarChat();