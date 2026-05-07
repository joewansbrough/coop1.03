
import { PrismaClient } from '@prisma/client';

export interface ToolContext {
  prisma: PrismaClient;
  cooperativeId: string;
  userId: string;
  userEmail: string;
  role: string;
  isAdmin: boolean;
}

export const oracleTools = {
  get_maintenance_requests: async (context: ToolContext, params: { status?: string, priority?: string }) => {
    const { prisma, cooperativeId, userEmail, isAdmin } = context;
    
    const where: any = { cooperativeId };
    
    // Residents only see their own requests
    if (!isAdmin) {
      where.requestedBy = userEmail;
    }
    
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    
    const requests = await prisma.maintenanceRequest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        unit: {
          select: { number: true }
        }
      }
    });
    
    return requests;
  },

  get_upcoming_events: async (context: ToolContext) => {
    const { prisma, cooperativeId } = context;
    
    const events = await prisma.coopEvent.findMany({
      where: {
        cooperativeId,
        date: { gte: new Date() }
      },
      orderBy: { date: 'asc' },
      take: 10,
      include: {
        committee: {
          select: { name: true }
        }
      }
    });
    
    return events;
  },

  get_recent_announcements: async (context: ToolContext) => {
    const { prisma, cooperativeId } = context;
    
    const announcements = await prisma.announcement.findMany({
      where: { cooperativeId },
      orderBy: { date: 'desc' },
      take: 5
    });
    
    return announcements;
  },

  get_my_unit_info: async (context: ToolContext) => {
    const { prisma, cooperativeId, userEmail } = context;
    
    const tenant = await prisma.tenant.findUnique({
      where: { email: userEmail },
      include: {
        unit: {
          include: {
            building: true,
            scheduledTasks: {
              where: { isCompleted: false },
              take: 5
            }
          }
        }
      }
    });
    
    if (!tenant || !tenant.unit) return { error: "No unit information found for current user." };
    
    return {
      unitNumber: tenant.unit.number,
      type: tenant.unit.type,
      building: tenant.unit.building?.name,
      status: tenant.unit.status,
      scheduledMaintenance: tenant.unit.scheduledTasks
    };
  },

  get_committees: async (context: ToolContext) => {
    const { prisma, cooperativeId } = context;
    
    const committees = await prisma.committee.findMany({
      where: { cooperativeId },
      include: {
        members: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    return committees.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      chair: c.chair,
      members: c.members.map(m => `${m.firstName} ${m.lastName}`)
    }));
  },

  search_documents: async (context: ToolContext, params: { query: string }) => {
    const { prisma, cooperativeId } = context;
    
    // First try searching in Document chunks for detailed content
    const chunks = await prisma.documentChunk.findMany({
      where: {
        cooperativeId,
        isActive: true,
        text: { contains: params.query, mode: 'insensitive' }
      },
      take: 8,
      include: { document: true }
    });

    if (chunks.length > 0) {
      return chunks.map(c => ({
        documentTitle: c.document.title,
        text: c.text,
        pageNumber: c.pageNumber
      }));
    }

    // Fallback to searching document metadata/content directly
    const documents = await prisma.document.findMany({
      where: {
        cooperativeId,
        OR: [
          { title: { contains: params.query, mode: 'insensitive' } },
          { content: { contains: params.query, mode: 'insensitive' } }
        ]
      },
      take: 5,
      select: {
        title: true,
        content: true,
        category: true
      }
    });
    
    return documents.map(d => ({
      documentTitle: d.title,
      text: d.content?.substring(0, 1000),
      category: d.category
    }));
  },

  admin_query_tenants: async (context: ToolContext, params: { query?: string }) => {
    const { prisma, cooperativeId, isAdmin } = context;
    if (!isAdmin) return { error: "Access denied. Admin only." };
    
    const where: any = { cooperativeId };
    if (params.query) {
      where.OR = [
        { firstName: { contains: params.query, mode: 'insensitive' } },
        { lastName: { contains: params.query, mode: 'insensitive' } },
        { email: { contains: params.query, mode: 'insensitive' } },
      ];
    }
    
    const tenants = await prisma.tenant.findMany({
      where,
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        unit: { select: { number: true } }
      }
    });
    
    return tenants;
  }
};

export const oracleToolDeclarations = [
  {
    name: "get_maintenance_requests",
    description: "Retrieve maintenance requests. Residents see only their own, admins see all for the co-op.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status (e.g., Open, Pending, Completed)" },
        priority: { type: "string", description: "Filter by priority (e.g., Low, Medium, High, Emergency)" }
      }
    }
  },
  {
    name: "get_upcoming_events",
    description: "Get upcoming co-op events and meetings.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_recent_announcements",
    description: "Get recent co-op announcements.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_my_unit_info",
    description: "Get information about the current user's unit and any scheduled maintenance for it.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_committees",
    description: "Get a list of co-op committees and their chairs.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "search_documents",
    description: "Search co-op documents and policies by keyword.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The keyword or phrase to search for" }
      },
      required: ["query"]
    }
  },
  {
    name: "admin_query_tenants",
    description: "Admin only: Search for tenants/members by name or email.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or email to search for" }
      }
    }
  }
];
