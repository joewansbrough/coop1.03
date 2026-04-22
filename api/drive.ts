import { Router, Request, Response } from 'express';
import { Readable } from 'stream';
import { driveClient } from '../services/googleDrive.js';

const router = Router();
const ROOT_FOLDER_IDS_STR = process.env.GOOGLE_DRIVE_ROOT_FOLDER_IDS;
let ROOT_FOLDER_IDS: string[] = [];

if (ROOT_FOLDER_IDS_STR) {
    ROOT_FOLDER_IDS = ROOT_FOLDER_IDS_STR.split(',').map(id => id.trim()).filter(id => id);
} else {
    const singleRootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (singleRootId) {
        ROOT_FOLDER_IDS.push(singleRootId.trim());
    }
}

if (ROOT_FOLDER_IDS.length === 0) {
    console.error('Error: GOOGLE_DRIVE_ROOT_FOLDER_IDS or GOOGLE_DRIVE_ROOT_FOLDER_ID must be set in environment variables.');
}

const getParam = (value: string | string[] | undefined): string => Array.isArray(value) ? value[0] ?? '' : value ?? '';

// ─── Helper: verify a folder is a descendant of any configured root ──────────

async function isFolderWithinRoot(folderId: string, cache?: Map<string, boolean>): Promise<boolean> {
    if (ROOT_FOLDER_IDS.length === 0) return false;
    if (ROOT_FOLDER_IDS.includes(folderId)) return true;
    if (cache?.has(folderId)) return cache.get(folderId)!;

    const drive = driveClient();
    let currentId = folderId;
    const visited: string[] = [];

    try {
        while (currentId) {
            visited.push(currentId);
            const file = await drive.files.get({
                fileId: currentId,
                fields: 'id, parents',
                supportsAllDrives: true,
            });

            const parents = file.data.parents;
            if (!parents || parents.length === 0) break;
            if (parents.some(parent => ROOT_FOLDER_IDS.includes(parent))) {
                if (cache) visited.forEach(id => cache.set(id, true));
                return true;
            }

            currentId = parents[0];
            if (cache?.has(currentId)) {
                const result = cache.get(currentId)!;
                if (cache) visited.forEach(id => cache.set(id, result));
                return result;
            }
        }
    } catch {
        // Fall through to false
    }

    if (cache) visited.forEach(id => cache.set(id, false));
    return false;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Root folder contents
router.get('/root', async (_req: Request, res: Response) => {
    try {
        const drive = driveClient();
        let allFolders: any[] = [];
        let allFiles: any[] = [];
        const rootDetails: { id: string; name: string }[] = [];

        for (const rootId of ROOT_FOLDER_IDS) {
            try {
                const rootFileMeta = await drive.files.get({
                    fileId: rootId,
                    fields: 'id, name',
                    supportsAllDrives: true,
                });
                rootDetails.push({
                    id: rootId,
                    name: rootFileMeta.data.name ?? 'Unnamed Root Folder',
                });
            } catch (rootError: any) {
                console.warn(`Could not fetch details for root folder ${rootId}:`, rootError.message);
                rootDetails.push({ id: rootId, name: `Unnamed Folder` });
            }
        }

        for (const rootId of ROOT_FOLDER_IDS) {
            const response = await drive.files.list({
                q: `'${rootId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
                orderBy: 'folder,name',
                pageSize: 200,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            });

            const currentRootFiles = response.data.files || [];
            allFolders.push(...currentRootFiles.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder'));
            allFiles.push(...currentRootFiles.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder'));
        }

        res.json({
            rootIds: ROOT_FOLDER_IDS,
            rootDetails,
            folders: allFolders,
            files: allFiles,
        });
    } catch (error: any) {
        console.error('Drive root error:', error);
        res.status(500).json({ error: error.message, details: error?.response?.data || error });
    }
});

// List contents of a folder
router.get('/folders/:folderId/contents', async (req: Request, res: Response) => {
    try {
        const folderId = getParam(req.params.folderId);

        const isAllowed = await isFolderWithinRoot(folderId); // ✅ fixed: no longer missing ROOT_FOLDER_IDS arg
        if (!isAllowed) {
            return res.status(403).json({ error: 'Folder is outside the allowed directory' });
        }

        const drive = driveClient();
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
            orderBy: 'folder,name',
            pageSize: 200,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        const files = response.data.files || [];

        res.json({
            folders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
            files: files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'),
        });
    } catch (error) {
        console.error('Drive folder list error:', error);
        res.status(500).json({ error: 'Failed to fetch folder contents' });
    }
});

// Get breadcrumb path for a folder
router.get('/folders/:folderId/path', async (req: Request, res: Response) => {
    try {
        const folderId = getParam(req.params.folderId);
        const drive = driveClient();
        const path: { id: string; name: string }[] = [];
        let currentId: string | null = folderId;
        let rootFound = false;

        if (ROOT_FOLDER_IDS.includes(folderId)) {
            const rootFile = await drive.files.get({
                fileId: folderId,
                fields: 'id, name',
                supportsAllDrives: true,
            });
            return res.json({ path: [{ id: rootFile.data.id!, name: rootFile.data.name! }] });
        }

        while (currentId) {
            const file = await drive.files.get({
                fileId: currentId,
                fields: 'id, name, parents',
                supportsAllDrives: true,
            });

            if (ROOT_FOLDER_IDS.includes(file.data.id!)) {
                path.unshift({ id: file.data.id!, name: file.data.name! });
                rootFound = true;
                break;
            }

            path.unshift({ id: file.data.id!, name: file.data.name! });

            const parents = file.data.parents;
            currentId = parents ? parents[0] : null;
        }

        if (!rootFound) {
            return res.status(403).json({ error: 'Folder is outside the allowed directory' });
        }

        res.json({ path });
    } catch (error) {
        console.error('Drive path error:', error);
        res.status(500).json({ error: 'Failed to resolve folder path' });
    }
});

// Get metadata for a single file
router.get('/files/:fileId', async (req: Request, res: Response) => {
    try {
        const fileId = getParam(req.params.fileId);
        const drive = driveClient();

        const file = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, modifiedTime, parents, webViewLink, iconLink',
            supportsAllDrives: true,
        });

        const parents = file.data.parents ?? [];
        const allowed = ROOT_FOLDER_IDS.includes(fileId) || await isFolderWithinRoot(parents[0] ?? '');
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
router.get('/files/:fileId/download', async (req: Request, res: Response) => {
    try {
        const fileId = getParam(req.params.fileId);
        const drive = driveClient();

        const meta = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, parents',
            supportsAllDrives: true,
        });
        const { name, mimeType, parents } = meta.data;

        const allowed = ROOT_FOLDER_IDS.includes(fileId) || await isFolderWithinRoot(parents?.[0] ?? '');
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
            const response = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: 'stream' });
            (response.data as Readable).pipe(res);
        } else {
            res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');
            const response = await drive.files.get({
                fileId,
                alt: 'media',
                supportsAllDrives: true,
            }, { responseType: 'stream' });
            (response.data as Readable).pipe(res);
        }
    } catch (error) {
        console.error('Drive download error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Search files by name or full-text (restricted to configured roots)
router.get('/search', async (req: Request, res: Response) => {
    try {
        const term = (req.query.q as string)?.trim();
        if (!term) {
            return res.status(400).json({ error: "Query param 'q' is required" });
        }

        const drive = driveClient();
        const escaped = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const response = await drive.files.list({
            q: `trashed = false and (name contains '${escaped}' or fullText contains '${escaped}')`,
            fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, parents)',
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        const allFiles = response.data.files ?? [];
        const cache = new Map<string, boolean>();

        // Pre-populate cache with root files themselves if they show up in results
        ROOT_FOLDER_IDS.forEach(id => cache.set(id, true));

        // Process search results in parallel with ancestry checking
        const filterPromises = allFiles.map(async (file) => {
            if (!file.id) return null;

            // Immediate check: is it a root?
            if (ROOT_FOLDER_IDS.includes(file.id)) return file;

            // Immediate check: is its parent a root? (Already in response)
            if (file.parents?.some(p => ROOT_FOLDER_IDS.includes(p))) {
                cache.set(file.id, true);
                return file;
            }

            // Fallback: full ancestry check with cache
            const isInside = await isFolderWithinRoot(file.id, cache);
            return isInside ? file : null;
        });

        const results = await Promise.all(filterPromises);
        const filteredFiles = results.filter((f): f is any => f !== null);

        res.json({ files: filteredFiles, nextPageToken: null });
    } catch (error: any) {
        console.error('Drive search error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
