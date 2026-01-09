import useSWR from "swr";

const fetcher = async (url) => {
  const response = await fetch(url, { credentials: "include" });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message);
    error.name = data.name;
    error.action = data.action;
    error.status_code = data.status_code;
    throw error;
  }

  return data;
};

export function useTrendingTags(period) {
  const key = period ? `/api/v1/tags/trending?period=${period}` : null;

  return useSWR(key, fetcher);
}
