import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';
import open from 'open';
import fetch from 'node-fetch';

dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const TOKEN_FILE = path.join(process.cwd(), 'spotify_tokens.json');

let accessToken = null;
let refreshToken = null;
let tokenExpirationTime = 0;

function guardarTokensLocalmente(data) {
    const tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_at: Date.now() + (data.expires_in * 1000)
    };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    tokenExpirationTime = tokens.expires_at;
}

function cargarTokensLocales() {
    if (fs.existsSync(TOKEN_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            tokenExpirationTime = data.expires_at;
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

async function refrescarAccessToken() {
    if (!refreshToken) throw new Error("No hay refresh_token disponible.");

    const bodyParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`
        },
        body: bodyParams.toString()
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Error renovando token: ${data.error_description || data.error}`);
    }

    guardarTokensLocalmente(data);
}

export async function autenticarSpotify() {
    if (cargarTokensLocales()) {
        if (Date.now() < tokenExpirationTime) return;
        try {
            await refrescarAccessToken();
            return;
        } catch (e) {
            console.log("[SPOTIFY]: Refresh token expirado. Reautenticando...");
        }
    }

    return new Promise((resolve, reject) => {
        const scopes = [
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing'
        ].join(' ');

        const authUrl = `https://accounts.spotify.com/authorize?` + new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: 'code',
            redirect_uri: REDIRECT_URI,
            scope: scopes
        }).toString();

        const server = http.createServer(async (req, res) => {
            const reqUrl = new URL(req.url, `http://127.0.0.1:8888`);
            if (reqUrl.pathname === '/callback') {
                const code = reqUrl.searchParams.get('code');
                const error = reqUrl.searchParams.get('error');

                if (error) {
                    res.end('<h1>Error en la autorizacion</h1>');
                    server.close();
                    return reject(new Error(error));
                }

                res.end('<h1>Autenticado con exito. Puedes cerrar esta ventana.</h1>');
                server.close();

                try {
                    const bodyParams = new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: REDIRECT_URI
                    });

                    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

                    const response = await fetch('https://accounts.spotify.com/api/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': `Basic ${authHeader}`
                        },
                        body: bodyParams.toString()
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error_description || data.error);

                    guardarTokensLocalmente(data);
                    console.log("[SPOTIFY]: Autenticación completada con éxito.");
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }
        });

        server.listen(8888, async () => {
            console.log(`[SPOTIFY]: Autoriza el acceso en el navegador:\n${authUrl}`);
            await open(authUrl);
        });
    });
}

async function obtenerAccessTokenValido() {
    if (!accessToken || Date.now() >= tokenExpirationTime - 60000) {
        if (refreshToken) {
            await refrescarAccessToken();
        } else {
            await autenticarSpotify();
        }
    }
    return accessToken;
}

// Función auxiliar para obtener el ID del dispositivo (Priorizando Computer)
async function obtenerDispositivoObjetivo(token) {
    const devRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const devData = await devRes.json();
    const devices = devData?.devices || [];

    if (devices.length === 0) return null;

    // Prioriza siempre un ordenador ('Computer'), si no, un dispositivo activo, o el primero de la lista
    const target = devices.find(d => d.type.toLowerCase() === 'computer')
                || devices.find(d => d.is_active)
                || devices[0];

    return target ? target.id : null;
}

// 1. Reproducir o Buscar Canción
export async function reproducirSpotify(busqueda) {
    try {
        if (!busqueda || busqueda.trim() === '') {
            return JSON.stringify({ exito: false, error: "Debes indicar una canción o artista." });
        }

        const token = await obtenerAccessTokenValido();
        const deviceId = await obtenerDispositivoObjetivo(token);

        if (!deviceId) {
            return JSON.stringify({ 
                exito: false, 
                error: "No hay dispositivos de Spotify abiertos. Abre Spotify en tu ordenador e inténtalo de nuevo." 
            });
        }

        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(busqueda)}&type=track&limit=1`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const searchData = await searchRes.json();
        const track = searchData?.tracks?.items?.[0];

        if (!track) {
            return JSON.stringify({ exito: false, error: `No se encontró ninguna canción para: "${busqueda}".` });
        }

        const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [track.uri] })
        });

        if (playRes.ok || playRes.status === 204) {
            return JSON.stringify({
                exito: true,
                mensaje: `Sonando: "${track.name}" de ${track.artists.map(a => a.name).join(', ')}`,
                cancion: track.name,
                artista: track.artists.map(a => a.name).join(', ')
            });
        }

        return JSON.stringify({ exito: false, error: "Spotify no pudo iniciar la reproducción en el dispositivo." });

    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

// 2. Pasar a la Siguiente Canción
export async function siguienteCancionSpotify() {
    try {
        const token = await obtenerAccessTokenValido();
        const deviceId = await obtenerDispositivoObjetivo(token);

        if (!deviceId) {
            return JSON.stringify({ exito: false, error: "No hay dispositivos de Spotify disponibles." });
        }

        const res = await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok || res.status === 204) {
            return JSON.stringify({ exito: true, mensaje: "Pasando a la siguiente canción." });
        }
        return JSON.stringify({ exito: false, error: "No se pudo cambiar de canción." });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}

// 3. Volver a la Canción Anterior
export async function anteriorCancionSpotify() {
    try {
        const token = await obtenerAccessTokenValido();
        const deviceId = await obtenerDispositivoObjetivo(token);

        if (!deviceId) {
            return JSON.stringify({ exito: false, error: "No hay dispositivos de Spotify disponibles." });
        }

        const res = await fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${deviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok || res.status === 204) {
            return JSON.stringify({ exito: true, mensaje: "Volviendo a la canción anterior." });
        }
        return JSON.stringify({ exito: false, error: "No se pudo volver a la canción anterior." });
    } catch (error) {
        return JSON.stringify({ exito: false, error: error.message });
    }
}