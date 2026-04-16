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
    // This error will be caught by the Express server startup, which should be handled gracefully.
    console.error('Error: GOOGLE_DRIVE_ROOT_FOLDER_IDS or GOOGLE_DRIVE_ROOT_FOLDER_ID must be set in environment variables.');
    // Depending on server setup, this might crash the server. A more robust solution might involve
    // a default empty array and letting the UI handle no roots, or a more explicit error response.
    // For now, we'll log and assume it will be caught.
}

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
        let rootFound = false;

        // First, check if the folderId itself is one of the roots.
        if (ROOT_FOLDER_IDS.includes(folderId)) {
            const rootFile = await drive.files.get({
                fileId: folderId,
                fields: 'id, name',
            });
            return res.json({ path: [{ id: rootFile.data.id!, name: rootFile.data.name! }] });
        }

        // Walk up the parent chain until we hit any of the root folders
        while (currentId) {
            const file = await drive.files.get({
                fileId: currentId,
                fields: 'id, name, parents',
            });

            // If we found a root folder, add it to the path and stop traversal.
            if (ROOT_FOLDER_IDS.includes(file.data.id!)) {
                path.unshift({ id: file.data.id!, name: file.data.name! });
                rootFound = true;
                break;
            }
            
            path.unshift({ id: file.data.id!, name: file.data.name! });

            const parents = file.data.parents;
            currentId = parents ? parents[0] : null;
        }

        // If no root was found during traversal, the folder is not under any of the allowed roots.
        if (!rootFound) {
            return res.status(403).json({ error: 'Folder is outside the allowed directory' });
        }

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
        let allFolders: any[] = [];
        let allFiles: any[] = [];
        const rootDetails: { id: string; name: string }[] = []; // New array to store root details

        // Fetch details for each root folder first
        for (const rootId of ROOT_FOLDER_IDS) {
            try {
                const rootFileMeta = await drive.files.get({
                    fileId: rootId,
                    fields: 'id, name',
                });
                if (rootFileMeta.data.name) {
                    rootDetails.push({ id: rootId, name: rootFileMeta.data.name });
                } else {
                    // Provide a fallback name if the root folder has no name (should not happen for valid IDs)
                    rootDetails.push({ id: rootId, name: 'Unnamed Root Folder' });
                }
            } catch (rootError: any) {
                console.warn(`Could not fetch details for root folder ${rootId}:`, rootError.message);
                // Indicate an error in fetching the name for this root
                rootDetails.push({ id: rootId, name: `Error fetching root ${rootId}` });
            }
        }

        // Fetch contents for each root folder
        for (const rootId of ROOT_FOLDER_IDS) {
            const response = await drive.files.list({
                q: `'${rootId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
                orderBy: 'folder,name',
                pageSize: 200,
            });

            const currentRootFiles = response.data.files || [];
            allFolders.push(...currentRootFiles.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder'));
            allFiles.push(...currentRootFiles.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder'));
        }

        res.json({
            rootIds: ROOT_FOLDER_IDS,
            rootDetails: rootDetails, // Include root names
            folders: allFolders,
            files: allFiles,
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
async function isFolderWithinRoot(folderId: string, rootIds: string[]): Promise<boolean> {
    if (!rootIds || rootIds.length === 0) return false; // No roots configured

    if (rootIds.includes(folderId)) return true; // Check if the current folder is one of the roots

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
            
            // Check if any parent is one of the allowed roots
            if (parents.some(parent => rootIds.includes(parent))) return true;

            currentId = parents[0]; // Move up to the next parent
        }
    } catch {
        // If file.get fails, it's likely not accessible or doesn't exist, so not within root.
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

        const file = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, modifiedTime, parents, webViewLink, iconLink',
        });

        // Verify it lives under any of the roots
        const parents = file.data.parents ?? [];
        // Check if the fileId is one of the roots, or if its parent is within any root.
        const allowed = ROOT_FOLDER_IDS.includes(fileId) || await isFolderWithinRoot(parents[0] ?? '', ROOT_FOLDER_IDS);
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

        // Verify it lives under any of the roots
        const allowed = ROOT_FOLDER_IDS.includes(fileId) || await isFolderWithinRoot(parents?.[0] ?? '', ROOT_FOLDER_IDS);
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
            // Pass ROOT_FOLDER_IDS to the helper function
            const isInside = await isFolderWithinRoot(file.id, ROOT_FOLDER_IDS);
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