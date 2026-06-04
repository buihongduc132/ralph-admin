#!/usr/bin/env bun
import { Command } from "commander";

const program = new Command()
  .name("ralph-admin")
  .description("PM2-integrated ralph fleet manager")
  .version("0.1.0");

program.command("list").description("Show all ralph loops").action(() => console.log("TODO: list"));
program.command("status <name>").description("Detailed status of one loop").action(() => console.log("TODO: status"));
program.command("bootstrap <name>")
  .description("Init loop (worktree + state + rules + _GOAL header) WITHOUT starting")
  .option("--source-repo <path>", "Source git repo")
  .action(() => console.log("TODO: bootstrap"));
program.command("start <name>")
  .description("Start ralph loop via PM2 (must bootstrap first)")
  .option("--model <model>", "Model", "bhd-litellm/role-smart")
  .option("--agent <agent>", "Agent", "pi")
  .option("--reuse-state", "Reuse state", false)
  .option("--commit", "Enable commits", false)
  .option("--max-iterations <n>", "Max iterations", "999")
  .action(() => console.log("TODO: start"));
program.command("stop <name>").description("Full stop — delete from PM2 (files kept)").action(() => console.log("TODO: stop"));
program.command("pause <name>").description("Pause at PM2 level (keep registered)").action(() => console.log("TODO: pause"));
program.command("resume <name>").description("Resume paused loop via PM2").action(() => console.log("TODO: resume"));
program.command("restart <name>").description("Hard restart via PM2").action(() => console.log("TODO: restart"));
program.command("doctor").description("Fleet health check").action(() => console.log("TODO: doctor"));
program.command("inventory <name>").description("Show task progress").action(() => console.log("TODO: inventory"));
program.command("inject-header <name>").description("Inject working-dir header into _GOAL").action(() => console.log("TODO: inject-header"));

program.parse();
