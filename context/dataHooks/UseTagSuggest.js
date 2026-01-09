import useSWR from "swr";

export function useTagSuggest(query) {
  return useSWR(query ? `/api/v1/tags/suggest?name=${query}` : null, (url) => fetch(url).then((r) => r.json()));
}
