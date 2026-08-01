import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { CheckIcon } from "lucide-react";
import type { SidebarArtwork } from "@piku/contracts/settings";

import { cn } from "../../lib/utils";
import {
  getStageArtwork,
  STAGE_ARTWORKS,
  StageArtworkFill,
  type StageArtwork,
  type StageArtworkId,
} from "../SidebarStageBackdrop";
import { RadioGroup } from "../ui/radio-group";

/**
 * Thumbnail radio grid for the sidebar artwork setting. The Auto tile previews
 * whatever "auto" resolves to right now so the choice is honest about its
 * outcome on this environment.
 */
export function StageArtworkPicker({
  value,
  autoResolvedArtworkId,
  onValueChange,
}: {
  value: SidebarArtwork;
  autoResolvedArtworkId: StageArtworkId | null;
  onValueChange: (value: SidebarArtwork) => void;
}) {
  const options: ReadonlyArray<{
    value: SidebarArtwork;
    label: string;
    artwork: StageArtwork | null;
  }> = [
    {
      value: "auto",
      label: "Auto",
      artwork: autoResolvedArtworkId === null ? null : getStageArtwork(autoResolvedArtworkId),
    },
    ...STAGE_ARTWORKS.map((artwork) => ({ value: artwork.id, label: artwork.name, artwork })),
  ];

  return (
    <RadioGroup
      aria-label="Sidebar artwork"
      className="grid w-full grid-cols-2 gap-2 pb-2 sm:grid-cols-3"
      value={value}
      onValueChange={(next) => onValueChange(next as SidebarArtwork)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <RadioPrimitive.Root
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className={cn(
              "group flex cursor-pointer flex-col gap-1 rounded-lg border p-1 text-left outline-none transition-[border-color,box-shadow,background-color]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isSelected
                ? "border-primary bg-background shadow-sm ring-2 ring-primary/35 dark:bg-primary/10 dark:shadow-none"
                : "border-border bg-background hover:border-foreground/25 dark:border-transparent dark:bg-white/[0.035] dark:hover:bg-accent",
            )}
          >
            <span aria-hidden className="relative block h-12 w-full overflow-hidden rounded-md">
              {option.artwork ? (
                <StageArtworkFill artwork={option.artwork} />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-muted/60 text-[10px] font-medium text-muted-foreground">
                  No artwork
                </span>
              )}
            </span>
            <span className="flex min-h-4 items-center gap-1 px-1 pb-0.5">
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  isSelected ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {option.label}
              </span>
              {isSelected ? (
                <CheckIcon aria-hidden className="ml-auto size-3 shrink-0 text-primary" />
              ) : null}
            </span>
          </RadioPrimitive.Root>
        );
      })}
    </RadioGroup>
  );
}
