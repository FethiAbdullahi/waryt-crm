/** Bump when hint copy changes so contextual cards can reappear once. */
export const CURRENT_HINTS_VERSION = 1 as const;

export type HintId = "home" | "salesStudioOverview" | "challenges" | "reports";

export type HelpSectionId =
  | "nav"
  | "warytStudio"
  | "quickAdd"
  | "search"
  | "theme";
