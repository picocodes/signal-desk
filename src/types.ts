export type TopicStatus = "opportunity" | "brief" | "draft" | "scheduled" | "published";
export type Topic = {
  id: string;
  title: string;
  keyword: string;
  intent: string;
  status: TopicStatus;
  score: number;
  evidence: number;
  due: string;
};
export type Workspace = {
  siteName: string;
  siteUrl: string;
  audience: string;
  offer: string;
  tone: string;
  topics: Topic[];
};
