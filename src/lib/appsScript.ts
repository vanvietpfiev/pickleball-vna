const URL = process.env.APPS_SCRIPT_URL!;

export async function gasGet<T>(action: string): Promise<T> {
  const res = await fetch(`${URL}?action=${action}`, { cache: 'no-store' });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

export async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}
