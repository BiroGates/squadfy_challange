import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../../infra/db/database.module';
import { users, User, NewUser } from '../../../infra/db/schema';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly db: any) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    return rows[0] ?? null;
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.keycloakId, keycloakId));
    return rows[0] ?? null;
  }

  async findByOrganizationId(organizationId: string): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  async create(data: NewUser): Promise<User> {
    const rows = await this.db.insert(users).values(data).returning();
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
