import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { Roles } from 'src/types/auth/enum';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  realmName: text('realm_name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  keycloakId: text('keycloak_id').notNull().unique(),
  username: text('username').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').$type<Roles>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const knowledgements = pgTable(
  'knowledgements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    s3Key: text('s3_key').notNull(),
    isRestricted: boolean('is_restricted').notNull().default(false),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('knowledgements_org_idx').on(table.organizationId)],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Knowledgement = typeof knowledgements.$inferSelect;
export type NewKnowledgement = typeof knowledgements.$inferInsert;
