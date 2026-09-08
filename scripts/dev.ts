import "dotenv/config";
import net from "node:net";
import { spawn } from "node:child_process";
const ports = [
  Number(process.env.MUSCLESCOUT_WEB_PORT || 3100),
  Number(process.env.MUSCLESCOUT_API_PORT || 4410),
];
for (const port of ports)
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is occupied or unavailable. Set a different MuscleScout port in .env; existing applications were left running.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
const children = [
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "-p",
      String(ports[0]),
    ],
    { stdio: "inherit", env: process.env },
  ),
  ...["server/index.ts", "server/worker.ts"].map((file) =>
    spawn(process.execPath, ["--import", "tsx", file], {
      stdio: "inherit",
      env: process.env,
    }),
  ),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  children.forEach((c) => c.kill("SIGTERM"));
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
children.forEach((c) =>
  c.on("exit", (code) => {
    if (!stopping && code) stop();
  }),
);
