import { Injectable } from "@nestjs/common";

@Injectable()
export class PromptBuilder {
    private readonly BASE_CONTEXT = `You are a corporate knowledge assistant. Answer the user's question using ONLY the context provided below.`;

    private readonly DEFAULT_RULES: readonly string[] = [
        'Do NOT invent or infer information beyond what is explicitly stated in the context.',
        'Set responseType to ANSWER if the context contains enough information to answer accurately.',
        'Set responseType to INSUFFICIENT if the context does not contain enough information; in that case, the answer field must briefly explain why.',
    ];

    private customRules: string[] = [];

    addRule(rule: string): this {
        this.customRules.push(rule);
        return this;
    }

    private rulesSection(): string {
        return [...this.DEFAULT_RULES, ...this.customRules]
            .map(r => `  - ${r}`)
            .join('\n');
    }

    buildAnswer(query: string, context: string): string {
        return `${this.BASE_CONTEXT}
        Rules:
            ${this.rulesSection()}

        Context:
        ${context}

        Question: ${query}`;
    }

    buildFilterRelevant(query: string, docList: string): string {
        return `You are filtering a knowledge base. Given the user question below, return the indices of documents that are likely to contain information relevant to answering it.
            Respond with ONLY a JSON array of 0-based indices. If none are relevant, respond with [].
            Question: "${query}"

            Documents:
            ${docList}

            Relevant indices (JSON array only):`;
    }
}
