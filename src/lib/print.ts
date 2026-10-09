/* Print Center configuration shared by the modal and report renderer. */

export type PrintReportType =
  | "today"
  | "week"
  | "month"
  | "tasks"
  | "papers"
  | "full";

export interface PrintConfig {
  type: PrintReportType;
  includeCompleted: boolean;
  includeMeals: boolean;
  includeNotes: boolean;
  compact: boolean;
}

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  type: "week",
  includeCompleted: false,
  includeMeals: true,
  includeNotes: true,
  compact: false,
};