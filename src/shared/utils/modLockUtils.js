/**
 * Set or unset a mod-lock on a Recommendation field.
 * @param {object} rec - The Recommendation instance (Sequelize or plain object).
 * @param {string} field - The field to lock (e.g., 'Title', 'Tags').
 * @param {boolean} value - true to lock, false to unlock.
 */
function setModLock(rec, field, value) {
    const lockField = `modLocked${field.charAt(0).toUpperCase() + field.slice(1)}`;
    rec[lockField] = value;
}

module.exports = {
    setModLock,
};
