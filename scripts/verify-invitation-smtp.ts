import { loadEnvConfig } from "@next/env";
import { verifyInvitationSmtp } from "../src/modules/management/invitation-mail";
import { ManagementError } from "../src/modules/management/management-types";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
async function main() {
  await verifyInvitationSmtp();
  console.log(
    "SMTP connection, TLS, and authentication verified. No email was sent.",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof ManagementError
      ? error.message
      : "SMTP verification failed. Check the server's mail settings.",
  );
  process.exitCode = 1;
});
