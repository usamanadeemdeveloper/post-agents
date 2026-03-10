import { Platform, PostingStyle, PostPromptParams } from './prompt-params.interface';
import { defaultLinkedInPrompt, defaultTwitterPrompt } from './default-post.prompt';
import { technicalLinkedInPrompt, technicalTwitterPrompt } from './technical-post.prompt';
import { marketingLinkedInPrompt, marketingTwitterPrompt } from './marketing-post.prompt';
import { casualLinkedInPrompt, casualTwitterPrompt } from './casual-post.prompt';

type PromptFn = (params: PostPromptParams) => string;

interface PromptEntry {
  linkedin: PromptFn;
  twitter: PromptFn;
}

const PROMPT_REGISTRY: Record<PostingStyle, PromptEntry> = {
  default: {
    linkedin: defaultLinkedInPrompt,
    twitter: defaultTwitterPrompt,
  },
  technical: {
    linkedin: technicalLinkedInPrompt,
    twitter: technicalTwitterPrompt,
  },
  marketing: {
    linkedin: marketingLinkedInPrompt,
    twitter: marketingTwitterPrompt,
  },
  casual: {
    linkedin: casualLinkedInPrompt,
    twitter: casualTwitterPrompt,
  },
};

/**
 * Resolves the correct prompt template based on platform and posting style,
 * then renders it with the supplied parameters.
 *
 * To add a new style:
 * 1. Create `prompts/my-style.prompt.ts` exporting `myStyleLinkedInPrompt` and `myStyleTwitterPrompt`
 * 2. Add one entry to PROMPT_REGISTRY above — no other files need changing
 */
export function resolvePrompt(
  platform: Platform,
  params: PostPromptParams,
  style: PostingStyle = 'default',
): string {
  const entry = PROMPT_REGISTRY[style] ?? PROMPT_REGISTRY['default'];
  return entry[platform](params);
}
