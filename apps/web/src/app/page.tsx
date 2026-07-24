import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-display text-5xl tracking-tight text-ink md:text-6xl">Guardrail Agent</p>
      <p className="mt-4 max-w-xl text-lg text-ink/80">
        Natural language in. Schema-checked plan out. Policy gate, human approve, then dry-run and
        submit. Nothing valuable moves without your click.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="border border-line bg-paper/70 px-5 py-2.5 text-sm font-medium hover:bg-paper"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
