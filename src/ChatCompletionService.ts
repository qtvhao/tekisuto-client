import { readCache, writeCache } from './utils/cache.js';
import crypto from 'crypto';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type ChatCompletionOutputType = 'chat-completion-readaloud' | 'chat-completion-message';

export interface ChatCompletionResponse {
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
    private output: ChatCompletionOutputType = 'chat-completion-readaloud'
  ) { }

  private generateCacheKey(content: string): string {
    const hash = crypto.createHash('md5').update(content + this.output).digest('hex');
    return `chat_${hash}.json`;
  }

  private transformToChatCompletionResponse(data: any): ChatCompletionResponse {
    const markdown_text = data.choices[0].message.content

    if (typeof markdown_text === 'undefined') {
      throw new Error('Unexpected response format during transformation');
    }

    return {
      markdown_text,
      conversation_id: data.id,
      audio_base64: data.choices[0].message.audio.data
    };
  }

  private isEligibleResponse(data: any): boolean {
    if (!data || !data.choices || !data.choices[0]?.message) return false;

    if (this.output === 'chat-completion-readaloud' && data.choices[0].message.audio?.data) {
      return true;
    }

    if (this.output === 'chat-completion-message' && data.choices[0].message.content) {
      return true;
    }

    return false;
  }

  public async fetchCompletion(content: string = 'Lợi ích của Build in Public'): Promise<ChatCompletionResponse | null> {
    const cacheKey = this.generateCacheKey(content);
    const cachedData = await readCache(cacheKey);

    if (cachedData) {
      const parsedData = JSON.parse(cachedData.toString());
      if (this.isEligibleResponse(parsedData)) {
        try {
          return this.transformToChatCompletionResponse(parsedData);
        } catch (e) {
          console.warn('Failed to parse cached data:', e);
        }
      }
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

      return this.pollForCompletion(data.conversationId, cacheKey);
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
          await writeCache(cacheKey, Buffer.from(JSON.stringify(data)));
          if (this.isEligibleResponse(data)) {
            const completionData = this.transformToChatCompletionResponse(data);

            return completionData;
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      retries++;
      console.debug(`Retry attempt ${retries} of ${ChatCompletionService.MAX_RETRIES}: Still waiting for a successful chat completion response for conversation ID: ${conversationId}. Pausing 10 second before the next polling attempt.`);
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }

    throw new Error('Max polling attempts reached without success');
  }
}
