import { google } from 'googleapis';

const getAuthClient = () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
    }

    const credentials = JSON.parse(
        raw.replace(/\\n/g, '\n')
    );

    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
};

export const driveClient = () => {
    const auth = getAuthClient();
    return google.drive({ version: 'v3', auth });
};