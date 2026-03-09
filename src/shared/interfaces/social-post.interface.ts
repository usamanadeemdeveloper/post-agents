export interface SocialPostResult {
  platform: "linkedin" | "twitter";
  success: boolean;
  postId?: string;
  error?: string;
  postedAt: Date;
}

export interface DailyRunResult {
  runAt: Date;
  linkedinResult: SocialPostResult;
  twitterResult: SocialPostResult;
}
