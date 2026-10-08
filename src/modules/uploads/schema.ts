import { z } from "zod";

export const granularitySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
