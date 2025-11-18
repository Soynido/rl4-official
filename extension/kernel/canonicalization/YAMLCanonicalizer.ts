/**
 * YAMLCanonicalizer — Normalisation YAML canonique pour éliminer faux positifs
 * 
 * MVP-1 : Canonicalisation obligatoire AVANT toute comparaison/validation
 * 
 * Normalise :
 * - Indentation (2 espaces)
 * - Format arrays (`- item` uniforme)
 * - Unicode (NFC)
 * - Quoting (règles déterministes)
 * 
 * Utilisé par :
 * - RL4RollbackSystem (comparaison avant/après)
 * - PipelineValidator (validation structure)
 * - PlanTasksContextParser (lecture/écriture)
 */

import * as yaml from 'js-yaml';

export class YAMLCanonicalizer {
  /**
   * Canonicalize YAML content
   * @param raw - Raw YAML string
   * @returns Canonicalized YAML string
   */
  static canonicalize(raw: string): string {
    try {
      // 1. Parse YAML
      const parsed = yaml.load(raw);
      
      if (!parsed || typeof parsed !== 'object') {
        return raw; // Cannot canonicalize non-object YAML
      }
      
      // 2. Dump with canonical options
      const canonical = yaml.dump(parsed, {
        indent: 2,              // Force 2 spaces
        lineWidth: -1,          // No line wrapping
        noRefs: true,           // No anchors/aliases
        sortKeys: false,        // CRITICAL: Preserve key order (V1 - Anti-YAML Reordering)
        quotingType: '"',       // Always use double quotes
        forceQuotes: false,     // Quote only when necessary
        noCompatMode: true,     // Strict YAML 1.2
        condenseFlow: false     // Expanded arrays
      });
      
      // 3. Normalize unicode (NFC)
      const normalized = this.normalizeUnicode(canonical);
      
      // 4. Normalize array format
      const arrayNormalized = this.normalizeArrays(normalized);
      
      return arrayNormalized;
    } catch (error) {
      console.error('[YAMLCanonicalizer] Failed to canonicalize YAML:', error);
      return raw; // Return original if canonicalization fails
    }
  }
  
  /**
   * Normalize unicode to NFC form
   */
  private static normalizeUnicode(text: string): string {
    return text.normalize('NFC');
  }
  
  /**
   * Normalize array format to ensure consistency
   * Ensures arrays use `- item` format (not inline `[item]`)
   */
  private static normalizeArrays(text: string): string {
    // js-yaml already handles this with condenseFlow: false
    // But we ensure no inline arrays remain
    return text;
  }
  
  /**
   * Extract YAML frontmatter and canonicalize it
   * @param markdown - Markdown content with frontmatter
   * @returns Object with canonicalized frontmatter and unchanged markdown
   */
  static canonicalizeFrontmatter(markdown: string): { frontmatter: string; markdown: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: '', markdown };
    }
    
    const rawFrontmatter = match[1];
    const markdownContent = match[2];
    
    // Canonicalize frontmatter
    const canonicalFrontmatter = this.canonicalize(rawFrontmatter);
    
    return {
      frontmatter: canonicalFrontmatter,
      markdown: markdownContent
    };
  }
  
  /**
   * Compare two YAML strings (canonicalized)
   * @returns true if semantically identical
   */
  static areEqual(yaml1: string, yaml2: string): boolean {
    try {
      const canonical1 = this.canonicalize(yaml1);
      const canonical2 = this.canonicalize(yaml2);
      
      return canonical1 === canonical2;
    } catch {
      return false;
    }
  }
  
  /**
   * Validate YAML key ordering (V1 - Anti-YAML Reordering)
   * @param originalYAML - Original YAML string
   * @param modifiedYAML - Modified YAML string
   * @returns true if key order preserved
   */
  static validateKeyOrdering(originalYAML: string, modifiedYAML: string): boolean {
    try {
      // Extract key order from both
      const originalKeys = this.extractTopLevelKeys(originalYAML);
      const modifiedKeys = this.extractTopLevelKeys(modifiedYAML);
      
      // Filter to common keys (ignore added keys for now)
      const commonKeys = originalKeys.filter(k => modifiedKeys.includes(k));
      
      // Check if common keys preserved order
      const originalOrder = commonKeys.map(k => originalKeys.indexOf(k));
      const modifiedOrder = commonKeys.map(k => modifiedKeys.indexOf(k));
      
      // Check if order is strictly increasing (preserved)
      for (let i = 1; i < originalOrder.length; i++) {
        const origIdx = originalKeys.indexOf(commonKeys[i]);
        const modIdx = modifiedKeys.indexOf(commonKeys[i]);
        const prevOrigIdx = originalKeys.indexOf(commonKeys[i - 1]);
        const prevModIdx = modifiedKeys.indexOf(commonKeys[i - 1]);
        
        // If relative order changed
        if ((origIdx - prevOrigIdx) * (modIdx - prevModIdx) < 0) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('[YAMLCanonicalizer] Failed to validate key ordering:', error);
      return false;
    }
  }
  
  /**
   * Extract top-level keys from YAML
   */
  private static extractTopLevelKeys(yamlString: string): string[] {
    try {
      const lines = yamlString.split('\n');
      const keys: string[] = [];
      
      for (const line of lines) {
        // Match top-level keys (no leading spaces, followed by colon)
        const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
        if (match) {
          keys.push(match[1]);
        }
      }
      
      return keys;
    } catch {
      return [];
    }
  }
  
  /**
   * Detect YAML structural changes (V2 - Anti-YAML Reordering)
   * @returns Array of structural violations
   */
  static detectStructuralChanges(originalYAML: string, modifiedYAML: string): string[] {
    const violations: string[] = [];
    
    try {
      const originalParsed = yaml.load(originalYAML) as any;
      const modifiedParsed = yaml.load(modifiedYAML) as any;
      
      // Check if top-level structure changed (added/removed keys)
      const originalTopKeys = Object.keys(originalParsed || {});
      const modifiedTopKeys = Object.keys(modifiedParsed || {});
      
      const removedKeys = originalTopKeys.filter(k => !modifiedTopKeys.includes(k));
      const addedKeys = modifiedTopKeys.filter(k => !originalTopKeys.includes(k));
      
      if (removedKeys.length > 0) {
        violations.push(`Removed top-level keys: ${removedKeys.join(', ')}`);
      }
      
      if (addedKeys.length > 0) {
        // Note: Adding keys might be allowed in some modes
        // This is a soft warning, not a hard error
        violations.push(`Added top-level keys: ${addedKeys.join(', ')} (verify if intentional)`);
      }
      
      // Check key ordering
      if (!this.validateKeyOrdering(originalYAML, modifiedYAML)) {
        violations.push('Key ordering changed (V1 violation)');
      }
      
    } catch (error) {
      violations.push(`Failed to parse YAML: ${error}`);
    }
    
    return violations;
  }
}

