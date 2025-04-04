import {
    ChatCompletionService
} from './ChatCompletionService.js'

(new ChatCompletionService('gpt-4o', '')).fetchCompletion('Viết bài giới thiệu Việt Nam').then(console.log)
