import { z } from 'zod';

/** A single invoice line as edited in the form. `id` is only present once the row has been
 * persisted (an existing invoiceItems row) — new rows (typed manually or added from the
 * approved-hours modal) have no `id` until the next save.
 *
 * Numeric fields are plain z.number() rather than z.coerce.number(): every numeric <input> in
 * InvoiceItemRows/InvoiceForm is registered with `{ valueAsNumber: true }`, so RHF's own form
 * state already holds numbers, not strings. z.coerce here would make the resolver's input type
 * diverge from its output type (unknown vs number), which breaks useForm<InvoiceFormValues>'s
 * generic — see @hookform/resolvers zod issues re: coerce + explicit TFieldValues. */
export const invoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  vatRate: z.number().min(0).max(100),
  sourceTimeEntryIds: z.array(z.string()).optional(),
});

/** Full validation — only required for "Send to Client"; "Save as Draft" only requires a
 * client to be picked (see InvoiceForm#handleSaveDraft). */
export const invoiceFormSchema = z.object({
  companyId: z.string().min(1),
  paymentTermDays: z.number().min(0).max(365),
  instructionsText: z.string().optional(),
  footerText: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>;
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
