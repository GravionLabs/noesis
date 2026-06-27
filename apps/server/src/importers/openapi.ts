import yaml from "js-yaml";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { fetchOrThrow } from "../utils/fetch.js";

interface OpenApiSchema {
  type?: string;
  description?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  $ref?: string;
  enum?: string[];
  required?: string[];
  additionalProperties?: boolean | OpenApiSchema;
  example?: unknown;
}

interface OpenApiParameter {
  name: string;
  in?: string;
  description?: string;
  required?: boolean;
  schema?: OpenApiSchema;
  style?: string;
  explode?: boolean;
}

interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, { schema?: OpenApiSchema }>;
}

interface OpenApiResponse {
  description?: string;
  content?: Record<string, { schema?: OpenApiSchema }>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
  deprecated?: boolean;
}

interface OpenApiComponents {
  schemas?: Record<string, OpenApiSchema>;
}

interface OpenApiSpec {
  openapi?: string;
  info?: { title?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: OpenApiComponents;
}

function isYamlUrl(url: string): boolean {
  return /\.ya?ml$/i.test(url);
}

async function parseSpec(res: Response, url: string): Promise<OpenApiSpec> {
  if (isYamlUrl(url)) {
    const text = await res.text();
    return yaml.load(text) as OpenApiSpec;
  }
  return res.json() as Promise<OpenApiSpec>;
}

function formatSchema(schema: OpenApiSchema, indent = ""): string {
  if (schema.$ref) return `${indent}$ref: ${schema.$ref}`;
  const parts: string[] = [];
  if (schema.type) parts.push(`type: ${schema.type}`);
  if (schema.description) parts.push(`description: ${schema.description}`);
  if (schema.enum) parts.push(`enum: [${schema.enum.join(", ")}]`);
  if (schema.required) parts.push(`required: [${schema.required.join(", ")}]`);
  if (schema.properties) {
    const props = Object.entries(schema.properties)
      .map(([k, v]) => `${indent}  ${k}: ${formatSchema(v, indent + "    ")}`)
      .join("\n");
    parts.push(`properties:\n${props}`);
  }
  if (schema.items) {
    parts.push(`items: ${formatSchema(schema.items, indent + "  ")}`);
  }
  return parts.join("\n" + indent);
}

function formatParameters(params: OpenApiParameter[] | undefined): string {
  if (!params || params.length === 0) return "";
  const lines = params.map((p) => {
    const parts = [`- ${p.name}`];
    if (p.in) parts.push(`(${p.in})`);
    if (p.required) parts.push("[required]");
    if (p.description) parts.push(`: ${p.description}`);
    if (p.schema) parts.push(`\n    schema: ${formatSchema(p.schema, "    ")}`);
    return parts.join(" ");
  });
  return `Parameters:\n${lines.join("\n")}`;
}

function formatRequestBody(rb: OpenApiRequestBody | undefined): string {
  if (!rb) return "";
  const lines: string[] = [];
  if (rb.description) lines.push(`Description: ${rb.description}`);
  if (rb.required) lines.push("Required: true");
  if (rb.content) {
    for (const [contentType, content] of Object.entries(rb.content)) {
      lines.push(`Content-Type: ${contentType}`);
      if (content.schema) lines.push(`  schema: ${formatSchema(content.schema, "  ")}`);
    }
  }
  return lines.length > 0 ? `Request Body:\n${lines.join("\n")}` : "";
}

function formatResponses(responses: Record<string, OpenApiResponse> | undefined): string {
  if (!responses || Object.keys(responses).length === 0) return "";
  const lines = Object.entries(responses).map(([code, resp]) => {
    const parts = [`- ${code}: ${resp.description ?? ""}`];
    if (resp.content) {
      for (const [ct, content] of Object.entries(resp.content)) {
        parts.push(`\n  ${ct}`);
        if (content.schema) parts.push(`\n  schema: ${formatSchema(content.schema, "  ")}`);
      }
    }
    return parts.join("");
  });
  return `Responses:\n${lines.join("\n")}`;
}

function formatSchemaBlock(name: string, schema: OpenApiSchema): string {
  return `Schema: ${name}\n${formatSchema(schema)}`;
}

export class OpenApiImporter implements Importer {
  readonly type = "openapi";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetchOrThrow(source.url);
    const spec = await parseSpec(res, source.url);
    const apiTitle = spec.info?.title ?? source.name;
    const docUrl = source.url;

    const chunks: CrawlChunkData[] = [];

    if (spec.info?.description) {
      chunks.push({
        docUrl,
        docTitle: apiTitle,
        content: spec.info.description,
        heading: "Description",
        headingPath: ["Description"],
        chunkIndex: 0,
      });
    }

    if (spec.components?.schemas) {
      let schemaIndex = chunks.length;
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        chunks.push({
          docUrl,
          docTitle: apiTitle,
          content: formatSchemaBlock(name, schema),
          heading: `Schema: ${name}`,
          headingPath: ["Schemas", name],
          chunkIndex: schemaIndex++,
        });
      }
    }

    if (!spec.paths) return this.chunkService.saveChunks(chunks, source.id);

    let chunkIndex = chunks.length;
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const sections: string[] = [];
        if (op.summary) sections.push(op.summary);
        if (op.description) sections.push(op.description);
        sections.push(`Operation ID: ${op.operationId ?? "N/A"}`);
        sections.push(`Tags: ${(op.tags ?? []).join(", ") || "N/A"}`);
        if (op.deprecated) sections.push("Deprecated: true");

        const params = formatParameters(op.parameters);
        if (params) sections.push(params);

        const rb = formatRequestBody(op.requestBody);
        if (rb) sections.push(rb);

        const resps = formatResponses(op.responses);
        if (resps) sections.push(resps);

        const content = sections.join("\n\n");

        chunks.push({
          docUrl,
          docTitle: `${method.toUpperCase()} ${path}`,
          content,
          heading: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
          headingPath: [
            ...(op.tags ?? []),
            op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
          ],
          chunkIndex: chunkIndex++,
        });
      }
    }

    return this.chunkService.saveChunks(chunks, source.id);
  }
}
