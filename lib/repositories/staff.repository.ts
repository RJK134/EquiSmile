import { prisma } from '@/lib/prisma';
import type { Staff, StaffRole, Prisma } from '@prisma/client';

export interface CreateStaffInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: StaffRole;
  colour?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export interface UpdateStaffInput extends Partial<CreateStaffInput> {
  active?: boolean;
}

export const staffRepository = {
  async list(options: { active?: boolean; role?: StaffRole } = {}): Promise<Staff[]> {
    const where: Prisma.StaffWhereInput = {};
    if (options.active !== undefined) where.active = options.active;
    if (options.role) where.role = options.role;

    return prisma.staff.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  },

  async findById(id: string): Promise<Staff | null> {
    return prisma.staff.findUnique({ where: { id } });
  },

  async findByEmail(email: string): Promise<Staff | null> {
    return prisma.staff.findUnique({ where: { email } });
  },

  async findByUserId(userId: string): Promise<Staff | null> {
    return prisma.staff.findUnique({ where: { userId } });
  },

  async create(data: CreateStaffInput): Promise<Staff> {
    return prisma.staff.create({
      data: {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        role: data.role ?? 'VET',
        colour: data.colour ?? null,
        notes: data.notes ?? null,
        userId: data.userId ?? null,
      },
    });
  },

  async update(id: string, data: UpdateStaffInput): Promise<Staff> {
    return prisma.staff.update({
      where: { id },
      data,
    });
  },

  async deactivate(id: string): Promise<Staff> {
    return prisma.staff.update({
      where: { id },
      data: { active: false },
    });
  },
};
