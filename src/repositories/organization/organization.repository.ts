import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../../infra/db/database.module';
import { organizations, Organization, NewOrganization } from '../../../infra/db/schema';

@Injectable()
export class OrganizationRepository {
  constructor(@Inject(DATABASE) private readonly db: any) {}

  async findById(id: string): Promise<Organization | null> {
    const rows = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return rows[0] ?? null;
  }

  async findByRealmName(realmName: string): Promise<Organization | null> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.realmName, realmName));
    return rows[0] ?? null;
  }

  async findAll(): Promise<Organization[]> {
    return this.db.select().from(organizations);
  }

  async create(data: NewOrganization): Promise<Organization> {
    const rows = await this.db.insert(organizations).values(data).returning();
    return rows[0];
  }

  async update(id: string, data: Partial<NewOrganization>): Promise<Organization> {
    const rows = await this.db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(organizations).where(eq(organizations.id, id));
  }
}
