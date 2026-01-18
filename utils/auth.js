/**
 * Utilidades para autenticación con Manager+
 */

const axios = require('axios');

// Variables de entorno
const ERP_BASE_URL = process.env.ERP_BASE_URL;
const ERP_USERNAME = process.env.ERP_USERNAME;
const ERP_PASSWORD = process.env.ERP_PASSWORD;

// Cache del token
let authToken = null;
let tokenExpirationTime = null;

// Lock para evitar autenticaciones paralelas
let authPromise = null;

/**
 * Autenticarse con el ERP Manager+
 */
async function authenticateWithERP() {
    try {
        console.log('🔐 Autenticando con Manager+...');

        const response = await axios.post(`${ERP_BASE_URL}/auth/`, {
            username: ERP_USERNAME,
            password: ERP_PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        authToken = response.data.auth_token;
        tokenExpirationTime = Date.now() + (60 * 60 * 1000); // 1 hora

        console.log('✅ Autenticación exitosa\n');
        return authToken;

    } catch (error) {
        console.error('❌ Error en la autenticación:', error.response?.data || error.message);
        throw new Error('Error al autenticarse con el ERP: ' + (error.response?.data?.message || error.message));
    }
}

/**
 * Obtener el token de autenticación (con caché y lock para peticiones paralelas)
 */
async function getAuthToken() {
    // Si hay token válido en caché, usarlo
    if (authToken && tokenExpirationTime && Date.now() < tokenExpirationTime) {
        return authToken;
    }

    // Si ya hay una autenticación en progreso, esperar a que termine
    if (authPromise) {
        return await authPromise;
    }

    // Iniciar autenticación y guardar la promesa
    authPromise = authenticateWithERP();

    try {
        const token = await authPromise;
        return token;
    } finally {
        // Limpiar el lock cuando termine (exitoso o con error)
        authPromise = null;
    }
}

/**
 * Obtener headers de autorización
 */
async function getAuthHeaders() {
    const token = await getAuthToken();
    return {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
    };
}

module.exports = {
    authenticateWithERP,
    getAuthToken,
    getAuthHeaders
};
