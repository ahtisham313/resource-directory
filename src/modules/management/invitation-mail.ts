import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { ManagementError } from "./management-types";

function mailConfig() {
  const user = process.env.SMTP_USER?.trim() || undefined;
  const from = process.env.SMTP_FROM?.trim() || user;
  const parsed = z
    .object({
      host: z.string().trim().min(1),
      port: z.coerce.number().int().min(1).max(65535),
      secure: z.enum(["true", "false"]),
      from: z.email(),
      baseUrl: z.url(),
      user: z.string().optional(),
      pass: z.string().optional(),
    })
    .safeParse({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      from,
      baseUrl: process.env.NEXTAUTH_URL,
      user,
      pass: process.env.SMTP_PASSWORD,
    });
  if (!parsed.success) {
    const variables = {
      host: "SMTP_HOST",
      port: "SMTP_PORT",
      secure: "SMTP_SECURE",
      from: "SMTP_FROM (or an email address in SMTP_USER)",
      baseUrl: "NEXTAUTH_URL",
      user: "SMTP_USER",
      pass: "SMTP_PASSWORD",
    };
    const invalid = [
      ...new Set(
        parsed.error.issues.map(
          (issue) =>
            variables[issue.path[0] as keyof typeof variables] ??
            "SMTP settings",
        ),
      ),
    ];
    throw new ManagementError(
      503,
      `Check these invitation email settings: ${invalid.join(", ")}.`,
    );
  }
  const config = parsed.data,
    url = new URL(config.baseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (!local && url.protocol !== "https:") ||
    (local && !["http:", "https:"].includes(url.protocol))
  )
    throw new ManagementError(
      503,
      "NEXTAUTH_URL must be the application's base URL, with HTTPS outside localhost and no path or query string.",
    );
  if (Boolean(config.user) !== Boolean(config.pass))
    throw new ManagementError(
      503,
      "Set both SMTP_USER and SMTP_PASSWORD, or leave both empty for local SMTP capture.",
    );
  if (config.port === 465 && config.secure !== "true")
    throw new ManagementError(
      503,
      "Set SMTP_SECURE=true when using SMTP_PORT=465.",
    );
  if (config.port === 587 && config.secure !== "false")
    throw new ManagementError(
      503,
      "Set SMTP_SECURE=false when using SMTP_PORT=587; the connection will upgrade to TLS.",
    );
  // Google displays app passwords in spaced groups; the spaces are not part of the password.
  const pass =
    config.host.toLowerCase() === "smtp.gmail.com"
      ? config.pass?.replace(/\s/g, "")
      : config.pass;
  return { ...config, pass, baseUrl: url.origin };
}
export function validateInvitationMailConfig() {
  mailConfig();
}
export function isInvitationMailConfigured() {
  try {
    mailConfig();
    return true;
  } catch {
    return false;
  }
}
function createMailTransport(config: ReturnType<typeof mailConfig>) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure === "true",
    requireTLS: !["localhost", "127.0.0.1", "::1"].includes(config.host),
    ...(config.user ? { auth: { user: config.user, pass: config.pass } } : {}),
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    logger: false,
    debug: false,
  });
}
function smtpFailure(error: unknown): ManagementError {
  if (error instanceof ManagementError) return error;
  const details = z
    .object({
      code: z.string().optional(),
      responseCode: z.number().optional(),
    })
    .safeParse(error);
  const code = details.success ? details.data.code : undefined;
  // Never log provider response text: it can contain email addresses and authentication details.
  console.error("Invitation SMTP failed.", {
    code: code ?? "SMTP_FAILURE",
    responseCode: details.success ? details.data.responseCode : undefined,
  });
  if (code === "EAUTH")
    return new ManagementError(
      503,
      "The SMTP server rejected authentication. Check SMTP_USER and SMTP_PASSWORD. Gmail requires a Google App Password with 2-Step Verification enabled.",
    );
  if (
    ["ECONNECTION", "ECONNREFUSED", "ETIMEDOUT", "EDNS", "ESOCKET"].includes(
      code ?? "",
    )
  )
    return new ManagementError(
      503,
      "Unable to connect securely to SMTP. Check the host, port, TLS setting, and network access.",
    );
  if (code === "EENVELOPE")
    return new ManagementError(
      503,
      "The SMTP server rejected the sender or recipient. Check SMTP_FROM and the invitee's email address.",
    );
  return new ManagementError(
    503,
    "The SMTP server could not accept the email. Check the sender settings and mail provider's sending limits, then try again.",
  );
}
export async function verifyInvitationSmtp() {
  const transport = createMailTransport(mailConfig());
  try {
    await transport.verify();
  } catch (error) {
    throw smtpFailure(error);
  } finally {
    transport.close();
  }
}
export async function sendInvitation(
  email: string,
  role: string,
  token: string,
  expiresAt: Date,
) {
  const config = mailConfig();
  const transport = createMailTransport(config);
  try {
    const result = await transport.sendMail({
      from: config.from,
      to: email,
      subject: "Your Resource Directory admin invitation",
      text: `You have been invited to join Resource Directory as ${role === "SUPER_ADMIN" ? "a super admin" : "an administrator"}.\n\nSet your password using this single-use link:\n${config.baseUrl}/invite/${token}\n\nThis link expires at ${expiresAt.toUTCString()} (24 hours after creation). If you were not expecting this invitation, you can ignore it.`,
    });
    if (!result.accepted?.length) throw new Error("Recipient not accepted");
  } catch (error) {
    throw smtpFailure(error);
  } finally {
    transport.close();
  }
}
