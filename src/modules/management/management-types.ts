import { z } from "zod";
import { adminRoleSchema, credentialsSchema } from "@/modules/auth/auth-types";

export class ManagementError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const revisionSchema = z.string().datetime();
export const adminEditSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: adminRoleSchema,
    status: z.enum(["ACTIVE", "INACTIVE"]),
    revision: revisionSchema,
  })
  .strict();
export const inviteSchema = z
  .object({ email: credentialsSchema.shape.email, role: adminRoleSchema })
  .strict();
export const acceptSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(120),
    password: credentialsSchema.shape.password.min(
      12,
      "Use at least 12 characters.",
    ),
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });
export function checkId(id: string) {
  if (!idSchema.safeParse(id).success)
    throw new ManagementError(404, "Record not found.");
}
