import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * HERRAMIENTA LOCAL: Ejecuta un comando en la consola del sistema (PowerShell/CMD).
 * 
 * @param {string} comando - El comando de terminal a ejecutar.
 * @returns {Promise<string>} Promesa que resuelve con el resultado en formato JSON.
 */
export function ejecutarComandoLocal(comando) {
    return new Promise((resolve) => {
        if (!comando) {
            return resolve(JSON.stringify({ exito: false, error: "No se proporcionó ningún comando." }));
        }

        // Ejecutamos el comando con un timeout de seguridad de 15 segundos
        exec(comando.trim(), { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                return resolve(JSON.stringify({ 
                    exito: false, 
                    error: error.message, 
                    stderr: stderr ? stderr.trim() : null 
                }));
            }

            resolve(JSON.stringify({ 
                exito: true, 
                salida: stdout ? stdout.trim() : "Comando ejecutado sin salida de texto." 
            }));
        });
    });
}

/**
 * HERRAMIENTA LOCAL: Lista los archivos de una ruta específica o del directorio de trabajo actual por defecto.
 * 
 * @param {string} dirPath - Ruta del directorio a inspeccionar.
 * @returns {string} Resultado en formato JSON con la ruta resuelta y la lista de archivos, o el error correspondiente.
 */
export function listarDirectorioLocal(dirPath) {
    try {
        const targetPath = (!dirPath || dirPath.trim() === '') 
            ? process.cwd() 
            : path.resolve(dirPath);
            
        const archivos = fs.readdirSync(targetPath);
        return JSON.stringify({ exito: true, ruta: targetPath, contenido: archivos });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

/**
 * HERRAMIENTA LOCAL: Lee el contenido completo de un archivo de texto plano en la ruta especificada.
 * 
 * @param {string} filePath - Ruta absoluta o relativa del archivo a leer.
 * @returns {string} Resultado en formato JSON con la ruta resuelta y el texto del archivo, o el error si no existe.
 */
export function leerArchivoLocal(filePath) {
    try {
        if (!filePath || filePath.trim() === '') {
            return JSON.stringify({ exito: false, error: "No se ha proporcionado una ruta de archivo válida." });
        }

        const targetPath = path.resolve(filePath.trim());
        
        if (!fs.existsSync(targetPath)) {
            return JSON.stringify({ exito: false, error: "El archivo especificado no existe." });
        }

        const contenido = fs.readFileSync(targetPath, 'utf8');
        return JSON.stringify({ exito: true, ruta: targetPath, contenido: contenido });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

/**
 * HERRAMIENTA LOCAL: Crea un nuevo archivo de texto o sobreescribe uno existente en la ruta especificada.
 * Si las carpetas del directorio padre no existen, se crean de forma recursiva automáticamente.
 * 
 * @param {string} filePath - Ruta de destino del archivo.
 * @param {string} contenido - Texto que se escribirá dentro del archivo.
 * @returns {string} Resultado en formato JSON con el estado de la operación y la ruta final.
 */
export function escribirArchivoLocal(filePath, contenido) {
    try {
        if (!filePath || filePath.trim() === '') {
            return JSON.stringify({ exito: false, error: "No se ha proporcionado una ruta de archivo válida." });
        }

        const targetPath = path.resolve(filePath.trim());
        const dir = path.dirname(targetPath);

        // Si la carpeta contenedora no existe, la creamos de forma recursiva
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(targetPath, contenido || '', 'utf8');
        return JSON.stringify({ exito: true, ruta: targetPath });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

/**
 * HERRAMIENTA LOCAL: Mueve o renombra un archivo o directorio.
 * Maneja automáticamente casos donde el destino es una carpeta existente
 * añadiendo el nombre del archivo/directorio de origen.
 * 
 * @param {string} origenPath - Ruta del archivo o carpeta original.
 * @param {string} destinoPath - Ruta de destino o carpeta de destino.
 * @returns {string} Resultado en formato JSON.
 */
export function moverArchivoLocal(origenPath, destinoPath) {
    try {
        if (!origenPath || !destinoPath) {
            return JSON.stringify({ exito: false, error: "Rutas de origen y destino requeridas." });
        }

        const source = path.resolve(origenPath.trim());
        let target = path.resolve(destinoPath.trim());

        if (!fs.existsSync(source)) {
            return JSON.stringify({ exito: false, error: `El archivo o carpeta de origen no existe: ${source}` });
        }

        // Si el destino es un directorio existente, concatenamos el nombre del elemento de origen
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
            const nombreElemento = path.basename(source);
            target = path.join(target, nombreElemento);
        } else {
            // Aseguramos que la carpeta padre del destino exista
            const targetDir = path.dirname(target);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
        }

        // Ejecutamos el movimiento/renombrado
        fs.renameSync(source, target);

        return JSON.stringify({ exito: true, origen: source, destino: target });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

/**
 * HERRAMIENTA LOCAL: Crea un directorio o carpeta en la ruta especificada.
 * Si las carpetas padre no existen, se crean de forma recursiva.
 * 
 * @param {string} dirPath - Ruta del directorio a crear.
 * @returns {string} Resultado en formato JSON indicando la ruta resuelta.
 */
export function crearCarpetaLocal(dirPath) {
    try {
        if (!dirPath || dirPath.trim() === '') {
            return JSON.stringify({ exito: false, error: "Ruta de directorio no proporcionada." });
        }

        const targetPath = path.resolve(dirPath.trim());
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        return JSON.stringify({ exito: true, ruta: targetPath });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

/**
 * HERRAMIENTA LOCAL: Busca archivos recursivamente dentro de un directorio.
 * 
 * @param {string} directorioBase - Ruta donde iniciar la búsqueda.
 * @param {string} patron - Texto o extensión a buscar (ej: ".pdf", "proyecto", "notas").
 * @returns {Promise<string>} Resultado en JSON con la lista de rutas encontradas.
 */
export async function buscarArchivosLocal(directorioBase, patron) {
    return new Promise((resolve) => {
        if (!directorioBase || !patron) {
            return resolve(JSON.stringify({ exito: false, error: "Faltan parámetros de búsqueda." }));
        }

        const resultados = [];
        const maxResultados = 20;

        function explorar(dir) {
            if (resultados.length >= maxResultados) return;

            try {
                const elementos = fs.readdirSync(dir, { withFileTypes: true });

                for (const el of elementos) {
                    if (resultados.length >= maxResultados) break;

                    const rutaCompleta = path.join(dir, el.name);

                    if (el.isDirectory()) {
                        // Evitamos carpetas pesadas o del sistema
                        if (!['node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information'].includes(el.name)) {
                            explorar(rutaCompleta);
                        }
                    } else if (el.isFile()) {
                        if (el.name.toLowerCase().includes(patron.toLowerCase())) {
                            resultados.push(rutaCompleta);
                        }
                    }
                }
            } catch (err) {
                // Ignoramos carpetas sin permisos de lectura
            }
        }

        explorar(directorioBase);

        resolve(JSON.stringify({
            exito: true,
            totalEncontrados: resultados.length,
            archivos: resultados
        }));
    });
}