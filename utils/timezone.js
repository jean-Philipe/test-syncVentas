const { formatInTimeZone } = require('date-fns-tz');

const TIMEZONE = 'America/Santiago';

function getChileDate() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
}

function formatChileDate(date, pattern) {
    return formatInTimeZone(date, TIMEZONE, pattern);
}

module.exports = {
    TIMEZONE,
    getChileDate,
    formatChileDate
};
