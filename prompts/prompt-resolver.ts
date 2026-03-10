import { Platform, PostingStyle, PostPromptParams } from './prompt-params.interface';
import { defaultLinkedInPrompt, defaultTwitterPrompt } from './default-post.prompt';
import { technicalLinkedInPrompt, technicalTwitterPrompt } from './technical-post.prompt';
import { marketingLinkedInPrompt, marketingTwitterPrompt } from './marketing-post.prompt';
import { casualLinkedInPrompt, casualTwitterPrompt } from './casual-post.prompt';

type PromptFn = (params: PostPromptParams) => string;

type PromptRegistry = Record<PostingStyle, Record<Platform, PromptFn>>;

/**
 * Registry mapping every (style, platform) combination to its prompt function.
 * To add a new style: create a new prompt file and add an entry here.
 */
const PROMPT_REGISTRY: PromptRegistry = {
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
 * Resolves and renders the appropriate prompt for the given platform and style.
 *
 * @param platform - Target publishing platform ('linkedin' | 'twitter')
 * @param params   - Dynamic values injected into the prompt template
 * @param style    - Posting style; falls back to 'default' when omitted or unrecognised
 * @returns        Rendered prompt string ready to send to Claude
 */
export function resolvePrompt(
  platform: Platform,
  params: PostPromptParams,
  style: PostingStyle = 'default',
): string {
  const styleEntry = PROMPT_REGISTRY[style] ?? PROMPT_REGISTRY['default'];
  const promptFn = styleEntry[platform];
  return promptFn(params);
}
