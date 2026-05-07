import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@folio/shared";

@Controller()
export class HealthController {
  @Get("health")
  health(): HealthResponse {
    return {
      status: "ok",
      commit: process.env.GIT_COMMIT ?? "dev",
    };
  }
}
