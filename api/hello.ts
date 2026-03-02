import { VercelRequest, VercelResponse } from '@vercel/node';

export default function (req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ message: 'Hello from Vercel Functions!' });
}
