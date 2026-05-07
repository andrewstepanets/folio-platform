import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  commit: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
