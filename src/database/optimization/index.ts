/**
 * Database Optimization Module Index
 * 
 * Centralized exports for database optimization services and utilities
 */

// Core optimization services
export * from './query.optimizer';
export * from './index.strategy';
export * from './performance.monitor';
export * from './connection.pool';

/**
 * Re-export commonly used types and utilities
 */
export {
  QueryOptimizerService,
  IndexStrategyService,
  PerformanceMonitorService,
  ConnectionPoolService,
} from './query.optimizer';

export {
  QueryStats,
  QueryAnalysis,
  IndexSuggestion,
  OptimizationReport,
} from './query.optimizer';

export {
  IndexAnalysis,
  IndexSuggestion as IndexSuggestionType,
  IndexOptimizationPlan,
  IndexSizeEstimate,
} from './index.strategy';

export {
  PerformanceMetrics,
  PerformanceReport,
  PerformanceAlert,
  HealthScore,
  PerformanceTrends,
} from './performance.monitor';

export {
  PoolMetrics,
  PoolStatus,
  PoolOptimizationResult,
} from './connection.pool';
