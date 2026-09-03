import fs from 'fs';
import path from 'path';

/**
 * HERRAMIENTA LOCAL: Lista los archivos de una ruta específica o del proyecto por defecto.
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
 * HERRAMIENTA LOCAL: Lee el contenido de un archivo de texto en una ruta específica.
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
 * HERRAMIENTA LOCAL: Crea o sobreescribe un archivo de texto en la ruta especificada.
 */
export function escribirArchivoLocal(filePath, contenido) {
    try {
        if (!filePath || filePath.trim() === '') {
            return JSON.stringify({ exito: false, error: "No se ha proporcionado una ruta de archivo válida." });
        }

        const targetPath = path.resolve(filePath.trim());
        const dir = path.dirname(targetPath);

        // Si la carpeta contenedora no existe, la creamos automáticamente
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(targetPath, contenido || '', 'utf8');
        return JSON.stringify({ exito: true, ruta: targetPath });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}