export interface ChatCompletionResponse {
    markdown_text: string;
    conversation_id: string;
    audio_base64: string;
    error?: string;
}
export declare class ChatCompletionService {
    private model;
    private output;
    private static API_URL;
    private static MAX_RETRIES;
    constructor(model?: string, output?: string);
    private generateCacheKey;
    fetchCompletion(content?: string): Promise<ChatCompletionResponse | null>;
    private pollForCompletion;
}
