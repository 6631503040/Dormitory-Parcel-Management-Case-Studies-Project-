import { useEffect, useState } from "react";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";

export const PARCEL_PAGE_SIZE = 8;
export default function useParcelPage({ query, status, unmatched, refreshKey }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ q: query.trim(), status, unmatched });
  useEffect(() => {
    if (query.trim() === filter.q && status === filter.status && unmatched === filter.unmatched) return;
    const timer = setTimeout(() => {
      setPage(1);
      setFilter({ q: query.trim(), status, unmatched });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, status, unmatched]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.listParcels({ ...filter, page, pageSize: PARCEL_PAGE_SIZE }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const last = Math.max(1, Math.ceil(res.total / PARCEL_PAGE_SIZE));
        if (page > last) { setPage(last); return; }
        setResult(res);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err));
        setLoading(false);
      });
    return () => controller.abort();
  }, [filter, page, refreshKey]);
  const filtering = query.trim() !== filter.q || status !== filter.status || unmatched !== filter.unmatched;
  return { ...result, page, setPage, loading: loading || filtering, error };
}
