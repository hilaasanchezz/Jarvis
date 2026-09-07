import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import yts from 'yt-search';
import { reproducirSpotify } from './spotify.mjs';

// Exportación unificada de la herramienta de Spotify
export { reproducirSpotify };

/**
 * HERRAMIENTA LOCAL: Ejecuta un comando en la consola del sistema (PowerShell/CMD).
 */
export function ejecutarComandoLocal(comando) {
    return new Promise((resolve) => {
        if (!comando) {
            return resolve(JSON.stringify({ exito: false, error: "No se proporcionó ningún comando." }));
        }

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
 * HERRAMIENTA LOCAL: Lista los archivos de una ruta específica o del directorio actual.
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
 * HERRAMIENTA LOCAL: Lee el contenido completo de un archivo de texto plano.
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
 * HERRAMIENTA LOCAL: Crea un nuevo archivo de texto o sobreescribe uno existente.
 */
export function escribirArchivoLocal(filePath, contenido) {
    try {
        if (!filePath || filePath.trim() === '') {
            return JSON.stringify({ exito: false, error: "No se ha proporcionado una ruta de archivo válida." });
        }

        const targetPath = path.resolve(filePath.trim());
        const dir = path.dirname(targetPath);

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

        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
            const nombreElemento = path.basename(source);
            target = path.join(target, nombreElemento);
        } else {
            const targetDir = path.dirname(target);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
        }

        fs.renameSync(source, target);
        return JSON.stringify({ exito: true, origen: source, destino: target });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

/**
 * HERRAMIENTA LOCAL: Crea un directorio o carpeta en la ruta especificada.
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
                // Ignorar carpetas del sistema o restringidas
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

/**
 * HERRAMIENTA LOCAL: Abre un programa, URL, archivo o carpeta en la interfaz gráfica.
 */
export function abrirAplicacionLocal(objetivo) {
    return new Promise((resolve) => {
        if (!objetivo) {
            return resolve(JSON.stringify({ exito: false, error: "No se especificó qué abrir." }));
        }

        const comando = `powershell -Command "Start-Process '${objetivo.trim()}'"`;

        exec(comando, { timeout: 10000 }, (error) => {
            if (error) {
                return resolve(JSON.stringify({ exito: false, error: error.message }));
            }
            resolve(JSON.stringify({ exito: true, mensaje: `Abierto con éxito: ${objetivo}` }));
        });
    });
}

/**
 * HERRAMIENTA LOCAL: Busca un vídeo/canción en YouTube y lo abre en el navegador.
 */
export async function reproducirMusicaLocal(busqueda) {
    try {
        if (!busqueda) return JSON.stringify({ exito: false, error: "Falta término de búsqueda." });

        const r = await yts(busqueda);
        const videos = r.videos;

        if (!videos || videos.length === 0) {
            return JSON.stringify({ exito: false, error: "No se encontraron vídeos." });
        }

        const primerVideoUrl = videos[0].url;
        const titulo = videos[0].title;

        const comando = `powershell -Command "Start-Process '${primerVideoUrl}'"`;
        
        return new Promise((resolve) => {
            exec(comando, { timeout: 10000 }, (error) => {
                if (error) return resolve(JSON.stringify({ exito: false, error: error.message }));
                resolve(JSON.stringify({ exito: true, titulo, url: primerVideoUrl }));
            });
        });
    } catch (err) {
        return JSON.stringify({ exito: false, error: err.message });
    }
}