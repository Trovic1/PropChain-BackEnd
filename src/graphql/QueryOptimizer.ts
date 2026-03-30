import { Injectable, Logger } from '@nestjs/common';
import { GraphQLSchema, parse, validate, specifiedRules, FieldNode, OperationDefinitionNode, SelectionSetNode } from 'graphql';

@Injectable()
export class GraphQLQueryOptimizer {
  private readonly logger = new Logger(GraphQLQueryOptimizer.name);
  private readonly maxComplexity = 1000;
  private readonly maxDepth = 10;

  /**
   * Analyze query complexity and depth
   */
  validateQueryComplexity(query: string, schema: GraphQLSchema) {
    try {
      const document = parse(query);
      const errors = validate(schema, document, [...specifiedRules]);

      if (errors.length > 0) {
        throw new Error(`Invalid GraphQL query: ${errors.map((e) => e.message).join(', ')}`);
      }

      const complexity = this.calculateComplexity(document.definitions[0] as OperationDefinitionNode);
      const depth = this.calculateDepth(document.definitions[0] as OperationDefinitionNode);

      if (complexity > this.maxComplexity) {
        throw new Error(`Query is too complex: ${complexity} (max: ${this.maxComplexity})`);
      }

      if (depth > this.maxDepth) {
        throw new Error(`Query is too deep: ${depth} (max: ${this.maxDepth})`);
      }

      return { complexity, depth };
    } catch (error) {
      this.logger.error('Query validation failed', error);
      throw error;
    }
  }

  private calculateComplexity(definition: OperationDefinitionNode): number {
    let complexity = 0;
    const visitSelections = (selectionSet: SelectionSetNode) => {
      selectionSet.selections.forEach((selection) => {
        if (selection.kind === 'Field') {
          complexity += 1; // Base cost per field
          if (selection.selectionSet) {
            visitSelections(selection.selectionSet);
          }
        }
      });
    };

    if (definition.selectionSet) {
      visitSelections(definition.selectionSet);
    }
    return complexity;
  }

  private calculateDepth(definition: OperationDefinitionNode): number {
    const getDepth = (selectionSet: SelectionSetNode | undefined): number => {
      if (!selectionSet) return 0;
      let maxSubDepth = 0;
      selectionSet.selections.forEach((selection) => {
        if (selection.kind === 'Field') {
          const depth = getDepth(selection.selectionSet);
          if (depth > maxSubDepth) maxSubDepth = depth;
        }
      });
      return 1 + maxSubDepth;
    };

    return getDepth(definition.selectionSet);
  }
}
