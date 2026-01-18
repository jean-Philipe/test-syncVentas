/**
 * Cliente de Prisma singleton para reutilizar la conexión
 */

const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getPrismaClient() {
    if (!prisma) {
        prisma = new PrismaClient({
            // Solo errores y warnings, sin queries
            log: ['error', 'warn'],
        });
    }
    return prisma;
}

// Cerrar conexión al terminar la aplicación
if (typeof process !== 'undefined') {
    process.on('beforeExit', async () => {
        if (prisma) {
            await prisma.$disconnect();
        }
    });
}

module.exports = {
    getPrismaClient,
    prisma: getPrismaClient()
};
