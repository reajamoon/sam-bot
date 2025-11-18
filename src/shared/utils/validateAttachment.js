// Attachment validation utility for recommendations
// Returns null if valid, or an error message string if invalid

const ALLOWED_TYPES = [
    'text/plain',
    'application/pdf',
    'application/epub+zip',
    'application/x-mobipocket-ebook',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/rtf'
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function validateAttachment(attachment, willBeDeleted) {
    if (!willBeDeleted) {
        return 'File attachments are only for stories that have been deleted from their original sites. Mark it as deleted first.';
    }
    if (!ALLOWED_TYPES.includes(attachment.contentType)) {
        return 'Unsupported file type. Only text files, PDFs, EPUBs, and similar formats are allowed.';
    }
    if (attachment.size > MAX_SIZE) {
        return 'File size exceeds 10MB limit.';
    }
    return null;
}

module.exports = {
    validateAttachment,
    ALLOWED_TYPES,
    MAX_SIZE
};
