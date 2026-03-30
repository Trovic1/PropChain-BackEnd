import { BenchmarkReport, BenchmarkResult, ComparativeAnalysis, ComponentOverhead, StackRanking, Recommendation } from '../types/benchmark-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates comprehensive benchmark reports and documentation
 */
export class BenchmarkReporter {
  /**
   * Generate complete benchmark report
   */
  generateReport(
    results: BenchmarkResult[],
    config: import('../types/benchmark-types').BenchmarkConfig,
  ): BenchmarkReport {
    const environment = this.getEnvironmentInfo();
    
    // Find baseline (no middleware) for comparisons
    const baseline = results.find(r => r.middlewareComponents.length === 0);
    
    // Add baseline comparisons to each result
    const resultsWithComparison = baseline 
      ? results.map(result => ({
          ...result,
          baselineComparison: this.compareWithBaseline(result, baseline),
        }))
      : results;

    // Generate comparative analysis
    const comparativeAnalysis = this.generateComparativeAnalysis(resultsWithComparison);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(resultsWithComparison, comparativeAnalysis);

    return {
      generatedAt: new Date(),
      environment,
      config,
      stackResults: this.indexResultsByStackName(resultsWithComparison),
      comparativeAnalysis,
      recommendations,
    };
  }

  /**
   * Compare result with baseline
   */
  private compareWithBaseline(
    result: BenchmarkResult,
    baseline: BenchmarkResult,
  ): import('../types/benchmark-types').BaselineComparison {
    const absoluteOverheadMs = result.stats.avgMs - baseline.stats.avgMs;
    const relativeOverheadPercent = (absoluteOverheadMs / baseline.stats.avgMs) * 100;
    const rpsDifference = result.stats.rps - baseline.stats.rps;
    const isSignificantlySlower = relativeOverheadPercent > 10 || absoluteOverheadMs > 5;

    return {
      baselineName: baseline.stackName,
      absoluteOverheadMs,
      relativeOverheadPercent,
      rpsDifference,
      isSignificantlySlower,
    };
  }

  /**
   * Generate comparative analysis
   */
  private generateComparativeAnalysis(results: BenchmarkResult[]): ComparativeAnalysis {
    const sorted = [...results].sort((a, b) => a.stats.avgMs - b.stats.avgMs);
    
    const fastest = sorted[0];
    const slowest = sorted[sorted.length - 1];
    
    const ranking: StackRanking[] = sorted.map((result, index) => ({
      rank: index + 1,
      stackName: result.stackName,
      avgResponseTimeMs: result.stats.avgMs,
      rps: result.stats.rps,
      score: this.calculatePerformanceScore(result),
    }));

    const componentOverhead = this.analyzeComponentOverhead(results);

    return {
      fastestStack: fastest.stackName,
      slowestStack: slowest.stackName,
      bestRps: fastest.stats.rps,
      worstRps: slowest.stats.rps,
      componentOverhead,
      ranking,
    };
  }

  /**
   * Analyze overhead contributed by each middleware component
   */
  private analyzeComponentOverhead(results: BenchmarkResult[]): ComponentOverhead[] {
    const baseline = results.find(r => r.middlewareComponents.length === 0);
    if (!baseline) return [];

    const baseAvg = baseline.stats.avgMs;
    const components = new Map<string, number[]>();

    // Collect overhead data for each component
    results.forEach(result => {
      const totalOverhead = result.stats.avgMs - baseAvg;
      result.middlewareComponents.forEach(component => {
        if (!components.has(component)) {
          components.set(component, []);
        }
        components.get(component)!.push(totalOverhead / result.middlewareComponents.length);
      });
    });

    // Calculate average overhead per component
    const overheadList: ComponentOverhead[] = Array.from(components.entries()).map(([component, overheads]) => {
      const avgOverhead = overheads.reduce((a, b) => a + b, 0) / overheads.length;
      const totalOverhead = results.reduce((sum, r) => sum + (r.stats.avgMs - baseAvg), 0);
      const overheadPercent = (avgOverhead / totalOverhead) * 100;
      const isBottleneck = avgOverhead > 2 || overheadPercent > 20;

      return {
        component,
        estimatedOverheadMs: avgOverhead,
        overheadPercent,
        isBottleneck,
      };
    });

    return overheadList.sort((a, b) => b.estimatedOverheadMs - a.estimatedOverheadMs);
  }

  /**
   * Generate performance optimization recommendations
   */
  private generateRecommendations(
    results: BenchmarkResult[],
    analysis: ComparativeAnalysis,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for bottlenecks
    analysis.componentOverhead
      .filter(c => c.isBottleneck)
      .forEach(component => {
        recommendations.push({
          priority: 1,
          category: 'performance',
          title: `Optimize ${component.component} middleware`,
          description: `This component contributes ${component.overheadPercent.toFixed(1)}% of total overhead (${component.estimatedOverheadMs.toFixed(2)}ms). Consider optimizing or caching.`,
          affectedComponents: [component.component],
          expectedImprovement: `${(component.estimatedOverheadMs * 0.5).toFixed(2)}ms reduction possible`,
          complexity: 'medium',
        });
      });

    // Check for disproportionate overhead in full stack
    const fullStack = results.find(r => r.stackName.includes('Full'));
    const minimalStack = results.find(r => r.stackName.includes('Minimal'));
    
    if (fullStack && minimalStack) {
      const overheadRatio = fullStack.stats.avgMs / minimalStack.stats.avgMs;
      
      if (overheadRatio > 3) {
        recommendations.push({
          priority: 2,
          category: 'scalability',
          title: 'Review Full Stack Middleware Necessity',
          description: `Full stack is ${overheadRatio.toFixed(1)}x slower than minimal stack. Consider removing non-essential middleware or lazy-loading.`,
          affectedComponents: fullStack.middlewareComponents,
          expectedImprovement: `${((overheadRatio - 1) * 100).toFixed(0)}% performance improvement potential`,
          complexity: 'high',
        });
      }
    }

    // General recommendations based on findings
    if (analysis.worstRps < 100) {
      recommendations.push({
        priority: 3,
        category: 'performance',
        title: 'Consider Async Processing',
        description: 'Overall throughput is below 100 RPS. Consider moving heavy middleware operations to background jobs.',
        affectedComponents: ['all'],
        expectedImprovement: '2-5x throughput increase',
        complexity: 'high',
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Calculate performance score (normalized 0-100)
   */
  private calculatePerformanceScore(result: BenchmarkResult): number {
    const rpsWeight = 0.6;
    const latencyWeight = 0.4;
    
    const rpsScore = Math.min(100, result.stats.rps);
    const latencyScore = Math.max(0, 100 - result.stats.avgMs * 10);
    
    return rpsScore * rpsWeight + latencyScore * latencyWeight;
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): import('../types/benchmark-types').EnvironmentInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      cpuModel: require('os').cpus()[0].model,
      cpuCores: require('os').cpus().length,
      totalMemoryGB: require('os').totalmem() / (1024 ** 3),
      nestJsVersion: this.getNestJsVersion(),
    };
  }

  /**
   * Get NestJS version from package.json
   */
  private getNestJsVersion(): string {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
      );
      return packageJson.dependencies['@nestjs/common'] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Index results by stack name
   */
  private indexResultsByStackName(results: BenchmarkResult[]): Record<string, BenchmarkResult> {
    return results.reduce((acc, result) => {
      acc[result.stackName] = result;
      return acc;
    }, {} as Record<string, BenchmarkResult>);
  }

  /**
   * Save report to markdown file
   */
  async saveToMarkdown(report: BenchmarkReport, filePath: string): Promise<void> {
    const md = this.generateMarkdown(report);
    await fs.promises.writeFile(filePath, md, 'utf-8');
    console.log(`\n📄 Report saved to: ${filePath}`);
  }

  /**
   * Generate markdown documentation
   */
  private generateMarkdown(report: BenchmarkReport): string {
    const lines: string[] = [];

    lines.push('# Middleware Stack Performance Analysis');
    lines.push('');
    lines.push(`Generated: ${report.generatedAt.toISOString()}`);
    lines.push('');
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`- **Fastest Stack**: ${report.comparativeAnalysis.fastestStack}`);
    lines.push(`- **Slowest Stack**: ${report.comparativeAnalysis.slowestStack}`);
    lines.push(`- **Best RPS**: ${report.comparativeAnalysis.bestRps.toFixed(2)}`);
    lines.push(`- **Worst RPS**: ${report.comparativeAnalysis.worstRps.toFixed(2)}`);
    lines.push('');

    lines.push('## Environment');
    lines.push('');
    lines.push(`- Node.js: ${report.environment.nodeVersion}`);
    lines.push(`- Platform: ${report.environment.platform}`);
    lines.push(`- CPU: ${report.environment.cpuModel}`);
    lines.push(`- Cores: ${report.environment.cpuCores}`);
    lines.push(`- Memory: ${report.environment.totalMemoryGB.toFixed(2)} GB`);
    lines.push(`- NestJS: ${report.environment.nestJsVersion}`);
    lines.push('');

    lines.push('## Stack Comparison');
    lines.push('');
    lines.push('| Stack | Avg (ms) | P95 (ms) | P99 (ms) | RPS | Error Rate |');
    lines.push('|-------|----------|----------|----------|-----|------------|');
    
    Object.values(report.stackResults).forEach(result => {
      lines.push(
        `| ${result.stackName} | ${result.stats.avgMs.toFixed(2)} | ${result.stats.p95Ms.toFixed(2)} | ${result.stats.p99Ms.toFixed(2)} | ${result.stats.rps.toFixed(2)} | ${result.stats.errorRatePercent.toFixed(2)}% |`
      );
    });
    lines.push('');

    lines.push('## Baseline Comparison');
    lines.push('');
    lines.push('| Stack | Overhead (ms) | Overhead (%) | Significantly Slower |');
    lines.push('|-------|---------------|--------------|----------------------|');
    
    Object.values(report.stackResults).forEach(result => {
      if (result.baselineComparison) {
        const bc = result.baselineComparison;
        lines.push(
          `| ${result.stackName} | ${bc.absoluteOverheadMs.toFixed(2)} | ${bc.relativeOverheadPercent.toFixed(2)}% | ${bc.isSignificantlySlower ? 'Yes' : 'No'} |`
        );
      }
    });
    lines.push('');

    lines.push('## Component Overhead Analysis');
    lines.push('');
    lines.push('| Component | Overhead (ms) | % of Total | Bottleneck |');
    lines.push('|-----------|---------------|------------|------------|');
    
    report.comparativeAnalysis.componentOverhead.forEach(comp => {
      lines.push(
        `| ${comp.component} | ${comp.estimatedOverheadMs.toFixed(2)} | ${comp.overheadPercent.toFixed(1)}% | ${comp.isBottleneck ? '⚠️' : '✅'} |`
      );
    });
    lines.push('');

    lines.push('## Performance Ranking');
    lines.push('');
    lines.push('| Rank | Stack | Score | Avg Response Time | RPS |');
    lines.push('|------|-------|-------|---------------------|-----|');
    
    report.comparativeAnalysis.ranking.forEach(rank => {
      lines.push(
        `| ${rank.rank} | ${rank.stackName} | ${rank.score.toFixed(1)} | ${rank.avgResponseTimeMs.toFixed(2)} ms | ${rank.rps.toFixed(2)} |`
      );
    });
    lines.push('');

    lines.push('## Recommendations');
    lines.push('');
    
    report.recommendations.forEach((rec, index) => {
      lines.push(`### ${index + 1}. ${rec.title}`);
      lines.push('');
      lines.push(`**Priority**: ${rec.priority}/5  `);
      lines.push(`**Category**: ${rec.category}  `);
      lines.push(`**Complexity**: ${rec.complexity}  `);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
      lines.push(`**Affected Components**: ${rec.affectedComponents.join(', ')}`);
      lines.push('');
      lines.push(`**Expected Improvement**: ${rec.expectedImprovement}`);
      lines.push('');
    });

    lines.push('## Detailed Results');
    lines.push('');
    
    Object.values(report.stackResults).forEach(result => {
      lines.push(`### ${result.stackName}`);
      lines.push('');
      lines.push(`**Description**: ${result.stackDescription}`);
      lines.push('');
      lines.push(`**Components**: ${result.middlewareComponents.join(', ')}`);
      lines.push('');
      lines.push('#### Metrics');
      lines.push('');
      lines.push('- Min: ' + result.stats.minMs.toFixed(2) + ' ms');
      lines.push('- Max: ' + result.stats.maxMs.toFixed(2) + ' ms');
      lines.push('- Average: ' + result.stats.avgMs.toFixed(2) + ' ms');
      lines.push('- Median: ' + result.stats.medianMs.toFixed(2) + ' ms');
      lines.push('- P95: ' + result.stats.p95Ms.toFixed(2) + ' ms');
      lines.push('- P99: ' + result.stats.p99Ms.toFixed(2) + ' ms');
      lines.push('- Std Dev: ' + result.stats.stdDevMs.toFixed(2) + ' ms');
      lines.push('- RPS: ' + result.stats.rps.toFixed(2));
      lines.push('- Error Rate: ' + result.stats.errorRatePercent.toFixed(2) + '%');
      lines.push('');
    });

    return lines.join('\n');
  }
}
