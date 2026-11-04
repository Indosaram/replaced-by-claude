/** Subset of GET /users/{u}. */
export interface GhUser {
  login: string;
  public_repos: number;
  followers: number;
  created_at: string;
  twitter_username?: string | null;
  name?: string | null;
  avatar_url?: string | null;
}

/** Subset of GET /users/{u}/repos. */
export interface GhRepo {
  name: string;
  fork: boolean;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
  description: string | null;
}

/** Facts computed from the user + repo list. Every ratio is 0 when there are 0 repos. */
export interface Signals {
  /** repos.length of the list we were given (at most 100, not user.public_repos). Denominator for ratios. */
  publicRepos: number;
  /** max(user.public_repos, repos.length): the real public repo count, for lines that name a total. */
  totalPublicRepos: number;
  forkRatio: number;
  totalStars: number;
  /** Up to 3 languages by repo count (ties alphabetical), nulls skipped. */
  topLanguages: string[];
  /** Distinct non-null languages. */
  langCount: number;
  /** Fraction of all repos whose language is topLanguages[0]; 0 when none. */
  topLanguageShare: number;
  /** Repos last pushed more than 365 days before `now`. */
  staleRepoCount: number;
  staleRatio: number;
  /** Repos named like todo/clone/tutorial/practice/test/demo/hello/portfolio/dotfiles/leetcode. */
  tutorialRepoCount: number;
  tutorialRatio: number;
  noDescriptionCount: number;
  accountAgeYears: number;
  followers: number;
  /** Most recently pushed non-fork repo; null when every repo is a fork. */
  newestRepoName: string | null;
  /** Non-fork repo with the most stars; null when there are no stars. */
  mostStarredRepoName: string | null;
  /** stargazers_count of mostStarredRepoName; 0 when it is null. */
  mostStarredRepoStars: number;
  /** Oldest pushed_at among stale non-fork repos; null when none are stale. */
  oldestStaleRepoName: string | null;
  /** First non-fork repo whose name looks like a tutorial exercise. */
  tutorialRepoName: string | null;
}

export type Tier = "instant" | "hours" | "days" | "weeks";

export interface Result {
  login: string;
  /** Integer minutes until replacement, within [3, 129600]. */
  minutes: number;
  label: string;
  tier: Tier;
  /** True when the user is too famous to be replaced (totalStars >= 250000). */
  autograph: boolean;
  signals: Signals;
  seed: number;
}
