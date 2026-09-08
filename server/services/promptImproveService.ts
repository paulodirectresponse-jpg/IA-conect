import { GoogleGenAI } from '@google/genai';
import { PromptImproveObjective, WorkspaceReference } from '../../src/types/index.js';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('A chave GEMINI_API_KEY não está configurada no servidor. Configure a chave nas variáveis de ambiente.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export interface ImprovePromptParams {
  prompt: string;
  objective?: PromptImproveObjective;
  references?: Array<{
    alias: string;
    type?: string;
    category?: string;
  }>;
  model_name?: string;
}

const OBJECTIVE_PROFILES: Record<PromptImproveObjective, string> = {
  GENERAL: 'Equilíbrio cinematográfico geral, clareza estética e coerência temporal.',
  CINEMATIC: 'Direção cinematográfica, movimento de câmera fluido (dolly, tracking, crane), iluminação volumétrica, profundidade de campo e proporções fotorrealistas.',
  PRODUCT_FIDELITY: 'Alta precisão em detalhes de produto, reflexos cristalinos em superfícies, packshot comercial limpo, iluminação de estúdio profissional e fidelidade geométrica.',
  CHARACTER_CONSISTENCY: 'Consistência rigorosa de feições, textura de pele natural (sem aspecto plástico), iluminação de retrato e microexpressões faciais orgânicas.',
  MOTION: 'Dinâmica de movimento acelerada ou em super câmera lenta, trajetórias de física realista e dinamismo temporal de alta fidelidade.',
  REALISM: 'Fotorrealismo extremo, textura tátil, iluminação naturalista, ausência de artefatos de IA e fidelidade física.',
  PROMPT_CLARITY: 'Eliminação de ambiguidades, estruturação sintática precisa e foco descritivo claro sem floreios desnecessários.',
  COST_EFFICIENCY: 'Prompt conciso e direto ao ponto, otimizado para que o modelo entenda a cena em poucos segundos de renderização.',
};

export const promptImproveService = {
  async improve(params: ImprovePromptParams): Promise<{
    original_prompt: string;
    improved_prompt: string;
    objective: PromptImproveObjective;
    enhancement_summary: string;
  }> {
    const { prompt, objective = 'CINEMATIC', references = [], model_name = 'WAN 2.1 Video' } = params;

    if (!prompt || !prompt.trim()) {
      throw new Error('O prompt não pode estar vazio para otimização.');
    }

    const ai = getAiClient();
    const objectiveGuide = OBJECTIVE_PROFILES[objective] || OBJECTIVE_PROFILES.CINEMATIC;

    const detectedAliases = (prompt.match(/@[a-zA-Z0-9_]+/g) || []).map((a) => a.toLowerCase());
    const referenceAliases = references.map((r) => (r.alias.startsWith('@') ? r.alias : `@${r.alias}`).toLowerCase());
    const allAliases = Array.from(new Set([...detectedAliases, ...referenceAliases]));

    const systemInstruction = `
Você é um Diretor de Fotografia e Engenheiro Sênior de Prompts para modelos avançados de vídeo com Inteligência Artificial (como WAN 2.1, Kling e Hunyuan).
Sua missão é transformar um prompt inicial em um prompt visualmente deslumbrante, profissional e altamente eficaz.

REGRAS INEGOCIÁVEIS:
1. PRESERVAÇÃO RIGOROSA DE @REFERÊNCIAS:
   Se existirem menções a referências (como ${allAliases.length > 0 ? allAliases.join(', ') : '@alias'}), você DEVE mantê-las EXATAMENTE como foram escritas. NUNCA remova, renomeie ou invente novos @aliases.
2. PRESERVAÇÃO DA INTENÇÃO:
   Mantenha exatamente a ação e o tema solicitados pelo criador. Não mude a história ou o produto.
3. OBJETIVO ESPECÍFICO DE OTIMIZAÇÃO:
   ${objectiveGuide}
4. DIRECIONAMENTO PARA VÍDEO:
   Enriqueça com terminologias reais de cinema (e.g. plano detalhe, iluminação difusa, golden hour, lente 50mm f/1.8, movimento lento de tracking, texturas palpáveis).
5. IDIOMA:
   Responda no mesmo idioma em que o prompt do usuário foi escrito (se em português, retorne em português; se em inglês, retorne em inglês).
6. FORMATO DE SAÍDA:
   Retorne APENAS o texto puro do prompt otimizado, sem introduções como "Aqui está o prompt:" ou aspas desnecessárias.
`.trim();

    const userMessage = `
Prompt original: "${prompt.trim()}"
Modelo de vídeo alvo: ${model_name}
Referências ativas: ${allAliases.join(', ') || 'Nenhuma'}
Objetivo: ${objective}
`.trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const improvedText = response.text?.trim() || prompt;

      return {
        original_prompt: prompt,
        improved_prompt: improvedText,
        objective,
        enhancement_summary: `Prompt enriquecido com iluminação, cinematografia e enquadramento focados no objetivo ${objective}.`,
      };
    } catch (err: any) {
      console.error('[PromptImproveService] Error generating content with Gemini:', err);
      throw new Error(`Falha ao comunicar com o serviço de otimização de IA: ${err.message || 'Erro desconhecido'}`);
    }
  },
};
