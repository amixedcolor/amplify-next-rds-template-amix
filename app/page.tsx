'use client';

import { useAuthenticator } from '@aws-amplify/ui-react';
import { api } from 'aws-blocks';
import type { Todo } from 'aws-blocks';
import { useEffect, useState, type FormEvent } from 'react';
import { isDbResuming, retryWhileDbResumes } from './retry-while-db-resumes';

function errorMessage(e: unknown) {
  if (isDbResuming(e)) {
    return 'The database is still waking up from auto-pause. Please try again in a minute.';
  }
  return e instanceof Error ? e.message : String(e);
}

export default function TodoPage() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    retryWhileDbResumes(() => api.listTodos(), setWaking).then(setTodos, (e) =>
      setError(errorMessage(e)),
    );
  }, []);

  /** Runs a mutation (or nothing, to just retry loading), then reloads the list. */
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      // Retried separately so a successful mutation is never re-sent.
      await retryWhileDbResumes(action, setWaking);
      setTodos(await retryWhileDbResumes(() => api.listTodos(), setWaking));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api.createTodo(content);
      setContent('');
    });
  }

  return (
    <main>
      <header>
        <h1>My todos</h1>
        <span>{user?.signInDetails?.loginId}</span>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <form onSubmit={handleCreate}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What needs to be done?"
          aria-label="New todo"
          required
        />
        <button type="submit">Add</button>
      </form>

      {waking && (
        <p role="status">
          Waking up the database. This can take up to a few minutes; retrying automatically…
        </p>
      )}

      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => void run(async () => {})}>
            Reload
          </button>
        </p>
      )}

      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={(e) => void run(() => api.setTodoDone(todo.id, e.target.checked))}
              />
              <span className={todo.done ? 'done' : undefined}>{todo.content}</span>
            </label>
            <button type="button" onClick={() => void run(() => api.deleteTodo(todo.id))}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <p className="note">
        The database pauses when idle to save cost, so the first request after a while waits
        for it to wake up (this can take up to a few minutes). The app retries automatically.
      </p>
    </main>
  );
}
