import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';
dotenv.config();

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'llama3';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function preguntarJarvis(prompt) {
    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false
            })
        });

        const data = await response.json();
        console.log(`\n[JARVIS]: ${data.response}\n`);
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
        await preguntarJarvis(input);
        iniciarChat();
    });
}

console.log("=== SISTEMA JARVIS INICIADO ===");
console.log("Escribe tu mensaje o 'salir' para terminar.\n");
iniciarChat();