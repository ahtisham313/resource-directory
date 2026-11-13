import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  sendInvitation,
  validateInvitationMailConfig,
  verifyInvitationSmtp,
} from "../src/modules/management/invitation-mail";
const { createTransport, sendMail, verify, close } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  verify: vi.fn(),
  close: vi.fn(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
beforeEach(() => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries({
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "fixture@example.com",
    SMTP_PASSWORD: "abcd efgh ijkl mnop",
    SMTP_FROM: "",
    NEXTAUTH_URL: "http://localhost:3000",
  }))
    vi.stubEnv(name, value);
  createTransport.mockReturnValue({ sendMail, verify, close });
  sendMail.mockResolvedValue({ accepted: ["invitee@example.com"] });
  verify.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("uses the SMTP account as sender, normalizes a grouped Gmail app password, and can verify without sending mail", async () => {
  await verifyInvitationSmtp();
  expect(verify).toHaveBeenCalledOnce();
  expect(sendMail).not.toHaveBeenCalled();
  expect(createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      requireTLS: true,
      auth: { user: "fixture@example.com", pass: "abcdefghijklmnop" },
    }),
  );
  await sendInvitation(
    "invitee@example.com",
    "ADMIN",
    "fixture-token",
    new Date("2030-01-01T00:00:00Z"),
  );
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: "fixture@example.com",
      to: "invitee@example.com",
    }),
  );
  expect(close).toHaveBeenCalledTimes(2);
});
it("identifies incomplete configuration and rejects a mismatched TLS port before connecting", () => {
  vi.stubEnv("SMTP_HOST", "");
  expect(() => validateInvitationMailConfig()).toThrow("SMTP_HOST");
  vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
  vi.stubEnv("SMTP_SECURE", "false");
  expect(() => validateInvitationMailConfig()).toThrow("SMTP_SECURE=true");
  expect(createTransport).not.toHaveBeenCalled();
});
it("returns an actionable authentication error without leaking SMTP responses or credentials", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  sendMail.mockRejectedValueOnce(
    Object.assign(new Error("private provider message"), {
      code: "EAUTH",
      responseCode: 535,
      response: "private credential detail",
    }),
  );
  await expect(
    sendInvitation("invitee@example.com", "ADMIN", "private-token", new Date()),
  ).rejects.toMatchObject({
    status: 503,
    message: expect.stringContaining("SMTP server rejected authentication"),
  });
  expect(log).toHaveBeenCalledWith("Invitation SMTP failed.", {
    code: "EAUTH",
    responseCode: 535,
  });
  expect(close).toHaveBeenCalledOnce();
});
