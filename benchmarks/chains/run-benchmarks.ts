#!/usr/bin/env ts-node

/**
 * Middleware Stack Performance Benchmark Runner
 * 
 * This script runs comprehensive performance benchmarks for different middleware
 * stack configurations and generates detailed reports.
 * 
 * Usage:
 *   ts-node benchmarks/chains/run-benchmarks.ts
 * 
 * Options:
 *   --iterations=<number>  Number of benchmark iterations (default: 1000)
 *   --concurrency=<number> Number of concurrent requests (default: 10)
 *   --output=<path>        Output path for report (default: docs/PERFORMANCE.md)
 */

import { NestFactory } from '@nestjs/core';
import { Controller, Get, Module } from '@nestjs/common';
import { BenchmarkRunner } from './benchmark-runner';
import { BenchmarkReporter } from './benchmark-reporter';
import { DEFAULT_BENCHMARK_CONFIG } from './types/benchmark-types';
import { MINIMAL_STACK_CONFIG, MinimalStackModule } from './stacks/minimal.stack';
import { AUTH_STACK_CONFIG, AuthStackModule } from './stacks/auth.stack';
import { FULL_STACK_CONFIG, FullStackModule } from './stacks/full.stack';

/**
 * Simple test controller for benchmarking
 */
@Controller('/api/v1/benchmark')
class TestController {
  @Get('/test')
  testEndpoint() {
    return { success: true, timestamp: new Date().toISOString() };
  }
}

/**
 * Test module with minimal configuration
 */
@Module({
  imports: [],
  controllers: [TestController],
})
class TestModule {}

/**
 * Parse command line arguments
 */
function parseArgs(): { iterations: number; concurrency: number; output: string } {
  const args = process.argv.slice(2);
  const config = {
    iterations: DEFAULT_BENCHMARK_CONFIG.benchmarkIterations,
    concurrency: DEFAULT_BENCHMARK_CONFIG.concurrency,
    output: 'docs/PERFORMANCE.md',
  };

  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--iterations') config.iterations = parseInt(value, 10);
    if (key === '--concurrency') config.concurrency = parseInt(value, 10);
    if (key === '--output') config.output = value;
  });

  return config;
}

/**
 * Main benchmark execution
 */
async function runBenchmarks() {
  const args = parseArgs();

  console.log('🚀 Starting Middleware Stack Performance Benchmarks\n');
  console.log(`Configuration:`);
  console.log(`  Iterations: ${args.iterations}`);
  console.log(`  Concurrency: ${args.concurrency}`);
  console.log(`  Output: ${args.output}\n`);

  // Create application instance
  const app = await NestFactory.create(TestModule, {
    bufferLogs: true,
    logger: false, // Disable logging during benchmarks
  });

  // Initialize benchmark components
  const runner = new BenchmarkRunner();
  const reporter = new BenchmarkReporter();

  try {
    await app.init();

    const results = [];

    // Run Minimal Stack benchmark
    const minimalResult = await runner.runBenchmark(
      app,
      MINIMAL_STACK_CONFIG.name,
      MINIMAL_STACK_CONFIG.description,
      MINIMAL_STACK_CONFIG.components,
      '/api/v1/benchmark/test',
      {
        ...DEFAULT_BENCHMARK_CONFIG,
        benchmarkIterations: args.iterations,
        concurrency: args.concurrency,
      },
    );
    results.push(minimalResult);

    // Run Auth Stack benchmark
    const authResult = await runner.runBenchmark(
      app,
      AUTH_STACK_CONFIG.name,
      AUTH_STACK_CONFIG.description,
      AUTH_STACK_CONFIG.components,
      '/api/v1/benchmark/test',
      {
        ...DEFAULT_BENCHMARK_CONFIG,
        benchmarkIterations: args.iterations,
        concurrency: args.concurrency,
      },
    );
    results.push(authResult);

    // Run Full Stack benchmark
    const fullResult = await runner.runBenchmark(
      app,
      FULL_STACK_CONFIG.name,
      FULL_STACK_CONFIG.description,
      FULL_STACK_CONFIG.components,
      '/api/v1/benchmark/test',
      {
        ...DEFAULT_BENCHMARK_CONFIG,
        benchmarkIterations: args.iterations,
        concurrency: args.concurrency,
      },
    );
    results.push(fullResult);

    // Generate report
    console.log('\n📊 Generating comprehensive report...');
    const report = reporter.generateReport(results, {
      ...DEFAULT_BENCHMARK_CONFIG,
      benchmarkIterations: args.iterations,
      concurrency: args.concurrency,
    });

    // Save to markdown
    await reporter.saveToMarkdown(report, args.output);

    // Print executive summary
    console.log('\n' + '='.repeat(80));
    console.log('EXECUTIVE SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nFastest Stack: ${report.comparativeAnalysis.fastestStack}`);
    console.log(`Slowest Stack: ${report.comparativeAnalysis.slowestStack}`);
    console.log(`Best RPS: ${report.comparativeAnalysis.bestRps.toFixed(2)}`);
    console.log(`Worst RPS: ${report.comparativeAnalysis.worstRps.toFixed(2)}`);
    
    console.log('\n📋 Top Recommendations:');
    report.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec.title}`);
    });

    console.log('\n✅ Benchmarks completed successfully!\n');

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Execute benchmarks
runBenchmarks().catch(console.error);
