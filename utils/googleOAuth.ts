export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

type GoogleTokenRequestInput = {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export const buildGoogleTokenRequestBody = ({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: GoogleTokenRequestInput) => new URLSearchParams({
  code,
  client_id: clientId,
  client_secret: clientSecret,
  redirect_uri: redirectUri,
  grant_type: 'authorization_code',
});

export const getOAuthErrorSummary = (error: any) => ({
  code: error?.code,
  message: error?.message,
  status: error?.response?.status,
  providerError: error?.response?.data?.error,
  providerDescription: error?.response?.data?.error_description,
});
