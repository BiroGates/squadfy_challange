import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { organizations, users, knowledgements } from './schema';


const DATABASE_URL = process.env.DATABASE_URL!;
const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER!;
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD!;
const AWS_REGION = process.env.AWS_REGION!;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;
const S3_BUCKET = process.env.S3_BUCKET_NAME!;
const S3_ENDPOINT = process.env.S3_ENDPOINT;

async function kcAuth(kcAdmin: KcAdminClient) {
  await kcAdmin.auth({
    grantType: 'password',
    clientId: 'admin-cli',
    username: KEYCLOAK_ADMIN_USER,
    password: KEYCLOAK_ADMIN_PASSWORD,
  });
}

async function createRealm(kcAdmin: KcAdminClient, realmName: string) {
  await kcAuth(kcAdmin);
  try {
    await kcAdmin.realms.create({ realm: realmName, enabled: true });
  } catch (e: any) {
    if (e?.response?.status === 409) {
      console.log(`Realm '${realmName}' already exists, skipping.`);
    } else throw e;
  }
  try {
    await kcAdmin.clients.create({
      realm: realmName,
      clientId: 'knowledge-api',
      enabled: true,
      directAccessGrantsEnabled: true,
      publicClient: true,
    });
  } catch (_) {}
  for (const role of ['USER', 'ADMIN', 'ORGANIZATION']) {
    try {
      await kcAdmin.roles.create({ realm: realmName, name: role });
    } catch (_) {}
  }
}

async function createKcUser(
  kcAdmin: KcAdminClient,
  realmName: string,
  username: string,
  password: string,
  role: string,
): Promise<string> {
  await kcAuth(kcAdmin);
  let userId: string;
  try {
    const created = await kcAdmin.users.create({
      realm: realmName,
      username,
      enabled: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
      emailVerified: true,
      firstName: "Teste",
      lastName: "Da Silva",
      email: `teste@teste+${new Date().getTime()}.com`
    });
    userId = created.id!;
  } catch (e: any) {
    if (e?.response?.status === 409) {
      const existing = await kcAdmin.users.find({ realm: realmName, username, exact: true });
      userId = existing[0].id!;
      console.log(`  User '${username}' in realm '${realmName}' already exists.`);
    } else throw e;
  }
  try {
    const realmRole = await kcAdmin.roles.findOneByName({ realm: realmName, name: role });
    if (realmRole) {
      await kcAdmin.users.addRealmRoleMappings({
        realm: realmName,
        id: userId,
        roles: [{ id: realmRole.id!, name: realmRole.name! }],
      });
    }
  } catch (_) {}
  return userId;
}

async function ensureBucket(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (_) {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`  Created S3 bucket '${bucket}'.`);
  }
}

async function uploadToS3(s3: S3Client, bucket: string, key: string, content: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: 'text/plain; charset=utf-8',
    }),
  );
}

const ADMIN_ORG = {
  id: 'e2333c79-d0e1-4f05-aaa8-68acd5aba090',
  name: 'Platform Admin',
  realmName: 'admin',
  users: [{ username: 'platform-admin', password: 'PlatformAdmin123!', role: 'ADMIN' }],
  knowledgements: [],
};

const ORG_SEED = [
  {
    id: '52d29604-7f6f-4f47-9658-47708d47732f',
    name: 'TechCorp',
    realmName: 'techcorp',
    users: [
      { username: 'tc-manager', password: 'OrgMgr123!', role: 'ORGANIZATION' },
      { username: 'tc-user1', password: 'User123!', role: 'USER' },
    ],
    knowledgements: [
      {
        title: 'Remote Work Policy',
        content:
          'TechCorp allows remote work up to 3 days per week for all employees. Employees must be available during core hours (10am-3pm local time). Equipment stipend of $500/year is provided for home office setup.',
        isRestricted: false,
      },
      {
        title: 'Salary Bands 2024',
        content:
          'Junior Engineers: $60k-$80k. Mid-level Engineers: $90k-$120k. Senior Engineers: $130k-$170k. Staff Engineers: $180k-$220k. All bands include a 10-15% bonus target.',
        isRestricted: true,
      },
      {
        title: 'Engineering Onboarding',
        content:
          'Week 1: Complete security training and dev environment setup. Week 2: Pair with a team member on a starter task. Week 3-4: Take ownership of a small feature end-to-end. All new engineers must complete the internal Go/TypeScript style guide review.',
        isRestricted: false,
      },
    ],
  },
  {
    id: '25540b62-dcbd-4968-8950-dba965018bc9',
    name: 'FinanceGroup',
    realmName: 'financegroup',
    users: [{ username: 'fg-user1', password: 'FgUser123!', role: 'USER' }, { username: 'manager-fg-user1', password: 'ManagerFgUser123!', role: 'ORGANIZATION' }],
    knowledgements: [
      {
        title: 'Budget Guidelines',
        content:
          'Department budgets are reviewed quarterly. Any expenditure above $10k requires VP approval. Travel expenses must be submitted within 30 days of the trip.',
        isRestricted: false,
      },
      {
        title: 'Q4 Projections',
        content:
          'Q4 revenue target: $12M. EBITDA target: 18%. Key risks: FX exposure in LATAM markets. Do not share externally.',
        isRestricted: true,
      },
    ],
  },
];

async function main() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const s3 = new S3Client({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
    ...(S3_ENDPOINT && { endpoint: S3_ENDPOINT, forcePathStyle: true }),
  });

  const kcAdmin = new KcAdminClient({ baseUrl: KEYCLOAK_BASE_URL, realmName: 'master' });

  await ensureBucket(s3, S3_BUCKET);

  const output: any = { organizations: [], users: [] };

  console.log('\nSeeding admin organization (realm pre-created by docker-compose)...');
  let adminOrg = (
    await db
      .insert(organizations)
      .values({ id: ADMIN_ORG.id, name: ADMIN_ORG.name, realmName: ADMIN_ORG.realmName })
      .onConflictDoNothing()
      .returning()
  )[0];

  if (!adminOrg) {
    const rows = await db
      .select()
      .from(organizations)
      .where(require('drizzle-orm').eq(organizations.name, ADMIN_ORG.name));
    adminOrg = rows[0];
  }

  output.organizations.push({ id: adminOrg.id, name: adminOrg.name, realmName: adminOrg.realmName });
  console.log(`  Admin Org ID: ${adminOrg.id}`);

  for (const u of ADMIN_ORG.users) {
    const keycloakId = await createKcUser(
      kcAdmin,
      ADMIN_ORG.realmName,
      u.username,
      u.password,
      u.role,
    );
    try {
      await db
        .insert(users)
        .values({ keycloakId, username: u.username, organizationId: adminOrg.id, role: u.role as any })
        .onConflictDoNothing();
    } catch (_) {}
    output.users.push({
      username: u.username,
      password: u.password,
      role: u.role,
      realm: ADMIN_ORG.realmName,
      organizationId: adminOrg.id,
    });
    console.log(`  User '${u.username}' (${u.role}) registered in DB.`);
  }
  
  for (const orgData of ORG_SEED) {
    console.log(`\nSeeding organization: ${orgData.name}`);

    await createRealm(kcAdmin, orgData.realmName);

    let org = (
      await db
        .insert(organizations)
        .values({ id: orgData.id, name: orgData.name, realmName: orgData.realmName })
        .onConflictDoNothing()
        .returning()
    )[0];

    if (!org) {
      const rows = await db
        .select()
        .from(organizations)
        .where(require('drizzle-orm').eq(organizations.name, orgData.name));
      org = rows[0];
    }

    output.organizations.push({ id: org.id, name: org.name, realmName: org.realmName });
    console.log(`  Org ID: ${org.id}`);

    for (const u of orgData.users) {
      const keycloakId = await createKcUser(kcAdmin, orgData.realmName, u.username, u.password, u.role);
      try {
        await db
          .insert(users)
          .values({ keycloakId, username: u.username, organizationId: org.id, role: u.role as any })
          .onConflictDoNothing();
      } catch (_) {}
      output.users.push({
        username: u.username,
        password: u.password,
        role: u.role,
        realm: orgData.realmName,
        organizationId: org.id,
      });
      console.log(`  User '${u.username}' (${u.role}) created.`);
    }

    for (const k of orgData.knowledgements) {
      const id = randomUUID();
      const s3Key = `organizations/${org.id}/knowledgements/${id}.txt`;
      await uploadToS3(s3, S3_BUCKET, s3Key, k.content);
      try {
        await db
          .insert(knowledgements)
          .values({ id, title: k.title, s3Key, isRestricted: k.isRestricted, organizationId: org.id })
          .onConflictDoNothing();
      } catch (_) {}
      console.log(`  Knowledgement '${k.title}' uploaded to S3 (restricted=${k.isRestricted}).`);
    }
  }

  fs.writeFileSync('seed-output.json', JSON.stringify(output, null, 2));
  console.log('\nSeed complete. Credentials written to seed-output.json');

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
