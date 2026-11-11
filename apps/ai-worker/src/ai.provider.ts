import { systemPrompt } from './ai.prompt';
import {
  executeTool,
  getModelText,
  getToolCalls,
  isSearchRequest,
  parseSearchIntent,
  tools,
  type AiEnvironment,
} from './ai.tools';

type HistoryMessage = { role: 'user' | 'assistant'; content: string };

async function runModel(env: AiEnvironment, messages: Array<{ role: string; content: string }>): Promise<unknown> {
  const model = env.AI_MODEL?.trim() || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      env.AI.run(model, { messages, tools, max_tokens: 700, temperature: 0.2 }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI request timed out.')), 25000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function generateReply(
  env: AiEnvironment,
  message: string,
  history: HistoryMessage[],
  authorization?: string,
): Promise<{ answer: string; results: unknown[] }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];
  let searchResults: unknown[] = [];
  let searchPerformed = false;
  let searchFailed = false;
  let fallbackSearchDone = false;

  for (let turn = 0; turn < 3; turn += 1) {
    const result = await runModel(env, messages);
    const calls = getToolCalls(result).slice(0, 3);
    if (!calls.length) {
      if (!fallbackSearchDone && isSearchRequest(message)) {
        fallbackSearchDone = true;
        const searchCall = { name: 'searchProperties', arguments: parseSearchIntent(message) };
        const toolResult = await executeTool(env, searchCall, authorization);
        searchPerformed = true;
        if (Array.isArray(toolResult)) searchResults = toolResult;
        else searchFailed = true;
        messages.push(
          { role: 'assistant', content: JSON.stringify({ tool_calls: [searchCall] }) },
          { role: 'tool', content: JSON.stringify(toolResult) },
        );
        continue;
      }
      const answer = getModelText(result);
      return {
        answer: searchPerformed && !searchFailed && searchResults.length === 0
          ? 'Mình chưa tìm thấy phòng phù hợp trong dữ liệu hiện có. Bạn có thể thử nới ngân sách, đổi khu vực hoặc chọn loại hình lưu trú khác nhé.'
          : answer || 'Xin lỗi, mình chưa thể tạo câu trả lời lúc này. Bạn thử hỏi lại nhé.',
        results: searchResults,
      };
    }

    messages.push({ role: 'assistant', content: JSON.stringify({ tool_calls: calls }) });
    for (const call of calls) {
      const toolResult = await executeTool(env, call, authorization);
      if (call.name === 'searchProperties') {
        searchPerformed = true;
        if (Array.isArray(toolResult)) searchResults = toolResult;
        else searchFailed = true;
      }
      messages.push({ role: 'tool', content: JSON.stringify(toolResult) });
    }
  }

  const result = await runModel(env, messages);
  return {
    answer: searchPerformed && !searchFailed && searchResults.length === 0
      ? 'Mình chưa tìm thấy phòng phù hợp trong dữ liệu hiện có. Bạn có thể thử nới ngân sách, đổi khu vực hoặc chọn loại hình lưu trú khác nhé.'
      : getModelText(result) || 'Mình đã tìm thấy thông tin phù hợp. Bạn có thể xem các lựa chọn bên dưới.',
    results: searchResults,
  };
}
