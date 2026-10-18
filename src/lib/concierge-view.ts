import { z } from "zod";
import { campaignById } from "./content";

export const conciergeRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(1500),
          })
          .strict(),
      )
      .max(4)
      .optional(),
  })
  .strict()
  .superRefine(({ history = [] }, context) => {
    if (
      history.length % 2 ||
      history.some((entry, i) => entry.role !== (i % 2 ? "assistant" : "user"))
    )
      context.addIssue({
        code: "custom",
        message: "History requires complete user/assistant exchanges.",
      });
  });
export type ConciergeRequest = z.infer<typeof conciergeRequestSchema>;
export type ConciergeAnswer = {
  requestId: string;
  message: string;
  recommendations: {
    campaignId: string;
    reason: string;
    sources: { id: string; label: string; href: string }[];
  }[];
};

export const conciergeAnswerSchema = z
  .object({
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(800),
    recommendations: z
      .array(
        z
          .object({
            campaignId: z.string().min(1),
            reason: z.string().trim().min(1).max(600),
            sources: z
              .array(
                z
                  .object({
                    id: z.string().min(1),
                    label: z.string().min(1),
                    href: z
                      .string()
                      .regex(/^\/fundraisers\/[a-z0-9-]+#[a-z0-9-]+$/),
                  })
                  .strict(),
              )
              .min(1)
              .max(4),
          })
          .strict(),
      )
      .max(3),
  })
  .strict()
  .superRefine((answer, context) => {
    const seen = new Set<string>();
    for (const r of answer.recommendations) {
      const campaign = campaignById(r.campaignId);
      const validSources = new Set([
        "story",
        "budget",
        "organizer",
        "beneficiary",
        ...(campaign?.updates.map((u) => u.id) ?? []),
      ]);
      if (
        !campaign ||
        r.sources.some((s) => !validSources.has(s.id)) ||
        seen.has(r.campaignId) ||
        r.sources.some((s) => s.href !== `/fundraisers/${r.campaignId}#${s.id}`)
      )
        context.addIssue({
          code: "custom",
          message: "Invalid campaign sources.",
        });
      seen.add(r.campaignId);
    }
  });
export function parseConciergeAnswer(value: unknown): ConciergeAnswer {
  return conciergeAnswerSchema.parse(value);
}
