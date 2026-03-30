/**
 * Benchmark result metrics for a single request
 */
export interface BenchmarkMetrics {
  /** Total execution time in milliseconds */
  durationMs: number;
  /** Memory used in bytes */
  memoryUsedBytes: number;
  /** CPU time in milliseconds */
  cpuTimeMs: number;
  /** Timestamp when measurement was taken */
  timestamp: Date;
}

/**
 * Aggregated statistics for benchmark results
 */
export interface BenchmarkStats {
  /** Minimum execution time */
  minMs: number;
  /** Maximum execution time */
  maxMs: number;
  /** Average execution time */
  avgMs: number;
  /** Median execution time */
  medianMs: number;
  /** 95th percentile execution time */
  p95Ms: number;
  /** 99th percentile execution time */
  p99Ms: number;
  /** Standard deviation */
  stdDevMs: number;
  /** Requests per second */
  rps: number;
  /** Total requests made */
  totalRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Error rate percentage */
  errorRatePercent: number;
}

/**
 * Configuration for running benchmarks
 */
export interface BenchmarkConfig {
  /** Number of warmup requests */
  warmupIterations: number;
  /** Number of benchmark iterations */
  benchmarkIterations: number;
  /** Number of concurrent requests */
  concurrency: number;
  /** Timeout per request in milliseconds */
  timeoutMs: number;
  /** Enable detailed profiling */
  profileEnabled: boolean;
}

/**
 * Result from a complete benchmark run
 */
export interface BenchmarkResult {
  /** Name of the benchmark stack */
  stackName: string;
  /** Stack configuration description */
  stackDescription: string;
  /** Middleware components in the stack */
  middlewareComponents: string[];
  /** Statistical results */
  stats: BenchmarkStats;
  /** Individual metrics for each iteration */
  individualMetrics: BenchmarkMetrics[];
  /** Configuration used for this benchmark */
  config: BenchmarkConfig;
  /** Baseline comparison (if available) */
  baselineComparison?: BaselineComparison;
  /** When the benchmark was run */
  runTimestamp: Date;
}

/**
 * Comparison against baseline
 */
export interface BaselineComparison {
  /** Baseline stack name */
  baselineName: string;
  /** Absolute overhead in milliseconds */
  absoluteOverheadMs: number;
  /** Relative overhead percentage */
  relativeOverheadPercent: number;
  /** RPS difference */
  rpsDifference: number;
  /** Is this stack significantly slower? */
  isSignificantlySlower: boolean;
}

/**
 * Complete benchmark report with all stacks
 */
export interface BenchmarkReport {
  /** When the report was generated */
  generatedAt: Date;
  /** Environment information */
  environment: EnvironmentInfo;
  /** Configuration used */
  config: BenchmarkConfig;
  /** Results for each stack */
  stackResults: Record<string, BenchmarkResult>;
  /** Comparative analysis */
  comparativeAnalysis: ComparativeAnalysis;
  /** Recommendations based on findings */
  recommendations: Recommendation[];
}

/**
 * Environment information for reproducibility
 */
export interface EnvironmentInfo {
  /** Node.js version */
  nodeVersion: string;
  /** Platform */
  platform: string;
  /** CPU info */
  cpuModel: string;
  /** CPU cores */
  cpuCores: number;
  /** Total memory in GB */
  totalMemoryGB: number;
  /** NestJS version */
  nestJsVersion: string;
}

/**
 * Comparative analysis between stacks
 */
export interface ComparativeAnalysis {
  /** Fastest stack */
  fastestStack: string;
  /** Slowest stack */
  slowestStack: string;
  /** Best RPS */
  bestRps: number;
  /** Worst RPS */
  worstRps: number;
  /** Overhead breakdown by component */
  componentOverhead: ComponentOverhead[];
  /** Performance ranking */
  ranking: StackRanking[];
}

/**
 * Overhead attributed to specific middleware components
 */
export interface ComponentOverhead {
  /** Component name */
  component: string;
  /** Estimated overhead in ms */
  estimatedOverheadMs: number;
  /** Percentage of total overhead */
  overheadPercent: number;
  /** Is this a bottleneck? */
  isBottleneck: boolean;
}

/**
 * Stack performance ranking
 */
export interface StackRanking {
  /** Rank position (1 = best) */
  rank: number;
  /** Stack name */
  stackName: string;
  /** Average response time */
  avgResponseTimeMs: number;
  /** Requests per second */
  rps: number;
  /** Score (normalized performance metric) */
  score: number;
}

/**
 * Performance optimization recommendation
 */
export interface Recommendation {
  /** Priority level (1-5, 1 = highest) */
  priority: number;
  /** Category */
  category: 'performance' | 'security' | 'scalability';
  /** Title/summary */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected middleware/components */
  affectedComponents: string[];
  /** Expected improvement */
  expectedImprovement: string;
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  warmupIterations: 100,
  benchmarkIterations: 1000,
  concurrency: 10,
  timeoutMs: 30000,
  profileEnabled: true,
};
