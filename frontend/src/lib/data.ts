import recorded from "./recorded.json";
import type { Run, Report } from "./contracts";
export const runs: Run[] = recorded.runs;
export const reports: Record<string, Report> = recorded.reports;
export const scores = recorded.scores;
export const caseCount = recorded.case_count;
export const featuredId = "faulty-knowledge-09";
