import { useState } from "react";
import { Button, ButtonGroup } from "@primer/react";

import "./TrendingTagsComponent.css";
import { useTrendingTags } from "@/context/dataHooks/UseTrendingTags";
import { useRouter } from "next/router";

export default function TrendingTags() {
  const router = useRouter();
  const [period, setPeriod] = useState("7d");
  const { data, error, isLoading } = useTrendingTags(period);

  console.log({ data, error, isLoading });

  if (isLoading) {
    return <div className="trending-loading">Carregando…</div>;
  }

  if (error && error.status_code !== 404) {
    return (
      <div className="trending-error">
        <p>{error.message}</p>
      </div>
    );
  }

  function handleTagClick(tagName) {
    router.push(
      {
        pathname: "/posts",
        query: { tag: tagName },
      },
      undefined,
      { shallow: false },
    );
  }

  return (
    <aside className="trending-tags">
      <div className="trending-header">
        <h3 className="trending-title">Assuntos do momento</h3>

        <ButtonGroup size="small" className="trending-filters">
          <Button size="small" variant={period === "1d" ? "primary" : "default"} onClick={() => setPeriod("1d")}>
            1 dia
          </Button>
          <Button size="small" variant={period === "7d" ? "primary" : "default"} onClick={() => setPeriod("7d")}>
            7 dias
          </Button>
          <Button size="small" variant={period === "30d" ? "primary" : "default"} onClick={() => setPeriod("30d")}>
            30 dias
          </Button>
        </ButtonGroup>
      </div>

      <ul className="trending-list">
        {data?.map((tag, index) => (
          <li key={tag.name} className="trending-item">
            <button type="button" className="trending-button" onClick={() => handleTagClick(tag.name)}>
              <span className="rank">#{index + 1}</span>
              <span className="tag">#{tag.name}</span>
              <span className="count">{tag.usage_count}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
