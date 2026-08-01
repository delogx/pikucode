import * as Schema from "effect/Schema";

import { PikuProjectFile, PIKU_PROJECT_FILE_SCHEMA_URL } from "@piku/contracts";

import { fromLenientJson } from "./schemaJson.ts";

/**
 * Codec between the raw `piku.json` file contents (lenient JSONC string) and the
 * decoded {@link PikuProjectFile}.
 */
export const PikuProjectFileFromJson = fromLenientJson(PikuProjectFile);

/**
 * Build the publishable JSON Schema document for `piku.json` (draft 2020-12).
 *
 * Served from the marketing site at {@link PIKU_PROJECT_FILE_SCHEMA_URL} so
 * editors get LSP support via a `$schema` reference.
 */
export function buildPikuProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(PikuProjectFile);
  const jsonSchema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: PIKU_PROJECT_FILE_SCHEMA_URL,
    ...document.schema,
  };
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions;
  }
  return jsonSchema;
}
