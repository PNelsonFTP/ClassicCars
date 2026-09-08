import { mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
export async function writePrivateValidation(
  name: string,
  result: Record<string, unknown>,
) {
  const folder = path.resolve("test-results/private");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);
  const timestamp = new Date().toISOString(),
    filename = path.join(
      folder,
      `${name}-${timestamp.replace(/[:.]/g, "-")}.json`,
    );
  await writeFile(
    filename,
    JSON.stringify({ observedAt: timestamp, ...result }, null, 2) + "\n",
    { mode: 0o600 },
  );
  await chmod(filename, 0o600);
  return filename;
}
