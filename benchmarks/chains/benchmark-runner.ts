import { Injectable } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PerformanceMeasurer } from '../utils/performance-measurer';
import {
  BenchmarkConfig,
  BenchmarkResult,
  DEFAULT_BENCHMARK_CONFIG,
} from '../types/benchmark-types';

/**
 * Runs benchmarks for middleware stacks
 */
@Injectable()
export class BenchmarkRunner {
  private readonly measurer = new PerformanceMeasurer();

  /**
   * Run benchmark for a specific middleware stack
   */
  async runBenchmark(
    app: INestApplication,
    stackName: string,
    stackDescription: string,
    middlewareComponents: string[],
    endpoint: string = '/api/v1/benchmark/test',
    config: BenchmarkConfig = DEFAULT_BENCHMARK_CONFIG,
  ): Promise<BenchmarkResult> {
    console.log(`\n📊 Running benchmark: ${stackName}`);
    console.log(`   Description: ${stackDescription}`);
    console.log(`   Components: ${middlewareComponents.join(', ')}`);
    console.log(`   Iterations: ${config.benchmarkIterations}`);
    console.log(`   Concurrency: ${config.concurrency}`);

    // Warmup phase
    console.log('\n🔥 Warming up...');
    await this.runWarmup(app, endpoint, config.warmupIterations);

    // Benchmark phase
    console.log('⚡ Running benchmarks...');
    const metrics = await this.measurer.runIterations(
      () => this.makeRequest(app, endpoint),
      config.benchmarkIterations,
      config.concurrency,
    );

    // Calculate statistics
    const stats = this.measurer.calculateStats(metrics, config.benchmarkIterations);

    const result: BenchmarkResult = {
      stackName,
      stackDescription,
      middlewareComponents,
      stats,
      individualMetrics: metrics,
      config,
      runTimestamp: new Date(),
    };

    // Print summary
    this.printSummary(result);

    return result;
  }

  /**
   * Run warmup requests to stabilize performance
   */
  private async runWarmup(app: INestApplication, endpoint: string, iterations: number): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      await this.makeRequest(app, endpoint);
    }
  }

  /**
   * Make a single HTTP request through the middleware stack
   */
  private async makeRequest(app: INestApplication, endpoint: string): Promise<void> {
    const httpServer = app.getHttpServer();
    
    await request(httpServer)
      .get(endpoint)
      .set('Accept', 'application/json')
      .set('User-Agent', 'BenchmarkRunner/1.0')
      .expect(200);
  }

  /**
   * Print benchmark summary to console
   */
  private printSummary(result: BenchmarkResult): void {
    console.log('\n📈 Results Summary:');
    console.log(`   Min: ${result.stats.minMs.toFixed(2)} ms`);
    console.log(`   Max: ${result.stats.maxMs.toFixed(2)} ms`);
    console.log(`   Avg: ${result.stats.avgMs.toFixed(2)} ms`);
    console.log(`   Median: ${result.stats.medianMs.toFixed(2)} ms`);
    console.log(`   P95: ${result.stats.p95Ms.toFixed(2)} ms`);
    console.log(`   P99: ${result.stats.p99Ms.toFixed(2)} ms`);
    console.log(`   Std Dev: ${result.stats.stdDevMs.toFixed(2)} ms`);
    console.log(`   RPS: ${result.stats.rps.toFixed(2)}`);
    console.log(`   Error Rate: ${result.stats.errorRatePercent.toFixed(2)}%`);
  }

  /**
   * Compare two benchmark results
   */
  compareResults(baseline: BenchmarkResult, comparison: BenchmarkResult): import('../types/benchmark-types').BaselineComparison {
    const absoluteOverheadMs = comparison.stats.avgMs - baseline.stats.avgMs;
    const relativeOverheadPercent = (absoluteOverheadMs / baseline.stats.avgMs) * 100;
    const rpsDifference = comparison.stats.rps - baseline.stats.rps;
    
    // Consider significantly slower if overhead > 10% or > 5ms
    const isSignificantlySlower = relativeOverheadPercent > 10 || absoluteOverheadMs > 5;

    return {
      baselineName: baseline.stackName,
      absoluteOverheadMs,
      relativeOverheadPercent,
      rpsDifference,
      isSignificantlySlower,
    };
  }
}
