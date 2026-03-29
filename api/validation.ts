import { z } from 'zod';

export const maintenanceSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  category: z.union([z.string(), z.array(z.string())]),
  unitId: z.string().uuid("Invalid Unit ID"),
  requestedBy: z.string().email("Invalid email").optional(),
});

export const documentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  isPrivate: z.boolean().optional(),
  committee: z.string().optional(),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(['General', 'Urgent', 'Maintenance']),
  priority: z.enum(['Low', 'Normal', 'High']),
  author: z.string().email("Invalid email"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});
