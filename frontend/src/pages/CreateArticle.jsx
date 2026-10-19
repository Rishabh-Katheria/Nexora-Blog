import ArticleEditor from "../components/ArticleEditor";
import Seo from "../components/Seo";
import { privateMeta } from "../lib/seo";

export default function CreateArticle() {
  return (
    <>
      <Seo meta={privateMeta("Write a story")} />
      <ArticleEditor />
    </>
  );
}
