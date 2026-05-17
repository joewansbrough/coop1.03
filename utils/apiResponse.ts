export const readApiResponse = async <T = any>(res: Response): Promise<T> => {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();

  const text = await res.text().catch(() => '');
  const message = text.trim() || res.statusText || `Request failed with status ${res.status}`;
  throw new Error(message);
};
