'use client';

import { useAuthenticator } from '@aws-amplify/ui-react';
import { api } from 'aws-blocks';
import type { Todo } from 'aws-blocks';
import { useEffect, useState, type FormEvent } from 'react';

// Aurora runs with minCapacity: 0 (see aws-blocks/index.ts), so it auto-pauses
// after ~5 minutes idle. The request that wakes it fails with this error while it
// resumes; retrying a few seconds later succeeds.
const DB_RESUMING_ERROR = 'ConnectionFailedException';

function errorMessage(e: unknown) {
  if (e instanceof Error && e.name === DB_RESUMING_ERROR) {
    return 'The database is waking up from auto-pause. Please try again in a few seconds.';
  }
  return e instanceof Error ? e.message : String(e);
}

export default function TodoPage() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listTodos().then(setTodos, (e) => setError(errorMessage(e)));
  }, []);

  /** Runs a mutation (or nothing, to just retry loading), then reloads the list. */
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setTodos(await api.listTodos());
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
        The database pauses when idle to save cost, so the first request after a while may fail
        while it wakes up. Retry after a few seconds.
      </p>
    </main>
  );
}
