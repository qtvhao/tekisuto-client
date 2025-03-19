export declare class ChatCompletionService {
    private model;
    private output;
    private static API_URL;
    private static MAX_RETRIES;
    constructor(model?: string, output?: string);
    private generateCacheKey;
    fetchCompletion(content?: string): Promise<any>;
    private pollForCompletion;
}
