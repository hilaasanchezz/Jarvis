import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

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
 * Si el archivo no existe, inicializa un array con el prompt del sistema.
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

    // Historial base por defecto con rol de sistema
    return [
        { 
            role: 'system', 
            content: 'Eres Jarvis, un asistente personal inteligente, leal y eficiente. Recuerdas las conversaciones anteriores gracias a tu memoria persistente.' 
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
    // 1. Añadimos la entrada del usuario al historial activo
    history.push({ role: 'user', content: userInput });

    try {
        // 2. Realizamos la petición HTTP POST a Ollama con todo el contexto
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
        
        // 3. Verificamos que la respuesta del modelo sea correcta
        if (data.message && data.message.content) {
            const botReply = data.message.content;
            console.log(`\n[JARVIS]: ${botReply}\n`);
            
            // 4. Añadimos la respuesta del asistente al historial y guardamos en disco
            history.push({ role: 'assistant', content: botReply });
            guardarHistorial(history); 
        } else {
            console.log("\n[JARVIS]: (No se recibió respuesta válida)\n");
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
        // Condición de salida del programa
        if (input.toLowerCase() === 'salir') {
            console.log("¡Hasta luego!");
            rl.close();
            return;
        }
        
        // Si el mensaje no está vacío, procesamos la consulta
        if (input.trim() !== '') {
            await preguntarJarvis(input);
        }
        
        // Llamada recursiva para el siguiente turno
        iniciarChat();
    });
}

// Mensaje inicial de arranque del sistema
console.log("=== SISTEMA JARVIS (MEMORIA PERSISTENTE) INICIADO ===");
console.log("Escribe tu mensaje o 'salir' para terminar.\n");
iniciarChat();