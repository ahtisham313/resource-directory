import { randomBytes, randomUUID, createHash } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../src/lib/db";
import {
  defaultSurvey,
  defaultCategories,
} from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import { projectResource } from "../src/modules/resources/project-resource";
import {
  editResource,
  changeResource,
  getResourceEditor,
} from "../src/modules/resources/resource-management";
import { getPublicResource } from "../src/modules/resources/resource-details";
import {
  deleteAdmin,
  updateAdmin,
} from "../src/modules/management/admin-management";
import {
  acceptInvitation,
  inviteAdmin,
} from "../src/modules/management/invitation-service";
import {
  getNotifications,
  markNotificationRead,
} from "../src/modules/management/notifications";
import { getResponseDetails } from "../src/modules/responses/response-data";

const { currentAdmin, mail } = vi.hoisted(() => ({
  currentAdmin: vi.fn(),
  mail: vi.fn(),
}));
vi.mock("@/modules/auth/authorization", async (original) => ({
  ...(await original<typeof import("../src/modules/auth/authorization")>()),
  requireAdmin: currentAdmin,
  requireRole: currentAdmin,
}));
vi.mock("@/modules/management/invitation-mail", () => ({
  validateInvitationMailConfig: () => undefined,
  sendInvitation: mail,
}));
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  url !== process.env.DATABASE_URL ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(new URL(url).pathname)
)
  throw new Error(
    "Run using npm run test:db with a disposable local database.",
  );
afterAll(async () => {
  await getDb().$disconnect();
});
async function actor(role: "SUPER_ADMIN" | "ADMIN" = "SUPER_ADMIN") {
  const admin = await getDb().adminUser.create({
    data: {
      name: "Management fixture",
      email: `management-${randomUUID()}@example.com`,
      passwordHash: await hash(randomBytes(24).toString("hex"), 4),
      role,
    },
  });
  currentAdmin.mockResolvedValue({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  });
  return admin;
}
it("edits the saved version atomically, preserves original answers, rejects stale writes, and applies public visibility and deletion", async () => {
  const admin = await actor();
  const snapshot = structuredClone(defaultSurvey);
  snapshot.surveyId = randomUUID();
  const template = snapshot.sections[0].fields[0];
  snapshot.sections[0].fields.push({
    ...structuredClone(template),
    id: randomUUID(),
    fieldKey: "custom-note",
    label: "Custom note",
    required: false,
    order:
      Math.max(...snapshot.sections[0].fields.map((field) => field.order)) + 1,
    displayMapping: null,
  });
  const survey = await getDb().survey.create({
    data: {
      id: snapshot.surveyId,
      title: snapshot.title,
      introText: snapshot.introText,
      closingMessage: snapshot.closingMessage,
      termsText: snapshot.termsText,
    },
  });
  const version = await getDb().surveyVersion.create({
    data: { id: randomUUID(), surveyId: survey.id, versionNumber: 1, snapshot },
  });
  const answers = structuredClone(sampleResources[0].answers),
    projection = projectResource(snapshot, answers);
  const response = await getDb().surveyResponse.create({
    data: {
      surveyId: survey.id,
      surveyVersionId: version.id,
      answers,
      status: "APPROVED",
      reviewerId: admin.id,
      reviewedAt: new Date(),
    },
  });
  const categories = [];
  for (const category of defaultCategories)
    categories.push(
      await getDb().category.upsert({
        where: { slug: category.slug },
        create: category,
        update: {},
      }),
    );
  const resource = await getDb().resource.create({
    data: {
      ...projection.data,
      imageKey: null,
      sourceResponseId: response.id,
      surveyVersionId: version.id,
      latitude: 38.88,
      longitude: -77.1,
      categories: {
        create: {
          categoryId: categories.find(
            (category) => category.name === projection.categoryNames[0],
          )!.id,
        },
      },
    },
  });
  let editor = await getResourceEditor(resource.id);
  const edited = {
    ...editor.answers,
    "practice-name": { value: "Edited fixture" },
    "custom-note": { value: "Custom fields survive" },
    category: { value: ["urgent-care"] },
  };
  await editResource(resource.id, {
    revision: editor.revision,
    answers: edited,
  });
  const saved = await getDb().resource.findUniqueOrThrow({
    where: { id: resource.id },
    include: { categories: { include: { category: true } } },
  });
  expect(saved.name).toBe("Edited fixture");
  expect(saved.currentAnswers).toEqual(edited);
  expect(saved.latitude).toBe(38.88);
  expect(saved.categories.map((link) => link.category.slug)).toEqual([
    "urgent-care",
  ]);
  expect(
    (
      await getDb().surveyResponse.findUniqueOrThrow({
        where: { id: response.id },
      })
    ).answers,
  ).toEqual(answers);
  await expect(
    editResource(resource.id, { revision: editor.revision, answers: edited }),
  ).rejects.toMatchObject({ status: 409 });
  editor = await getResourceEditor(resource.id);
  await expect(
    editResource(resource.id, {
      revision: editor.revision,
      answers: { ...edited, phone: { value: "bad" } },
    }),
  ).rejects.toMatchObject({ status: 422 });
  expect((await getResourceEditor(resource.id)).revision).toBe(editor.revision);
  await changeResource(resource.id, {
    action: "visibility",
    active: false,
    revision: editor.revision,
  });
  await expect(getPublicResource(resource.id)).rejects.toMatchObject({
    status: 404,
  });
  editor = await getResourceEditor(resource.id);
  await changeResource(resource.id, {
    action: "visibility",
    active: true,
    revision: editor.revision,
  });
  expect((await getPublicResource(resource.id)).resource.name).toBe(
    "Edited fixture",
  );
  editor = await getResourceEditor(resource.id);
  await changeResource(resource.id, {
    action: "delete",
    revision: editor.revision,
  });
  await expect(getPublicResource(resource.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    await getDb().resourceCategory.count({
      where: { resourceId: resource.id },
    }),
  ).toBe(0);
  expect(
    await getDb().surveyResponse.count({ where: { id: response.id } }),
  ).toBe(1);
  expect(await getDb().surveyVersion.count({ where: { id: version.id } })).toBe(
    1,
  );
});
it("prevents self deletion and concurrent last-super-admin lockout while keeping deleted reviewers attributable", async () => {
  await getDb().adminUser.updateMany({ data: { status: "INACTIVE" } });
  const first = await actor(),
    second = await actor();
  currentAdmin.mockResolvedValue(first);
  await expect(
    deleteAdmin(first.id, first.updatedAt.toISOString()),
  ).rejects.toMatchObject({ status: 409 });
  const results = await Promise.allSettled([
    updateAdmin(first.id, {
      name: first.name,
      role: "ADMIN",
      status: "ACTIVE",
      revision: first.updatedAt.toISOString(),
    }),
    updateAdmin(second.id, {
      name: second.name,
      role: "ADMIN",
      status: "ACTIVE",
      revision: second.updatedAt.toISOString(),
    }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(
    await getDb().adminUser.count({
      where: { status: "ACTIVE", role: "SUPER_ADMIN" },
    }),
  ).toBe(1);
  const remaining = await getDb().adminUser.findFirstOrThrow({
    where: { status: "ACTIVE", role: "SUPER_ADMIN" },
  });
  currentAdmin.mockResolvedValue(remaining);
  const reviewer = await getDb().adminUser.findFirstOrThrow({
    where: { id: { not: remaining.id }, reviewedResponses: { some: {} } },
  });
  const response = await getDb().surveyResponse.findFirstOrThrow({
    where: { reviewerId: reviewer.id },
  });
  await deleteAdmin(reviewer.id, reviewer.updatedAt.toISOString());
  expect((await getResponseDetails(response.id)).reviewer?.email).toBe(
    reviewer.email,
  );
  expect(
    await getDb().adminUser.findUnique({ where: { id: reviewer.id } }),
  ).toBeNull();
  await expect(
    updateAdmin(remaining.id, {
      name: remaining.name,
      role: "ADMIN",
      status: "ACTIVE",
      revision: remaining.updatedAt.toISOString(),
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("hashes invitation tokens, rolls back failed email delivery, accepts once under concurrency, and scopes join notifications", async () => {
  const admin = await actor();
  mail.mockRejectedValueOnce(new Error("Synthetic SMTP failure"));
  const failedEmail = `mail-fail-${randomUUID()}@example.com`;
  await expect(
    inviteAdmin({ email: failedEmail, role: "ADMIN" }),
  ).rejects.toMatchObject({ status: 503 });
  expect(
    await getDb().adminInvitation.count({ where: { email: failedEmail } }),
  ).toBe(0);
  mail.mockResolvedValue(undefined);
  const email = `invite-${randomUUID()}@example.com`;
  await inviteAdmin({ email, role: "ADMIN" });
  const token = mail.mock.calls.at(-1)![2] as string;
  const invitation = await getDb().adminInvitation.findFirstOrThrow({
    where: { email },
  });
  expect(invitation.tokenHash).not.toBe(token);
  expect(invitation.tokenHash).toBe(
    createHash("sha256").update(token).digest("hex"),
  );
  await expect(inviteAdmin({ email, role: "ADMIN" })).rejects.toMatchObject({
    status: 409,
  });
  const password = randomBytes(18).toString("base64url"),
    input = { name: "Invited fixture", password, confirmPassword: password };
  const results = await Promise.allSettled([
    acceptInvitation(token, input),
    acceptInvitation(token, input),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const joined = await getDb().adminUser.findUniqueOrThrow({
    where: { email },
  });
  expect(await compare(password, joined.passwordHash)).toBe(true);
  expect(
    await getDb().notification.count({
      where: {
        recipientId: admin.id,
        type: "ADMIN_JOINED",
        metadata: { path: ["adminId"], equals: joined.id },
      },
    }),
  ).toBe(1);
  expect(
    await getDb().notification.count({ where: { recipientId: joined.id } }),
  ).toBe(0);
  await expect(acceptInvitation(token, input)).rejects.toMatchObject({
    status: 410,
  });
  const notifications = await getNotifications();
  expect(notifications.unread).toBeGreaterThan(0);
  const id = notifications.rows[0].id;
  await markNotificationRead(id);
  await markNotificationRead(id);
  currentAdmin.mockResolvedValue(joined);
  await expect(markNotificationRead(id)).rejects.toMatchObject({ status: 404 });
  const expired = randomBytes(32).toString("hex");
  await getDb().adminInvitation.create({
    data: {
      email: `expired-${randomUUID()}@example.com`,
      tokenHash: createHash("sha256").update(expired).digest("hex"),
      createdAt: new Date(Date.now() - 7200000),
      expiresAt: new Date(Date.now() - 3600000),
    },
  });
  await expect(acceptInvitation(expired, input)).rejects.toMatchObject({
    status: 410,
  });
});
