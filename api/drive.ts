import { Router, Request, Response } from 'express';
import { Readable } from 'stream';
import { prisma } from '../lib/prisma.js';
import {
    getCooperativeDriveRootFolderIds,
    isFolderWithinDriveRoots,
} from '../services/cooperativeDriveRoots.js';
import { driveClient } from '../services/googleDrive.js';
import { canAccessDocument, hasPermission } from '../utils/rbac.js';

const router = Router();

const getParam = (value: string | string[] | undefined): string => Array.isArray(value) ? value[0] ?? '' : value ?? '';

// ─── Helper: verify a folder is a descendant of any configured root ──────────

const getRequestCooperativeId = (req: Request) => {
    const user = (req as any).user || (req as any).session?.user;
    return user?.selectedCooperativeId || user?.cooperativeId || '';
};

const getRequestRootFolderIds = async (req: Request, cooperativeId = getRequestCooperativeId(req)) =>
    getCooperativeDriveRootFolderIds(prisma as any, cooperativeId);

const isFolderWithinRoots = async (drive: any, rootFolderIds: string[], folderId: string, cache?: Map<string, boolean>) =>
    isFolderWithinDriveRoots(drive, rootFolderIds, folderId, cache);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Root folder contents
router.get('/root', async (req: Request, res: Response) => {
    try {
        const drive = driveClient();
        const rootFolderIds = await getRequestRootFolderIds(req);
        let allFolders: any[] = [];
        let allFiles: any[] = [];
        const rootDetails: { id: string; name: string }[] = [];

        for (const rootId of rootFolderIds) {
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

        for (const rootId of rootFolderIds) {
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
            rootIds: rootFolderIds,
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
        const drive = driveClient();
        const rootFolderIds = await getRequestRootFolderIds(req);

        const isAllowed = await isFolderWithinRoots(drive, rootFolderIds, folderId);
        if (!isAllowed) {
            return res.status(403).json({ error: 'Folder is outside the allowed directory' });
        }

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
        const rootFolderIds = await getRequestRootFolderIds(req);
        const path: { id: string; name: string }[] = [];
        let currentId: string | null = folderId;
        let rootFound = false;

        if (rootFolderIds.includes(folderId)) {
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

            if (rootFolderIds.includes(file.data.id!)) {
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
        const rootFolderIds = await getRequestRootFolderIds(req);

        const file = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, modifiedTime, parents, webViewLink, iconLink',
            supportsAllDrives: true,
        });

        const parents = file.data.parents ?? [];
        const allowed = rootFolderIds.includes(fileId) || await isFolderWithinRoots(drive, rootFolderIds, parents[0] ?? '');
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
        let rootFolderIds = await getRequestRootFolderIds(req);
        const sessionUser = (req as any).user || (req as any).session?.user;
        const documentId = getParam(req.query.documentId as string | string[] | undefined);

        if (documentId) {
            const document = await (prisma as any).document.findUnique({
                where: { id: documentId },
                include: { accessRules: true },
            });
            if (!document || document.sourceExternalId !== fileId) {
                return res.status(404).json({ error: 'Drive-backed document not found' });
            }
            const subject = {
                userId: sessionUser?.userId || sessionUser?.id || sessionUser?.tenantId || null,
                email: sessionUser?.email || null,
                cooperativeId: sessionUser?.cooperativeId || document.cooperativeId,
                groupIds: sessionUser?.groupIds || [],
                permissionKeys: sessionUser?.permissionKeys || (sessionUser?.isAdmin ? ['documents.view.admin', 'documents.view.board', 'documents.view.members'] : ['documents.view.members']),
                committeeIds: sessionUser?.committeeIds || [],
                isAdmin: Boolean(sessionUser?.isAdmin),
            };
            if (!canAccessDocument(subject, document)) {
                return res.status(403).json({ error: 'Document access denied' });
            }
            rootFolderIds = await getRequestRootFolderIds(req, document.cooperativeId);
            await (prisma as any).documentAccessLog.create({
                data: {
                    documentId: document.id,
                    userId: subject.userId || subject.email || 'unknown',
                    action: 'drive_download',
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent') || null,
                },
            }).catch((error: any) => console.error('Failed to log Drive document access:', error));
        } else if (!hasPermission({
            userId: sessionUser?.userId || sessionUser?.id || null,
            email: sessionUser?.email || null,
            cooperativeId: sessionUser?.cooperativeId || '',
            groupIds: sessionUser?.groupIds || [],
            permissionKeys: sessionUser?.permissionKeys || [],
            isAdmin: Boolean(sessionUser?.isAdmin),
        }, 'documents.create')) {
            return res.status(403).json({ error: 'Drive downloads require a coopHUB document context' });
        }

        const meta = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, parents',
            supportsAllDrives: true,
        });
        const { name, mimeType, parents } = meta.data;

        const allowed = rootFolderIds.includes(fileId) || await isFolderWithinRoots(drive, rootFolderIds, parents?.[0] ?? '');
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
        const rootFolderIds = await getRequestRootFolderIds(req);
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
        rootFolderIds.forEach(id => cache.set(id, true));

        // Process search results in parallel with ancestry checking
        const filterPromises = allFiles.map(async (file) => {
            if (!file.id) return null;

            // Immediate check: is it a root?
            if (rootFolderIds.includes(file.id)) return file;

            // Immediate check: is its parent a root? (Already in response)
            if (file.parents?.some(p => rootFolderIds.includes(p))) {
                cache.set(file.id, true);
                return file;
            }

            // Fallback: full ancestry check with cache
            const isInside = await isFolderWithinRoots(drive, rootFolderIds, file.id, cache);
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
