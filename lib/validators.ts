import { IdentificationStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .nullish()
  .transform((value) => {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  });

export const imageInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1).max(1024),
  altText: optionalText,
  caption: optionalText,
  sortOrder: z.number().int().min(0).default(0)
});

export const observationInputSchema = z.object({
  title: optionalText,
  notes: z.string().trim().min(3).max(4000),
  observedAt: z.coerce.date(),
  locationText: optionalText,
  habitatTags: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
  behaviorText: optionalText
});

export const entryPayloadSchema = z.object({
  categoryId: z.string().trim().min(1),
  name: optionalText,
  description: z.string().trim().min(12).max(5000),
  identificationStatus: z.nativeEnum(IdentificationStatus),
  locationText: optionalText,
  habitatText: optionalText,
  habitatTags: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
  behaviorText: optionalText,
  images: z.array(imageInputSchema).max(12).default([]),
  observations: z.array(observationInputSchema).max(50).default([])
});

export const categoryPayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText,
  parentId: z
    .string()
    .trim()
    .min(1)
    .nullish()
    .transform((value) => value ?? undefined)
});

export type EntryPayload = z.infer<typeof entryPayloadSchema>;
export type CategoryPayload = z.infer<typeof categoryPayloadSchema>;