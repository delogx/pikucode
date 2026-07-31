import {
  PIKU_PROJECT_FILE_NAME,
  type EnvironmentId,
  type PikuProjectFileScript,
} from "@piku/contracts";
import { PikuProjectFileFromJson } from "@piku/shared/pikuProjectFile";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { useMemo } from "react";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const decodePikuProjectFile = Schema.decodeExit(PikuProjectFileFromJson);

const NO_SCRIPTS: ReadonlyArray<PikuProjectFileScript> = [];

/**
 * Scripts declared in the project's checked-in `piku.json`, offered in the
 * scripts menu for import. Missing, truncated, or invalid files resolve to
 * an empty list.
 */
export function usePikuProjectFileScripts(
  environmentId: EnvironmentId,
  cwd: string | null,
): ReadonlyArray<PikuProjectFileScript> {
  const query = useProjectFileQuery(environmentId, cwd ?? "", PIKU_PROJECT_FILE_NAME, cwd !== null);
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  return useMemo(() => {
    if (contents === null) return NO_SCRIPTS;
    const decoded = decodePikuProjectFile(contents);
    if (Exit.isFailure(decoded)) return NO_SCRIPTS;
    return decoded.value.scripts ?? NO_SCRIPTS;
  }, [contents]);
}
