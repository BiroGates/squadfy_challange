import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE } from '../../../infra/db/database.module';
import { knowledgements, Knowledgement, NewKnowledgement } from '../../../infra/db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../infra/db/schema';

@Injectable()
export class KnowledgementRepository {
  constructor(@Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string): Promise<Knowledgement | null> {
    const rows = await this.db.select().from(knowledgements).where(eq(knowledgements.id, id));
    return rows[0] ?? null;
  }

  async findByOrganizationId(organizationId: string, allowedToRestricted: boolean): Promise<Knowledgement[]> {
    const conditions = [eq(knowledgements.organizationId, organizationId)];

    if (!allowedToRestricted) {
      conditions.push(eq(knowledgements.isRestricted, false));
    }

    return this.db.select().from(knowledgements).where(and(...conditions));
  }

  async create(data: NewKnowledgement): Promise<Knowledgement> {
    const rows = await this.db.insert(knowledgements).values(data).returning();
    return rows[0];
  }

  async update(id: string, data: Partial<NewKnowledgement>): Promise<Knowledgement> {
    const rows = await this.db
      .update(knowledgements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(knowledgements.id, id))
      .returning();
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(knowledgements).where(eq(knowledgements.id, id));
  }

  private mapRow(row: any): Knowledgement {
    return {
      id: row.id,
      title: row.title,
      s3Key: row.s3_key,
      isRestricted: row.is_restricted,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
