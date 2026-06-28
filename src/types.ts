// Snapshot ghi bởi media/statusline-bridge.cjs (đọc từ status line của Claude Code).
// Các trường đều optional vì rate_limits chỉ xuất hiện với tài khoản Pro/Max và
// chỉ sau phản hồi đầu tiên của phiên.
export interface LiveUsage {
  updatedAt: number; // epoch ms
  model?: string;
  rateLimits?: {
    fiveHourPct?: number;
    fiveHourResetsAt?: number; // epoch seconds
    sevenDayPct?: number;
    sevenDayResetsAt?: number; // epoch seconds
  };
  contextPct?: number;
  costUsd?: number;
}
