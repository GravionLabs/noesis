import pino from "pino";
import { ecsFormat } from "@elastic/ecs-pino-format";
import { config } from "./config/index.js";

function buildTransport() {
  const sink = config.LOG_SINK;
  if (sink === "seq") {
    return {
      target: "pino-seq",
      options: { serverUrl: config.SEQ_URL },
    };
  }
  if (!sink) {
    return {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    };
  }
  return undefined;
}

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: "noesis" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.LOG_SINK === "ecs" ? ecsFormat() : {}),
  transport: buildTransport(),
});
