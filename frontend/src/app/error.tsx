"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <div role="alert" className="error-box">
        <h1>Something interrupted this view.</h1>
        <p>Your traces have not been changed.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
