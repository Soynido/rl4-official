/**
 * ResponseContractValidator — V17: LLM Response Contract Check
 * 
 * MVP-1 : Validation de la réponse brute LLM AVANT parsing
 * 
 * Vérifie que la réponse LLM contient :
 * - 3 blocs RL4 (Plan.RL4, Tasks.RL4, Context.RL4)
 * - Chaque bloc a un frontmatter YAML valide
 * - Chaque bloc est non vide
 * 
 * Utilisé par :
 * - FirstBootstrapEngine (firstUse mode)
 * - UnifiedPromptBuilder (tous modes sauf free)
 * - PipelineValidator (pré-validation)
 */

export interface ResponseContractResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  blocks: {
    plan: boolean;
    tasks: boolean;
    context: boolean;
  };
}

export class ResponseContractValidator {
  /**
   * Validate LLM response structure (blocking validation)
   */
  static validate(llmResponse: string): ResponseContractResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const blocks = {
      plan: false,
      tasks: false,
      context: false
    };
    
    // 1. Check if response is non-empty
    if (!llmResponse || llmResponse.trim().length === 0) {
      errors.push('LLM response is empty');
      return { valid: false, errors, warnings, blocks };
    }
    
    // 2. Extract RL4 blocks (look for ```yaml blocks or RL4_PATCH blocks)
    const rl4BlockRegex = /```(?:yaml|rl4)?\s*(Plan\.RL4|Tasks\.RL4|Context\.RL4)\s*([\s\S]*?)```/gi;
    const matches = Array.from(llmResponse.matchAll(rl4BlockRegex));
    
    if (matches.length === 0) {
      errors.push('No RL4 blocks found in response (expected ```yaml Plan.RL4, Tasks.RL4, Context.RL4)');
      return { valid: false, errors, warnings, blocks };
    }
    
    // 3. Check for each required block
    for (const match of matches) {
      const fileName = match[1];
      const content = match[2].trim();
      
      if (fileName === 'Plan.RL4') {
        blocks.plan = true;
        this.validateBlockStructure(content, 'Plan.RL4', errors, warnings);
      } else if (fileName === 'Tasks.RL4') {
        blocks.tasks = true;
        this.validateBlockStructure(content, 'Tasks.RL4', errors, warnings);
      } else if (fileName === 'Context.RL4') {
        blocks.context = true;
        this.validateBlockStructure(content, 'Context.RL4', errors, warnings);
      }
    }
    
    // 4. Ensure all 3 blocks present
    if (!blocks.plan) {
      errors.push('Missing Plan.RL4 block');
    }
    if (!blocks.tasks) {
      errors.push('Missing Tasks.RL4 block');
    }
    if (!blocks.context) {
      errors.push('Missing Context.RL4 block');
    }
    
    // 5. Check for common LLM hallucination patterns
    this.detectHallucinations(llmResponse, warnings);
    
    const valid = errors.length === 0;
    
    return { valid, errors, warnings, blocks };
  }
  
  /**
   * Validate individual block structure
   */
  private static validateBlockStructure(
    content: string,
    fileName: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Check if empty
    if (content.length < 20) {
      errors.push(`${fileName} block is too short (< 20 chars)`);
      return;
    }
    
    // Check if has YAML frontmatter
    if (!content.startsWith('---')) {
      errors.push(`${fileName} missing YAML frontmatter (must start with ---)`);
    }
    
    // Check if frontmatter is closed
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd === -1) {
      errors.push(`${fileName} frontmatter not closed (missing second ---)`);
    }
    
    // Check if has markdown content after frontmatter
    const markdownContent = content.substring(frontmatterEnd + 3).trim();
    if (markdownContent.length < 10) {
      warnings.push(`${fileName} has very short markdown content`);
    }
    
    // Check if frontmatter contains required keys (basic check)
    const frontmatterContent = content.substring(3, frontmatterEnd);
    if (!frontmatterContent.includes('version:')) {
      errors.push(`${fileName} frontmatter missing 'version' key`);
    }
    if (!frontmatterContent.includes('updated:')) {
      errors.push(`${fileName} frontmatter missing 'updated' key`);
    }
  }
  
  /**
   * Detect common LLM hallucination patterns
   */
  private static detectHallucinations(response: string, warnings: string[]): void {
    // Check for placeholder text
    const placeholderPatterns = [
      /lorem ipsum/i,
      /\[TODO\]/i,
      /\[PLACEHOLDER\]/i,
      /\[INSERT.*HERE\]/i,
      /example\.com/i,
      /test@test\.com/i
    ];
    
    for (const pattern of placeholderPatterns) {
      if (pattern.test(response)) {
        warnings.push(`Detected placeholder text: ${pattern.source} (possible hallucination)`);
      }
    }
    
    // Check for excessive repetition
    const lines = response.split('\n');
    const uniqueLines = new Set(lines.map(l => l.trim()).filter(l => l.length > 10));
    const repetitionRatio = uniqueLines.size / Math.max(lines.length, 1);
    
    if (repetitionRatio < 0.5 && lines.length > 20) {
      warnings.push('High line repetition detected (possible hallucination)');
    }
    
    // Check for malformed YAML (basic)
    if (response.includes('---') && response.includes('```')) {
      const yamlBlocks = response.match(/---[\s\S]*?---/g) || [];
      for (const block of yamlBlocks) {
        // Check for unbalanced quotes
        const doubleQuotes = (block.match(/"/g) || []).length;
        const singleQuotes = (block.match(/'/g) || []).length;
        
        if (doubleQuotes % 2 !== 0) {
          warnings.push('Unbalanced double quotes in YAML (possible syntax error)');
        }
        if (singleQuotes % 2 !== 0) {
          warnings.push('Unbalanced single quotes in YAML (possible syntax error)');
        }
      }
    }
  }
  
  /**
   * Strict validation for firstUse mode (MVP-1)
   * Applies stricter rules than normal validation
   */
  static validateFirstUse(llmResponse: string): ResponseContractResult {
    const result = this.validate(llmResponse);
    
    // Additional firstUse checks
    if (result.valid) {
      // Check that Plan.RL4 has a meaningful goal (not generic)
      if (llmResponse.includes('goal:') && llmResponse.includes('Project goals will be extracted')) {
        result.errors.push('Plan.RL4 goal is still generic (LLM did not extract real project context)');
        result.valid = false;
      }
      
      // Check that Tasks.RL4 has real tasks (not placeholders)
      if (llmResponse.includes('[P0]') && llmResponse.includes('Project tasks will be extracted')) {
        result.errors.push('Tasks.RL4 contains placeholder tasks (LLM did not generate real tasks)');
        result.valid = false;
      }
      
      // Check that Context.RL4 has project-specific data
      if (llmResponse.includes('activeFiles:') && !llmResponse.match(/activeFiles:\s*\n\s*-\s+\S/)) {
        result.warnings.push('Context.RL4 has empty activeFiles (expected project files)');
      }
    }
    
    return result;
  }
}

