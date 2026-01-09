/**
 * Utilidades para logging con formato
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    const colorCode = colors[color] || colors.reset;
    console.log(`${colorCode}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(`  ${title}`, 'bright');
    console.log('='.repeat(60) + '\n');
}

function logProgress(current, total, item = 'items') {
    const percentage = Math.round((current / total) * 100);
    process.stdout.write(`\r   Progreso: ${current}/${total} (${percentage}%) - ${item}`);
    if (current === total) {
        process.stdout.write('\n');
    }
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

module.exports = {
    log,
    logSection,
    logProgress,
    logSuccess,
    logError,
    logWarning,
    logInfo
};
