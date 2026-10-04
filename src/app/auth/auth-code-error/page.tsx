import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold text-ink-strong">
        Sign-in didn&apos;t go through
      </h1>
      <p className="max-w-sm text-ink-muted">
        Something went wrong exchanging the Google sign-in for a session. Try again.
      </p>
      <Link href="/" className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
        Back to sign in
      </Link>
    </div>
  );
}
