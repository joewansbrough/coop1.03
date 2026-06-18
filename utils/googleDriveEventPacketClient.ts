export const buildGoogleDrivePacketFetchInit = ({
  method = 'GET',
  demoMode = false,
  jsonBody,
}: {
  method?: string;
  demoMode?: boolean;
  jsonBody?: unknown;
}): RequestInit => {
  const headers: Record<string, string> = {};
  if (demoMode) headers['x-coophub-demo-mode'] = 'true';
  if (jsonBody !== undefined) headers['Content-Type'] = 'application/json';

  return {
    method,
    credentials: 'include',
    headers,
    ...(jsonBody !== undefined ? { body: JSON.stringify(jsonBody) } : {}),
  };
};
