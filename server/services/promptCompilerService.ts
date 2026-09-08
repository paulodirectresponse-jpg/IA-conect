import {
  WorkspaceReference,
  CompiledPromptResult,
  GenerationMode,
} from '../../src/types/index.js';

export interface PromptCompilerInput {
  original_prompt: string;
  references: WorkspaceReference[];
  negative_prompt?: string;
  generation_settings: {
    model_id: string;
    mode: GenerationMode;
    duration_seconds: number;
    resolution: string;
    aspect_ratio: string;
  };
}

export const promptCompilerService = {
  compile(input: PromptCompilerInput): CompiledPromptResult {
    const { original_prompt, references = [], negative_prompt, generation_settings } = input;
    const version = '1.0.0';

    // 1. Structure References Section
    const structuredRefs = references.map((ref) => ({
      asset_id: ref.asset_id,
      alias: ref.alias_snapshot.startsWith('@') ? ref.alias_snapshot : `@${ref.alias_snapshot}`,
      type: ref.asset?.type || 'IMAGE',
      category: ref.asset?.category || 'PRODUCT',
      priority: ref.priority || 'HIGH',
      preservation_rules: ref.preservation_rules || [],
      flexible_rules: ref.flexible_rules || [],
      notes: ref.notes || '',
    }));

    // 2. Build Human-Readable & Engine-Ready Compiled Prompt
    const promptLines: string[] = [];

    if (structuredRefs.length > 0) {
      promptLines.push('[SUBJECT & ASSET REFERENCES]');
      for (const ref of structuredRefs) {
        promptLines.push(`- ${ref.alias} (${ref.category} | Priority: ${ref.priority})`);
        if (ref.preservation_rules.length > 0) {
          promptLines.push(`  * PRESERVE: ${ref.preservation_rules.join(', ')}`);
        }
        if (ref.flexible_rules.length > 0) {
          promptLines.push(`  * FLEXIBLE: ${ref.flexible_rules.join(', ')}`);
        }
        if (ref.notes) {
          promptLines.push(`  * NOTES: ${ref.notes}`);
        }
      }
      promptLines.push('');
    }

    promptLines.push('[PROMPT & ACTION]');
    promptLines.push(original_prompt.trim());
    promptLines.push('');

    promptLines.push('[TECHNICAL PARAMETERS]');
    promptLines.push(
      `- Mode: ${generation_settings.mode} | Duration: ${generation_settings.duration_seconds}s | Resolution: ${generation_settings.resolution} | Aspect Ratio: ${generation_settings.aspect_ratio}`
    );

    if (negative_prompt && negative_prompt.trim()) {
      promptLines.push('');
      promptLines.push('[NEGATIVE CONSTRAINTS]');
      promptLines.push(negative_prompt.trim());
    }

    const compiledText = promptLines.join('\n');

    // 3. Extract semantic keywords for structured context
    const structuredContext = {
      subject: structuredRefs.length > 0 ? structuredRefs.map((r) => r.alias).join(', ') : 'Primary Subject',
      action: original_prompt.slice(0, 150),
      references: structuredRefs,
      negative_constraints: negative_prompt
        ? negative_prompt.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      settings_summary: generation_settings,
    };

    return {
      original_prompt,
      compiled_prompt: compiledText,
      structured_context: structuredContext,
      prompt_compiler_version: version,
    };
  },
};
