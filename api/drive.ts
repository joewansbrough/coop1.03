import { Router, Request, Response } from 'express';
import { driveClient } from '../services/googleDrive.js';

const router = Router();
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

// List contents of a folder
router.get('/folders/:folderId/contents', async (req: Request, res: Response) => {
    try {
        const { folderId } = req.params;

        // Security: ensure the requested folder is within the allowed root
        // (prevents browsing outside the co-op folder)
        const isAllowed = await isFolderWithinRoot(folderId);
        if (!isAllowed) {
            return res.status(403).json({ error: 'Folder is outside the allowed directory' });
        }

        const drive = driveClient();
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
            orderBy: 'folder,name',
            pageSize: 200,
        });

        const files = response.data.files || [];

        // Separate folders and files for cleaner frontend rendering
        const result = {
            folders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
            files: files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'),
        };

        res.json(result);
    } catch (error) {
        console.error('Drive folder list error:', error);
        res.status(500).json({ error: 'Failed to fetch folder contents' });
    }
});

// Get breadcrumb path for a folder
router.get('/folders/:folderId/path', async (req: Request, res: Response) => {
    try {
        const { folderId } = req.params;
        const drive = driveClient();
        const path: { id: string; name: string }[] = [];

        let currentId = folderId;

        // Walk up the parent chain until we hit the root folder
        while (currentId && currentId !== ROOT_FOLDER_ID) {
            const file = await drive.files.get({
                fileId: currentId,
                fields: 'id, name, parents',
            });

            path.unshift({ id: file.data.id!, name: file.data.name! });

            const parents = file.data.parents;
            currentId = parents ? parents[0] : null;
        }

        // Prepend the root
        const rootFile = await drive.files.get({
            fileId: ROOT_FOLDER_ID,
            fields: 'id, name',
        });
        path.unshift({ id: rootFile.data.id!, name: rootFile.data.name! });

        res.json({ path });
    } catch (error) {
        console.error('Drive path error:', error);
        res.status(500).json({ error: 'Failed to resolve folder path' });
    }
});

// Root folder contents (convenience route)
router.get('/root', async (_req: Request, res: Response) => {
    try {
        const drive = driveClient();
        const response = await drive.files.list({
            q: `'${ROOT_FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
            orderBy: 'folder,name',
            pageSize: 200,
        });

        const files = response.data.files || [];

        res.json({
            rootId: ROOT_FOLDER_ID,
            folders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
            files: files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'),
        });
    } catch (error) {
        console.error('Drive root error:', error);
        res.status(500).json({ error: 'Failed to fetch root folder' });
    }
});

// Helper: verify a folder is a descendant of ROOT_FOLDER_ID
async function isFolderWithinRoot(folderId: string): Promise<boolean> {
    if (folderId === ROOT_FOLDER_ID) return true;

    const drive = driveClient();
    let currentId = folderId;

    try {
        while (currentId) {
            const file = await drive.files.get({
                fileId: currentId,
                fields: 'id, parents',
            });

            const parents = file.data.parents;
            if (!parents || parents.length === 0) return false;
            if (parents.includes(ROOT_FOLDER_ID)) return true;

            currentId = parents[0];
        }
    } catch {
        return false;
    }

    return false;
}

export default router;