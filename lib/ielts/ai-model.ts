import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function getIeltsModel() {
	const apiKey = process.env.AI_API_KEY || '';
	const endpoint = process.env.AI_ENDPOINT || 'https://llm.mrdnd.dev/v1/chat/completions';
	const modelId = process.env.AI_MODEL || 'gemini-3.8-flash-high';
	if (!apiKey) return null;

	const baseURL = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');

	return {
		modelId,
		endpoint,
		model: createOpenAICompatible({
			name: 'ielts-proxy',
			apiKey,
			baseURL,
			supportsStructuredOutputs: true
		}).chatModel(modelId)
	};
}
