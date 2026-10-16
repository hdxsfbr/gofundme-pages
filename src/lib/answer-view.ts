import { z } from "zod";
const citation = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  date: z.iso.datetime(),
  href: z.string().startsWith("/fundraisers/"),
});
export const answerViewSchema = z
  .object({
    status: z.enum(["supported", "missing"]),
    claims: z.array(
      z.object({ text: z.string(), citations: z.array(citation).min(1) }),
    ),
    missing: z.string(),
    facts: z.array(z.object({ label: z.string(), value: z.string() })),
    snapshot: z.iso.datetime(),
    requestId: z.uuid().optional(),
  })
  .refine((answer) => answer.status !== "missing" || !!answer.missing.trim(), {
    message: "Missing-information answers require an explanation.",
  });
export type AnswerView = z.infer<typeof answerViewSchema>;
