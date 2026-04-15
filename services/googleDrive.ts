import { google } from 'googleapis';

const getAuthClient = () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
    }

    let cleaned = raw;

    // Handle double-stringified JSON (common in some env setups)
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        try {
            cleaned = JSON.parse(cleaned);
        } catch (e) {
            // If it's not actually a JSON string, keep it as is
        }
    }

    let credentials;
    try {
        credentials = JSON.parse(cleaned);
    } catch (e: any) {
        // If parsing fails, it might be due to escaped newlines that were intended to be literal.
        // We try one fallback, but the post-parse fix is generally better.
        try {
            credentials = JSON.parse(cleaned.replace(/\\n/g, '\n'));
        } catch (e2) {
            throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: ${e.message}`);
        }
    }

    // Google Auth requires the private_key to have actual newlines.
    // Sometimes they remain as literal '\n' strings after JSON.parse if double-escaped.
    if (credentials && typeof credentials.private_key === 'string') {
        credentials.private_key = credentials.private_key
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r');
    }

    if (credentials && credentials.client_email) {
        console.log(`[Drive] Using service account: ${credentials.client_email}`);
    }

    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
};

export const driveClient = () => {
    const auth = getAuthClient();
    return google.drive({ version: 'v3', auth });
};