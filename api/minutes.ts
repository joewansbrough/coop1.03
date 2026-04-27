// Example Express.js API routes for Meeting Minutes
// Add these to your backend routes file (e.g., routes/minutes.ts or routes/api.ts)

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from './index'; // Importing from index.ts where requireAuth is defined

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/minutes
 * Get all minutes (with optional filters)
 */
router.get('/api/minutes', requireAuth, async (req, res) => {
  try {
    const { meetingType, approved, startDate, endDate } = req.query;

    const where: any = {};

    if (meetingType) {
      where.meetingType = meetingType;
    }

    if (approved === 'true') {
      where.approvedBy = { not: null };
    } else if (approved === 'false') {
      where.approvedBy = null;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const minutes = await prisma.meetingMinutes.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            category: true,
          },
        },
      },
    });

    res.json(minutes);
  } catch (error) {
    console.error('Error fetching minutes:', error);
    res.status(500).json({ error: 'Failed to fetch minutes' });
  }
});

/**
 * GET /api/minutes/:meetingId
 * Get minutes for a specific meeting
 */
router.get('/api/minutes/:meetingId', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const minutes = await prisma.meetingMinutes.findUnique({
      where: { meetingId },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            time: true,
            location: true,
            category: true,
          },
        },
      },
    });

    if (!minutes) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    res.json(minutes);
  } catch (error) {
    console.error('Error fetching minutes:', error);
    res.status(500).json({ error: 'Failed to fetch minutes' });
  }
});

/**
 * POST /api/minutes/:meetingId
 * Create new minutes for a meeting
 */
router.post('/api/minutes/:meetingId', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { meetingType, formData, attendees, motions } = req.body;
    const userId = (req as any).user.id; // From your auth middleware

    // Verify meeting exists
    const meeting = await prisma.coopEvent.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Check if minutes already exist
    const existing = await prisma.meetingMinutes.findUnique({
      where: { meetingId },
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'Minutes already exist for this meeting. Use PUT to update.' 
      });
    }

    // Create minutes
    const minutes = await prisma.meetingMinutes.create({
      data: {
        meetingId,
        meetingType,
        data: formData,
        attendees,
        motions,
        createdBy: userId,
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            category: true,
          },
        },
      },
    });

    res.status(201).json(minutes);
  } catch (error) {
    console.error('Error creating minutes:', error);
    res.status(500).json({ error: 'Failed to create minutes' });
  }
});

/**
 * PUT /api/minutes/:meetingId
 * Update existing minutes
 */
router.put('/api/minutes/:meetingId', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { meetingType, formData, attendees, motions } = req.body;

    // Check if minutes exist
    const existing = await prisma.meetingMinutes.findUnique({
      where: { meetingId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    // Don't allow updates to approved minutes without permission
    if (existing.approvedBy && !(req as any).user.isAdmin) {
      return res.status(403).json({ 
        error: 'Cannot modify approved minutes without admin permission' 
      });
    }

    // Update minutes
    const minutes = await prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        meetingType,
        data: formData,
        attendees,
        motions,
        updatedAt: new Date(),
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            category: true,
          },
        },
      },
    });

    res.json(minutes);
  } catch (error) {
    console.error('Error updating minutes:', error);
    res.status(500).json({ error: 'Failed to update minutes' });
  }
});

/**
 * DELETE /api/minutes/:meetingId
 * Delete minutes (admin only)
 */
router.delete('/api/minutes/:meetingId', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    // Only admins can delete
    if (!(req as any).user.isAdmin) {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    await prisma.meetingMinutes.delete({
      where: { meetingId },
    });

    res.json({ message: 'Minutes deleted successfully' });
  } catch (error) {
    console.error('Error deleting minutes:', error);
    res.status(500).json({ error: 'Failed to delete minutes' });
  }
});

/**
 * POST /api/minutes/:meetingId/approve
 * Approve minutes (board members only)
 */
router.post('/api/minutes/:meetingId/approve', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { approvedBy } = req.body;
    const userId = (req as any).user.id;

    // Verify user is a board member or admin
    const user = await prisma.tenant.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'BOARD_MEMBER') {
      return res.status(403).json({ 
        error: 'Only board members can approve minutes' 
      });
    }

    // Check if minutes exist
    const existing = await prisma.meetingMinutes.findUnique({
      where: { meetingId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    if (existing.approvedBy) {
      return res.status(400).json({ error: 'Minutes already approved' });
    }

    // Approve minutes
    const minutes = await prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        approvedBy,
        approvalDate: new Date(),
      },
    });

    // Optional: Send notification to members
    // await notifyMembersMinutesApproved(meetingId);

    res.json(minutes);
  } catch (error) {
    console.error('Error approving minutes:', error);
    res.status(500).json({ error: 'Failed to approve minutes' });
  }
});

/**
 * GET /api/minutes/:meetingId/pdf
 * Export minutes as PDF (future enhancement)
 */
router.get('/api/minutes/:meetingId/pdf', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const minutes = await prisma.meetingMinutes.findUnique({
      where: { meetingId },
      include: {
        meeting: true,
      },
    });

    if (!minutes) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    // TODO: Generate PDF using a library like pdfkit or puppeteer
    // For now, just return the data
    res.json({ 
      message: 'PDF generation not yet implemented',
      minutes 
    });
  } catch (error) {
    console.error('Error exporting minutes:', error);
    res.status(500).json({ error: 'Failed to export minutes' });
  }
});

export default router;
