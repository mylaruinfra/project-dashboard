import { z } from "zod";

/**
 * What a reader returns. Numbers are strings exactly as printed (e.g. "1,06,000.00") so no
 * float ever touches money; normalize.ts converts them to paise / milli-units.
 */
export const rawExtractionSchema = z.object({
  documentType: z.enum(["bill", "challan", "other"]).describe("bill = tax invoice or bill with prices; challan = delivery challan / delivery note"),
  vendorName: z.string().nullable().describe("Seller / supplier name as printed"),
  vendorGstin: z.string().nullable().describe("Seller GSTIN, 15 characters, or null"),
  documentNumber: z.string().nullable().describe("Invoice / bill / challan number"),
  date: z.string().nullable().describe("Document date exactly as printed, e.g. 05/10/2026"),
  vehicleNo: z.string().nullable().describe("Vehicle / lorry number if printed"),
  lines: z
    .array(
      z.object({
        description: z.string().describe("Item description incl. grade/spec"),
        quantity: z.string().nullable().describe("Quantity digits as printed, e.g. 50 or 12.5"),
        unit: z.string().nullable().describe("Unit as printed: bags, MT, kg, brass, nos, CFT, trips, hours"),
        rate: z.string().nullable().describe("Rate per unit in rupees as printed, without the ₹ sign"),
        amount: z.string().nullable().describe("Line amount in rupees as printed, before tax"),
      }),
    )
    .describe("One entry per item line. Do not include tax or total rows."),
  subtotal: z.string().nullable().describe("Taxable value / subtotal in rupees"),
  taxTotal: z.string().nullable().describe("Total GST (CGST + SGST + IGST) in rupees"),
  total: z.string().nullable().describe("Grand total / amount payable in rupees"),
});

export type RawExtraction = z.infer<typeof rawExtractionSchema>;

export interface ReadInput {
  bytes: Uint8Array;
  mimeType: string;
  kind: "TRANSACTION" | "DELIVERY";
}

/** Anything that can turn a bill or challan into a RawExtraction. */
export interface DocumentReader {
  readonly name: string;
  read(input: ReadInput): Promise<RawExtraction>;
}

export const READER_PROMPT = `You read Indian construction bills and delivery challans (cement, steel, sand, aggregate, bricks, machinery hire, transport).
Extract the fields exactly as printed. Never guess or calculate missing numbers: use null when a value is not printed or not legible.
Copy numbers as printed digits (commas allowed), without the ₹ sign. Each item row is one line; tax rows (CGST, SGST, IGST) go into taxTotal, not lines.`;
