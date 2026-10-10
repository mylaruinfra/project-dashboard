import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type DocumentReader, type RawExtraction, rawExtractionSchema, READER_PROMPT, type ReadInput } from "./types";

/** Default reader: Anthropic Messages API with structured outputs (schema-constrained JSON). */
export class AnthropicReader implements DocumentReader {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-5-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async read(input: ReadInput): Promise<RawExtraction> {
    const data = Buffer.from(input.bytes).toString("base64");
    const file =
      input.mimeType === "application/pdf"
        ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
        : ({ type: "image", source: { type: "base64", media_type: input.mimeType as "image/jpeg" | "image/png" | "image/webp", data } } as const);
    const message = await this.client.messages.parse({
      model: this.model,
      max_tokens: 4096,
      system: READER_PROMPT,
      messages: [
        {
          role: "user",
          content: [file, { type: "text", text: input.kind === "DELIVERY" ? "Read this delivery challan." : "Read this bill." }],
        },
      ],
      output_config: { format: zodOutputFormat(rawExtractionSchema) },
    });
    if (!message.parsed_output) throw new Error("The model did not return readable data.");
    return message.parsed_output;
  }
}
