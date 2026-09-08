import "dotenv/config";
import { buildApi } from "./api";
import { db } from "./db";
const app = await buildApi();
try {
  await app.listen({
    host: process.env.MUSCLESCOUT_BIND_HOST || "127.0.0.1",
    port: Number(process.env.MUSCLESCOUT_API_PORT || 4410),
  });
} catch (e) {
  console.error(
    "MuscleScout API could not bind its port. Existing applications were left running.",
    (e as Error).message,
  );
  process.exitCode = 1;
  await db.$disconnect();
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    await db.$disconnect();
    process.exit();
  });
