import { BenchmarkMetrics, BenchmarkConfig, DEFAULT_BENCHMARK_CONFIG } from '../types/benchmark-types';

/**
 * High-precision performance measurement utilities
 */
export class PerformanceMeasurer {
  private readonly hrtime = process.hrtime.bigint;

  /**
   * Measure execution time of a function
   */
  async measureExecution<T>(fn: () => Promise<T>): Promise<{ result: T; metrics: BenchmarkMetrics }> {
    const startTime = this.hrtime();
    const startMemory = process.memoryUsage();
    const startCpuTime = process.cpuUsage();

    let result: T;
    try {
      result = await fn();
    } finally {
      const endTime = this.hrtime();
      const endMemory = process.memoryUsage();
      const endCpuTime = process.cpuUsage();

      // Calculate duration in milliseconds
      const durationMs = Number(endTime - startTime) / 1_000_000;

      // Calculate memory difference in bytes
      const memoryUsedBytes = 
        (endMemory.heapUsed - startMemory.heapUsed) +
        (endMemory.rss - startMemory.rss);

      // Calculate CPU time in milliseconds
      const cpuTimeMs = 
        (endCpuTime.user - startCpuTime.user) / 1000 +
        (endCpuTime.system - startCpuTime.system) / 1000;

      const metrics: BenchmarkMetrics = {
        durationMs,
        memoryUsedBytes,
        cpuTimeMs,
        timestamp: new Date(),
      };

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return { result: result!, metrics };
    }
  }

  /**
   * Run multiple iterations and collect metrics
   */
  async runIterations(
    fn: () => Promise<void>,
    iterations: number,
    concurrency: number = 1,
  ): Promise<BenchmarkMetrics[]> {
    const metrics: BenchmarkMetrics[] = [];

    if (concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < iterations; i++) {
        const { metrics: iterationMetrics } = await this.measureExecution(fn);
        metrics.push(iterationMetrics);
      }
    } else {
      // Concurrent execution
      const batchSize = Math.ceil(iterations / concurrency);
      
      for (let batch = 0; batch < concurrency; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize && batch * batchSize + i < iterations; i++) {
          batchPromises.push(this.measureExecution(fn));
        }
        
        const batchResults = await Promise.all(batchPromises);
        metrics.push(...batchResults.map(r => r.metrics));
      }
    }

    return metrics;
  }

  /**
   * Calculate statistics from metrics
   */
  calculateStats(metrics: BenchmarkMetrics[], totalRequests: number): import('../types/benchmark-types').BenchmarkStats {
    const durations = metrics.map(m => m.durationMs).sort((a, b) => a - b);
    
    const minMs = Math.min(...durations);
    const maxMs = Math.max(...durations);
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    const medianMs = this.percentile(durations, 50);
    const p95Ms = this.percentile(durations, 95);
    const p99Ms = this.percentile(durations, 99);
    const stdDevMs = this.standardDeviation(durations);
    
    const totalDurationSec = durations.reduce((a, b) => a + b, 0) / 1000;
    const rps = totalRequests / totalDurationSec;
    
    const failedRequests = metrics.filter(m => m.durationMs > DEFAULT_BENCHMARK_CONFIG.timeoutMs).length;
    const errorRatePercent = (failedRequests / totalRequests) * 100;

    return {
      minMs,
      maxMs,
      avgMs,
      medianMs,
      p95Ms,
      p99Ms,
      stdDevMs,
      rps,
      totalRequests,
      failedRequests,
      errorRatePercent,
    };
  }

  private percentile(sortedData: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedData.length) - 1;
    return sortedData[Math.max(0, index)];
  }

  private standardDeviation(data: number[]): number {
    const n = data.length;
    const avg = data.reduce((a, b) => a + b, 0) / n;
    const squareDiffs = data.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSquareDiff);
  }
}
