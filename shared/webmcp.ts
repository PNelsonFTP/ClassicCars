import { z } from "zod";
import { searchSchema } from "./schema";
/** Tool inputs are patches: omitted fields must never acquire saved-search defaults. */
export const webMcpPatchSchema = z
  .object({
    query: z.string().max(500).optional(),
    mode: searchSchema.shape.mode.removeDefault().optional(),
    specialty: z.boolean().optional(),
    maxMinutes: searchSchema.shape.maxMinutes.removeDefault().optional(),
    travelMode: searchSchema.shape.travelMode.removeDefault().optional(),
    includeBorderline: z.boolean().optional(),
    allowAdvertisedLocation: z.boolean().optional(),
    planningBuffer: searchSchema.shape.planningBuffer
      .removeDefault()
      .optional(),
  })
  .strict();
