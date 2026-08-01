import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import { ProjectScriptIcon } from "./project.ts";

/** File name of the checked-in Piku project file, resolved at the workspace root. */
export const PIKU_PROJECT_FILE_NAME = "piku.json";

/** Public URL of the published JSON Schema for {@link PikuProjectFile}. */
export const PIKU_PROJECT_FILE_SCHEMA_URL = "https://pikucode.dev/schema/piku.json";

const PIKU_PROJECT_FILE_PATH_MAX_LENGTH = 512;
const PIKU_PROJECT_FILE_MAX_SCRIPTS = 50;

// Annotations go on the encoded (string) side so they survive into the
// published JSON Schema; decoding still trims and re-validates non-emptiness.
const trimmedNonEmpty = (annotations: { readonly description: string }, maxLength?: number) => {
  const annotated = Schema.String.annotate(annotations);
  const encoded =
    maxLength === undefined
      ? annotated.check(Schema.isNonEmpty())
      : annotated.check(Schema.isNonEmpty(), Schema.isMaxLength(maxLength));
  return encoded.pipe(Schema.decodeTo(encoded, SchemaTransformation.trim()));
};

export const PikuProjectFileScript = Schema.Struct({
  name: trimmedNonEmpty({
    description: "Display name for the script, shown in the Piku Code scripts menu.",
  }),
  command: trimmedNonEmpty({
    description: "Shell command executed in a Piku Code terminal at the project root.",
  }),
  icon: Schema.optionalKey(
    ProjectScriptIcon.annotate({
      description: 'Icon shown next to the script in the scripts menu. Defaults to "play".',
    }),
  ),
  runOnWorktreeCreate: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, the script runs automatically after a worktree is created for a new thread.",
    }),
  ),
  previewUrl: Schema.optionalKey(
    trimmedNonEmpty({
      description:
        "URL opened in the in-app browser preview when this script runs. Only honored on the desktop build.",
    }),
  ),
  autoOpenPreview: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, automatically open the preview panel at `previewUrl` the moment the script starts.",
    }),
  ),
}).annotate({
  description: "A project script that team members can import into Piku Code.",
});
export type PikuProjectFileScript = typeof PikuProjectFileScript.Type;

export const PikuProjectFile = Schema.Struct({
  $schema: Schema.optionalKey(
    Schema.String.annotate({
      description: `URL of the JSON Schema for this file, typically "${PIKU_PROJECT_FILE_SCHEMA_URL}".`,
    }),
  ),
  iconPath: Schema.optionalKey(
    trimmedNonEmpty(
      {
        description:
          'Workspace-relative path to the project icon (e.g. "assets/logo.svg"). Checked before Piku Code\'s built-in icon locations.',
      },
      PIKU_PROJECT_FILE_PATH_MAX_LENGTH,
    ),
  ),
  scripts: Schema.optionalKey(
    Schema.Array(PikuProjectFileScript)
      .annotate({
        description: "Project scripts shared with everyone who opens this repository in Piku Code.",
      })
      .check(Schema.isMaxLength(PIKU_PROJECT_FILE_MAX_SCRIPTS)),
  ),
}).annotate({
  title: "Piku project file",
  description:
    "Checked-in project configuration for Piku Code (piku.json at the repository root). See https://pikucode.dev for documentation.",
});
export type PikuProjectFile = typeof PikuProjectFile.Type;
