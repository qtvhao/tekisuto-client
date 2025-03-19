import { readCache, writeCache } from './utils/cache.js';
import crypto from 'crypto';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionResponse {
  markdown_text: string;
  conversation_id: string;
  audio_base64: string;
  error?: string;
}

export class ChatCompletionService {
  private static API_URL = 'https://http-tekisuto-kiban-production-80.schnworks.com/v1/chat/completions';
  private static MAX_RETRIES = 300;

  constructor(
    private model: string = 'gpt-4',
    private output: string = 'chat-completion-readaloud'
  ) {}

  private generateCacheKey(content: string): string {
    const hash = crypto.createHash('md5').update(content).digest('hex');
    return `chat_${hash}.json`;
  }

  public async fetchCompletion(content: string = 'Lợi ích của Build in Public'): Promise<ChatCompletionResponse | null> {
    const cacheKey = this.generateCacheKey(content);
    const cachedData = await readCache(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData.toString()) as ChatCompletionResponse;
    }

    try {
      const requestBody = {
        output: this.output,
        model: this.model,
        messages: [{ role: 'user', content }] as ChatMessage[],
      };

      const response = await fetch(ChatCompletionService.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.error) {
        return this.pollForCompletion(data.conversation_id, cacheKey);
      }

      const markdown_text =
        this.output === 'chat-completion-message'
          ? data.messages?.[0]?.markdown_text
          : data.markdown_text;

      if (typeof markdown_text === 'undefined') {
        throw new Error('Unexpected response format');
      }

      const completionData: ChatCompletionResponse = {
        markdown_text,
        conversation_id: data.conversation_id,
        audio_base64: data.audio_base64,
      };

      await writeCache(cacheKey, Buffer.from(JSON.stringify(completionData)));
      return completionData;
    } catch (error) {
      console.error('Error fetching chat completion:', error);
      return null;
    }
  }

  private async pollForCompletion(conversationId: string, cacheKey: string): Promise<ChatCompletionResponse> {
    let retries = 0;

    while (retries < ChatCompletionService.MAX_RETRIES) {
      const url = `${ChatCompletionService.API_URL}/${conversationId}`;
      console.log({ url });

      try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.error) {
          const markdown_text =
            this.output === 'chat-completion-message'
              ? data.messages?.[0]?.markdown_text
              : data.markdown_text;

          if (typeof markdown_text === 'undefined') {
            throw new Error('Unexpected response format during polling');
          }

          const completionData: ChatCompletionResponse = {
            markdown_text,
            conversation_id: data.conversation_id,
            audio_base64: data.audio_base64,
          };

          await writeCache(cacheKey, Buffer.from(JSON.stringify(completionData)));
          return completionData;
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      retries++;
      console.log(`Polling again in 1 second... Attempt ${retries}/${ChatCompletionService.MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Max polling attempts reached without success');
  }
}
