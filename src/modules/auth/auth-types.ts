import { z } from "zod";

export const adminRoleSchema = z.enum(["ADMIN", "SUPER_ADMIN"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const safeAdminSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string(),
  email: z.email(),
  role: adminRoleSchema,
});
export type SafeAdmin = z.infer<typeof safeAdminSchema>;

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
  // bcrypt only compares the first 72 bytes. Reject longer input rather than truncate it.
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(72, "Password is too long.")
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Password is too long.",
    ),
});
