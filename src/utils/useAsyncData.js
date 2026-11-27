import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiMessage } from './moderation';

/**
 * Tải dữ liệu bất đồng bộ theo khóa (key).
 *   fetcher  () => Promise<data>   (gọi lại mỗi khi key hoặc reload() thay đổi)
 *   key      chuỗi mô tả tham số; đổi key thì tải lại
 * Trả về { data, error, loading, reload, setData }
 *   - loading = true từ lúc đổi key / reload cho tới khi có kết quả mới
 *   - data giữ kết quả thành công gần nhất (để sidebar không nhấp nháy); trang nên kiểm tra loading/error trước khi dùng
 *   - setData(newData) cập nhật tại chỗ (dùng sau khi thao tác trả về dữ liệu mới)
 */
export default function useAsyncData(fetcher, key) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });
  const fullKey = `${key}#${reloadToken}`;
  const fullKeyRef = useRef(fullKey);
  useEffect(() => { fullKeyRef.current = fullKey; });

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((data) => { if (!cancelled) setResult({ key: fullKey, data, error: '' }); })
      .catch((e) => {
        if (!cancelled) setResult((prev) => ({ key: fullKey, data: prev.data, error: getApiMessage(e, 'Không tải được dữ liệu.') }));
      });
    return () => { cancelled = true; };
  }, [fullKey]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const setData = useCallback((data) => setResult({ key: fullKeyRef.current, data, error: '' }), []);

  return { data: result.data, error: result.error, loading: result.key !== fullKey, reload, setData };
}
