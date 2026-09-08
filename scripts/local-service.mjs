import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd(),
  generated = path.join(root, "generated", "local-service"),
  logs = path.join(root, "logs");
const label = "org.musclescout.local",
  mode = process.argv[2] || "generate";
if (!["generate", "install", "uninstall"].includes(mode))
  throw new Error("Usage: npm run service -- generate|install|uninstall");
await mkdir(generated, { recursive: true });
await mkdir(logs, { recursive: true, mode: 0o700 });
const xml = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const ps = (s) => "'" + s.replaceAll("'", "''") + "'";
const systemd = (s) =>
  '"' +
  s.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%") +
  '"';
const args = [
  process.execPath,
  "--import",
  "tsx",
  path.join(root, "scripts", "dev.ts"),
];
const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map((a) => `<string>${xml(a)}</string>`).join("")}</array><key>WorkingDirectory</key><string>${xml(root)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>StandardOutPath</key><string>${xml(path.join(logs, "service.log"))}</string><key>StandardErrorPath</key><string>${xml(path.join(logs, "service-error.log"))}</string></dict></plist>`;
const unit = `[Unit]\nDescription=MuscleScout personal local app\nAfter=network-online.target\n[Service]\nType=simple\nWorkingDirectory=${systemd(root)}\nExecStart=${args.map(systemd).join(" ")}\nKillMode=mixed\nTimeoutStopSec=90\nRestart=no\n[Install]\nWantedBy=default.target\n`;
const installPs = `$ErrorActionPreference = 'Stop'\n$action = New-ScheduledTaskAction -Execute ${ps(process.execPath)} -Argument ${ps('--import tsx "' + path.join(root, "scripts", "dev.ts") + '"')} -WorkingDirectory ${ps(root)}\n$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)\n$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew\nRegister-ScheduledTask -TaskName ${ps(label)} -Action $action -Trigger $trigger -Settings $settings -Description 'MuscleScout personal local app' -Force | Out-Null\n`;
await writeFile(path.join(generated, `${label}.plist`), plist);
await writeFile(path.join(generated, "musclescout.service"), unit);
await writeFile(path.join(generated, "install.ps1"), installPs);
await writeFile(
  path.join(generated, "plan.json"),
  JSON.stringify(
    {
      mode,
      platform: process.platform,
      root,
      command: args,
      ports: "From private .env (defaults web3100/api4410)",
      starts: ["local web", "API", "durable worker"],
      schedule: "User login",
      restart: "Manual after errors; avoids repeated retries on occupied ports",
      notes:
        "Generate never enables startup. Stop any current MuscleScout launch before installing. Credentials stay in .env.",
    },
    null,
    2,
  ),
);
function run(command, args, allowed = [0]) {
  const r = spawnSync(command, args, { stdio: "inherit" });
  if (r.error) throw r.error;
  if (!allowed.includes(r.status))
    throw new Error(`${command} failed (${r.status})`);
}
if (mode !== "generate") {
  if (process.platform === "darwin") {
    const directory = path.join(homedir(), "Library", "LaunchAgents"),
      target = path.join(directory, `${label}.plist`),
      domain = `gui/${process.getuid()}`;
    if (mode === "install") {
      await mkdir(directory, { recursive: true });
      await copyFile(path.join(generated, `${label}.plist`), target);
      run("launchctl", ["bootstrap", domain, target]);
    } else {
      run("launchctl", ["bootout", `${domain}/${label}`], [0, 3, 5, 113]);
      await rm(target, { force: true });
    }
  } else if (process.platform === "linux") {
    const directory = path.join(homedir(), ".config", "systemd", "user"),
      target = path.join(directory, "musclescout.service");
    if (mode === "install") {
      await mkdir(directory, { recursive: true });
      await copyFile(path.join(generated, "musclescout.service"), target);
      run("systemctl", ["--user", "daemon-reload"]);
      run("systemctl", ["--user", "enable", "--now", "musclescout.service"]);
    } else {
      run("systemctl", ["--user", "disable", "--now", "musclescout.service"]);
      await rm(target, { force: true });
      run("systemctl", ["--user", "daemon-reload"]);
    }
  } else if (process.platform === "win32") {
    if (mode === "install")
      run("powershell.exe", [
        "-NoProfile",
        "-File",
        path.join(generated, "install.ps1"),
      ]);
    else run("schtasks.exe", ["/Delete", "/TN", label, "/F"]);
  } else throw new Error("Unsupported local service platform");
}
console.log(
  JSON.stringify({
    mode,
    generated,
    installed: mode === "install",
    uninstalled: mode === "uninstall",
  }),
);
