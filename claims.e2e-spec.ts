/**
 * @fileoverview End-to-end tests for the claims lifecycle.
 * @issue #209
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Claims Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  let claimantToken: string;
  let approverToken: string;
  let claimantId: string;
  let approverId: string;
  let propertyId: string;
  let claimId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    // -- Test Setup --
    // 1. Clean database
    await prisma.claim.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();

    // 2. Create users with different roles
    const claimant = await prisma.user.create({
      data: {
        email: 'claimant@test.com',
        password: 'password',
        role: 'USER',
      },
    });
    claimantId = claimant.id;

    const approver = await prisma.user.create({
      data: {
        email: 'approver@test.com',
        password: 'password',
        role: 'ADMIN',
      },
    });
    approverId = approver.id;

    // 3. Create a property to file a claim against
    const property = await prisma.property.create({
      data: {
        name: 'Test Property for Claims',
        ownerId: approverId, // An admin owns the property
      },
    });
    propertyId = property.id;

    // 4. Generate auth tokens
    claimantToken = (await authService.login(claimant)).accessToken;
    approverToken = (await authService.login(approver)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow a user to create a new claim (POST /claims)', async () => {
    const response = await request(app.getHttpServer())
      .post('/claims')
      .set('Authorization', `Bearer ${claimantToken}`)
      .send({
        propertyId: propertyId,
        description: 'E2E Test: My roof is leaking.',
        type: 'DAMAGE',
      })
      .expect(HttpStatus.CREATED);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toEqual('PENDING');
    expect(response.body.userId).toEqual(claimantId);
    claimId = response.body.id;
  });

  it('should allow an admin to approve a pending claim (POST /claims/:id/approve)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({
        notes: 'E2E Test: Approved for repair.',
      })
      .expect(HttpStatus.OK);

    expect(response.body.id).toEqual(claimId);
    expect(response.body.status).toEqual('APPROVED');
  });

  it('should not allow a regular user to approve a claim', async () => {
    // Attempt to approve with the claimant's token
    await request(app.getHttpServer())
      .post(`/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${claimantToken}`)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('should allow an admin to settle an approved claim (POST /claims/:id/settle)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/claims/${claimId}/settle`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({
        settlementAmount: 5000,
        transactionHash: '0x' + 'a'.repeat(64),
      })
      .expect(HttpStatus.OK);

    expect(response.body.id).toEqual(claimId);
    expect(response.body.status).toEqual('SETTLED');
    expect(response.body.settlementAmount).toEqual(5000);
  });
});