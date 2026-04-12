import { z } from 'zod';

export const maintenanceSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled']),
  priority: z.enum(['Low', 'Medium', 'High', 'Emergency']),
  category: z.array(z.string()).min(1, { message: "At least one category is required" }),
  unitId: z.string().uuid(),
  requestedBy: z.string().email().optional().nullable(),
  notes: z.array(z.object({
    id: z.string(),
    author: z.string(),
    date: z.string(),
    content: z.string()
  })).optional(),
  expenses: z.array(z.object({
    id: z.string(),
    item: z.string(),
    cost: z.number(),
    date: z.string()
  })).optional(),
  urgency: z.string().optional(), // Added urgency for AI triage
});

export const tenantSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional().nullable(),
  status: z.enum(['Current', 'Waitlist', 'Past']),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  unitId: z.string().uuid().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  notes: z.string().optional(), // Added for waitlist notes
  picture: z.string().optional(), // Added for user profile picture
});

export const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  content: z.string().min(1, { message: "Content is required" }),
  type: z.string(),
  priority: z.enum(['Normal', 'Urgent']),
  author: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
});

export const documentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  category: z.string().min(1, { message: "Category is required" }),
  committee: z.string().optional(),
  url: z.string().url({ message: "Invalid URL" }),
  fileType: z.string(),
  author: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
});

export const coopEventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  time: z.string().regex(/^\d{2}:\d{2}$/, { message: "Time must be HH:MM" }),
  location: z.string().min(1, { message: "Location is required" }),
  category: z.enum(['Meeting', 'Social', 'Maintenance', 'Board']),
});

export const committeeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().optional(),
  chair: z.string().min(1, { message: "Chair name is required" }),
  icon: z.string().optional(),
  members: z.array(z.string()).optional(),
});
