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