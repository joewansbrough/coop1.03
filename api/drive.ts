import { Router, Request, Response } from 'express';
import { Readable } from 'stream';
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
    } catch (error: any) {
        console.error('🚨 DRIVE ROOT ERROR FULL:', error);

        res.status(500).json({
            error: error.message,
            details: error?.response?.data || error,
        });
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

// Add these imports at the top (after existing imports)
import { Readable } from 'stream';

// ─── Add these three routes before `export default router` ───────────────────

// Get metadata for a single file
router.get('/files/:fileId', async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const drive = driveClient();

        // Reuse the existing root-check helper
        const file = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, modifiedTime, parents, webViewLink, iconLink',
        });

        // Verify it lives under the root
        const parents = file.data.parents ?? [];
        const allowed = fileId === ROOT_FOLDER_ID ||
            await isFolderWithinRoot(parents[0] ?? '');
        if (!allowed) {
            return res.status(403).json({ error: 'File is outside the allowed directory' });
        }

        res.json(file.data);
    } catch (error) {
        console.error('Drive file metadata error:', error);
        res.status(500).json({ error: 'Failed to fetch file metadata' });
    }
});

// Download / stream a file
// Google Workspace files are exported (Docs→PDF, Sheets→XLSX, Slides→PDF)
// All other files are streamed as-is
router.get('/files/:fileId/download', async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const drive = driveClient();

        const meta = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, parents',
        });

        const { name, mimeType, parents } = meta.data;

        const allowed = fileId === ROOT_FOLDER_ID ||
            await isFolderWithinRoot(parents?.[0] ?? '');
        if (!allowed) {
            return res.status(403).json({ error: 'File is outside the allowed directory' });
        }

        const EXPORT_MAP: Record<string, string> = {
            'application/vnd.google-apps.document': 'application/pdf',
            'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.google-apps.presentation': 'application/pdf',
        };

        const exportMime = mimeType ? EXPORT_MAP[mimeType] : undefined;

        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);

        if (exportMime) {
            res.setHeader('Content-Type', exportMime);
            const response = await drive.files.export(
                { fileId, mimeType: exportMime },
                { responseType: 'stream' }
            );
            (response.data as Readable).pipe(res);
        } else {
            res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');
            const response = await drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            (response.data as Readable).pipe(res);
        }
    } catch (error) {
        console.error('Drive download error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Search files by name or full-text (restricted to files reachable from root)
router.get('/search', async (req: Request, res: Response) => {
    try {
        const term = (req.query.q as string)?.trim();
        if (!term) {
            return res.status(400).json({ error: "Query param 'q' is required" });
        }

        const drive = driveClient();
        const escaped = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        // We search the entire drive visible to the service account
        // and then filter results that are within the root tree.
        const response = await drive.files.list({
            q: `trashed = false and (name contains '${escaped}' or fullText contains '${escaped}')`,
            fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, parents)',
            pageSize: 100,
        });

        const allFiles = response.data.files ?? [];
        const filteredFiles = [];

        // Filter files that belong to the co-op root tree
        for (const file of allFiles) {
            const isInside = await isFolderWithinRoot(file.id);
            if (isInside) {
                filteredFiles.push(file);
            }
        }

        res.json({
            files: filteredFiles,
            nextPageToken: null, // Filtering breaks simple pagination
        });
    } catch (error: any) {
        console.error('Drive search error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;