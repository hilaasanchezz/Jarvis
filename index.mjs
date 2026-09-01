import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';
dotenv.config();

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL_NAME = 'llama3';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Historial para almacenar la memoria de la conversación
const history = [
    { 
        role: 'system', 
        content: 'Eres Jarvis, un asistente personal inteligente, leal y eficiente. Mantienes el contexto de la conversación.' 
    }
];

async function preguntarJarvis(userInput) {
    // Añadimos el mensaje del usuario al historial
    history.push({ role: 'user', content: userInput });

    try {
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
            const botReply = data.message.content;
            console.log(`\n[JARVIS]: ${botReply}\n`);
            // Añadimos la respuesta de Jarvis al historial para mantener el hilo
            history.push({ role: 'assistant', content: botReply });
        } else {
            console.log("\n[JARVIS]: (No se recibió respuesta válida)\n");
        }

    } catch (error) {
        console.error("Error conectando con Ollama:", error.message);
    }
}

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

console.log("=== SISTEMA JARVIS (CON MEMORIA) INICIADO ===");
console.log("Escribe tu mensaje o 'salir' para terminar.\n");
iniciarChat();