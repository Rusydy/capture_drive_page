import { z } from "zod";

export const DRIVE_URL = z.url().parse(process.env.DRIVE_URL);
