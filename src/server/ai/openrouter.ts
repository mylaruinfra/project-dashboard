import { z } from "zod";
import { type DocumentReader, type RawExtraction, rawExtractionSchema, READER_PROMPT, type ReadInput } from "./types";

/** Alternative reader: OpenRouter's OpenAI-compatible API with a JSON schema response format. */
export class OpenRouterReader implements DocumentReader {
  readonly name = "openrouter";

  constructor(
    private apiKey: string,
    private model = "anthropic/claude-sonnet-5.5",
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async read(input: ReadInput): Promise<RawExtraction> {
    const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`;
    const filePart =
      input.mimeType === "application/pdf"
        ? { type: "file", file: { filename: "document.pdf", file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } };
    const res = await this.fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Title": "SiteBook" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: READER_PROMPT },
          { role: "user", content: [filePart, { type: "text", text: input.kind === "DELIVERY" ? "Read this delivery challan." : "Read this bill." }] },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "extraction", strict: true, schema: z.toJSONSchema(rawExtractionSchema) },
        },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content.");
    const json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return rawExtractionSchema.parse(json);
  }
}
