/**
 * ADRParser — Parse ADRs.RL4 and append to ledger/adrs.jsonl
 * 
 * Phase E3.3: Enable dynamic ADR creation via agent LLM feedback loop
 * 
 * Workflow:
 * 1. Agent LLM proposes ADR in prompt response
 * 2. User saves to .reasoning_rl4/ADRs.RL4
 * 3. FileWatcher detects change
 * 4. ADRParser validates + parses
 * 5. New ADR appended to ledger/adrs.jsonl
 * 6. Next prompt includes new ADR ✅ (feedback loop closed)
 * 
 * Responsibilities:
 * - Parse Markdown with YAML frontmatter
 * - Validate structure (Zod schema)
 * - Extract ADR blocks (## ADR-XXX: Title)
 * - Convert to JSONL format
 * - Prevent duplicates
 * - Append to ledger atomically
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

// Zod Schema for ADR
const ADRSchema = z.object({
  id: z.string().regex(/^adr-\d{3,}-/), // e.g. adr-005-single-context
  title: z.string().min(5),
  status: z.enum(['proposed', 'accepted', 'rejected', 'deprecated', 'superseded']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  author: z.string(),
  context: z.string().min(50),
  decision: z.string().min(50),
  consequences: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
    risks: z.array(z.string()).optional(),
    alternatives: z.array(z.string()).optional()
  })
});

export type ADR = z.infer<typeof ADRSchema>;

export class ADRParser {
  private adrsFilePath: string;
  private ledgerPath: string;

  constructor(rl4Path: string) {
    this.adrsFilePath = path.join(rl4Path, 'ADRs.RL4');
    this.ledgerPath = path.join(rl4Path, 'ledger', 'adrs.jsonl');
  }

  /**
   * Parse ADRs.RL4 file
   */
  parseADRsFile(): ADR[] {
    if (!fs.existsSync(this.adrsFilePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.adrsFilePath, 'utf8');
      
      // Extract ADR blocks (## ADR-XXX: Title)
      const adrBlocks = this.extractADRBlocks(content);
      
      // Parse each block
      const adrs: ADR[] = [];
      for (const block of adrBlocks) {
        try {
          const adr = this.parseADRBlock(block);
          ADRSchema.parse(adr); // Validate
          adrs.push(adr);
        } catch (error) {
          console.error(`[ADRParser] Failed to parse ADR block:`, error);
        }
      }

      return adrs;
    } catch (error) {
      console.error('[ADRParser] Failed to read ADRs.RL4:', error);
      return [];
    }
  }

  /**
   * Extract ADR blocks from Markdown
   */
  private extractADRBlocks(content: string): string[] {
    const blocks: string[] = [];
    const lines = content.split('\n');
    
    let currentBlock = '';
    let inADR = false;

    for (const line of lines) {
      if (line.match(/^## ADR-\d{3,}:/)) {
        // Start of new ADR
        if (inADR && currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = line + '\n';
        inADR = true;
      } else if (inADR) {
        currentBlock += line + '\n';
      }
    }

    // Push last block
    if (inADR && currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * Parse single ADR block
   */
  private parseADRBlock(block: string): ADR {
    const lines = block.split('\n');
    
    // Extract ID and title from header (## ADR-005: Single Context Snapshot System)
    const headerMatch = lines[0].match(/^## (ADR-\d{3,}):\s*(.+)$/);
    if (!headerMatch) {
      throw new Error('Invalid ADR header format');
    }

    const id = headerMatch[1].toLowerCase(); // e.g. "adr-005"
    const title = headerMatch[2].trim();

    // Extract metadata (Status, Date, Author)
    const status = this.extractField(block, '**Status**:', 'proposed') as ADR['status'];
    const date = this.extractField(block, '**Date**:', new Date().toISOString().split('T')[0]);
    const author = this.extractField(block, '**Author**:', 'Unknown');

    // Extract sections
    const context = this.extractSection(block, '### Context');
    const decision = this.extractSection(block, '### Decision');
    const consequencesSection = this.extractSection(block, '### Consequences');

    // Parse consequences
    const consequences = this.parseConsequences(consequencesSection);

    return {
      id,
      title,
      status,
      date,
      author,
      context,
      decision,
      consequences
    };
  }

  /**
   * Extract field value from Markdown
   */
  private extractField(content: string, fieldName: string, defaultValue: string): string {
    const regex = new RegExp(`${fieldName}\\s*(.+)$`, 'm');
    const match = content.match(regex);
    return match ? match[1].trim() : defaultValue;
  }

  /**
   * Extract section content from Markdown
   */
  private extractSection(content: string, sectionTitle: string): string {
    const regex = new RegExp(`${sectionTitle}([\\s\\S]*?)(?=###|##|$)`, 'm');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Parse consequences section
   */
  private parseConsequences(section: string): ADR['consequences'] {
    const positive: string[] = [];
    const negative: string[] = [];
    const risks: string[] = [];
    const alternatives: string[] = [];

    // Extract subsections
    const positiveMatch = section.match(/\*\*Positive:\*\*([^\*]+)/s);
    const negativeMatch = section.match(/\*\*Negative:\*\*([^\*]+)/s);
    const risksMatch = section.match(/\*\*Risks:\*\*([^\*]+)/s);
    const alternativesMatch = section.match(/\*\*Alternatives Considered:\*\*([^\*]+)/s);

    if (positiveMatch) {
      positive.push(...this.extractListItems(positiveMatch[1]));
    }
    if (negativeMatch) {
      negative.push(...this.extractListItems(negativeMatch[1]));
    }
    if (risksMatch) {
      risks.push(...this.extractListItems(risksMatch[1]));
    }
    if (alternativesMatch) {
      alternatives.push(...this.extractListItems(alternativesMatch[1]));
    }

    return { positive, negative, risks, alternatives };
  }

  /**
   * Extract list items from Markdown (- Item 1\n- Item 2)
   */
  private extractListItems(content: string): string[] {
    return content
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  /**
   * Append ADR to ledger/adrs.jsonl
   */
  appendToLedger(adr: ADR): boolean {
    try {
      // Check if ADR already exists
      if (this.adrExists(adr.id)) {
        console.log(`[ADRParser] ADR ${adr.id} already exists, skipping`);
        return false;
      }

      // Ensure ledger directory exists
      const ledgerDir = path.dirname(this.ledgerPath);
      if (!fs.existsSync(ledgerDir)) {
        fs.mkdirSync(ledgerDir, { recursive: true });
      }

      // Convert to JSONL format
      const jsonlEntry = JSON.stringify({
        id: adr.id,
        title: adr.title,
        status: adr.status,
        date: adr.date,
        author: adr.author,
        context: adr.context,
        decision: adr.decision,
        consequences: adr.consequences,
        timestamp: new Date().toISOString()
      });

      // Append to ledger
      fs.appendFileSync(this.ledgerPath, jsonlEntry + '\n', 'utf8');
      
      console.log(`[ADRParser] ✅ Added ADR ${adr.id} to ledger`);
      return true;
    } catch (error) {
      console.error(`[ADRParser] Failed to append ADR to ledger:`, error);
      return false;
    }
  }

  /**
   * Check if ADR already exists in ledger
   */
  private adrExists(adrId: string): boolean {
    if (!fs.existsSync(this.ledgerPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(this.ledgerPath, 'utf8');
      return content.includes(`"id":"${adrId}"`);
    } catch {
      return false;
    }
  }

  /**
   * Process ADRs.RL4 and append new ADRs to ledger
   * Returns: { added, skipped, errors }
   */
  processADRsFile(): { added: number; skipped: number; errors: number } {
    const adrs = this.parseADRsFile();
    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const adr of adrs) {
      try {
        const success = this.appendToLedger(adr);
        if (success) {
          added++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`[ADRParser] Error appending ADR ${adr.id}:`, error);
        errors++;
      }
    }

    console.log(`[ADRParser] Processed ${adrs.length} ADRs: ${added} added, ${skipped} skipped, ${errors} errors`);
    return { added, skipped, errors };
  }

  /**
   * Get all ADRs from ledger (for display in prompts)
   */
  getAllADRs(limit?: number): ADR[] {
    if (!fs.existsSync(this.ledgerPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.ledgerPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const adrs = lines.map(line => JSON.parse(line) as ADR);
      
      // Return last N ADRs (most recent first)
      if (limit) {
        return adrs.slice(-limit).reverse();
      }
      
      return adrs.reverse();
    } catch (error) {
      console.error('[ADRParser] Failed to read ADRs from ledger:', error);
      return [];
    }
  }
}

