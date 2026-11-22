import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, runTransaction, type Firestore } from 'firebase/firestore/lite';
import { empty, parseData, type Data } from './model';

const firebaseConfig = import.meta.env.VITE_FIREBASE_CONFIG?.trim();

function configure() {
  if (!firebaseConfig) return { client: null, error: '' };
  try {
    const config = JSON.parse(firebaseConfig);
    if (!config.apiKey || !config.projectId || !config.appId) throw new Error();
    const app = initializeApp(config);
    return { client: { auth: getAuth(app), db: getFirestore(app) }, error: '' };
  } catch {
    return { client: null, error: 'Проверьте настройки веб-приложения Firebase в конфигурации сборки.' };
  }
}

const config = configure();
type Client = { auth: Auth; db: Firestore };

export type Snapshot = { data: Data; revision: number };
export const snapshotTooLarge = 'Расписание превысило допустимый размер для синхронизации. Экспортируйте резервную копию.';
export type CloudStorage = {
  initial: Snapshot;
  load: () => Promise<Snapshot>;
  save: (data: Data, expected: number) => Promise<number | null>;
  signOut: () => Promise<void>;
};

function storage(client: Client, userId: string) {
  const reference = doc(client.db, 'schedules', userId);
  return {
    async load(): Promise<Snapshot> {
      const result = await getDoc(reference);
      if (!result.exists()) return { data: empty, revision: 0 };
      const { payload, revision } = result.data();
      if (typeof payload !== 'string' || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Некорректная версия расписания.');
      return { data: parseData(payload), revision };
    },
    async save(data: Data, expected: number): Promise<number | null> {
      const payload = JSON.stringify(data);
      if (new TextEncoder().encode(payload).length > 960_000) throw new Error(snapshotTooLarge);
      return runTransaction(client.db, async transaction => {
        const current = await transaction.get(reference);
        const revision = current.exists() ? current.data().revision : 0;
        if (revision !== expected) return null;
        const next = expected + 1;
        transaction.set(reference, { payload, revision: next });
        return next;
      });
    },
    signOut: () => signOut(client.auth),
  };
}

function Screen({ children }: { children: ReactNode }) {
  return <main className="app"><section className="cloud-screen">
    <h1>Мои занятия</h1>{children}
  </section></main>;
}

function Login({ client }: { client: Client }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(client.auth, String(fields.get('email')).trim(), String(fields.get('password')));
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : '';
      const invalid = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].some(value => value === code);
      setMessage(invalid ? 'Проверьте электронную почту и пароль.' : 'Не удалось войти. Проверьте подключение и повторите попытку.');
    } finally {
      setBusy(false);
    }
  }
  return <Screen>
    <form className="form" onSubmit={submit}>
      <p>Войдите в свой аккаунт, чтобы открыть расписание.</p>
      <label>Электронная почта<input name="email" type="email" autoComplete="username" required /></label>
      <label>Пароль<input name="password" type="password" autoComplete="current-password" required /></label>
      {message && <p role="alert" className="error">{message}</p>}
      <button disabled={busy} className="primary">{busy ? 'Вход…' : 'Войти'}</button>
    </form>
  </Screen>;
}

type Render = (cloud?: CloudStorage) => ReactNode;

function Connected({ client, id, render }: { client: Client; id: string; render: Render }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Snapshot | 'error' | null>(null);
  const api = storage(client, id);
  useEffect(() => {
    let active = true;
    storage(client, id).load().then(
      initial => { if (active) setResult(initial); },
      () => { if (active) setResult('error'); },
    );
    return () => { active = false; };
  }, [client, id, attempt]);
  if (!result) return <Screen><p role="status">Загружаю расписание…</p></Screen>;
  if (result === 'error') return <Screen>
    <p role="alert" className="error">Не удалось загрузить расписание из Firebase.</p>
    <div className="flex gap-2">
      <button onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Повторить</button>
      <button onClick={() => api.signOut().catch(() => alert('Не удалось выйти из аккаунта.'))}>Выйти</button>
    </div>
  </Screen>;
  return render({ ...api, initial: result });
}

function Account({ client, render }: { client: Client; render: Render }) {
  const [user, setUser] = useState<User | null | undefined>();
  useEffect(() => onAuthStateChanged(client.auth, setUser), [client]);
  if (user === undefined) return <Screen><p role="status">Проверяю вход…</p></Screen>;
  if (!user) return <Login client={client} />;
  return <Connected key={user.uid} id={user.uid} client={client} render={render} />;
}

export function CloudGate({ render }: { render: Render }) {
  if (config.error) return <Screen><p role="alert" className="error">{config.error}</p></Screen>;
  return config.client ? <Account client={config.client} render={render} /> : render();
}
