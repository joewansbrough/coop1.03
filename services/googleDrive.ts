import { google } from 'googleapis';

const getAuthClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);

    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
};

export const driveClient = () => {
    const auth = getAuthClient();
    return google.drive({ version: 'v3', auth });
};