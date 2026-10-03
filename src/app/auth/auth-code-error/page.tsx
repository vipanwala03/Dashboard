import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Sign-in didn&apos;t go through
      </h1>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Something went wrong exchanging the Google sign-in for a session. Try again.
      </p>
      <Link href="/" className="font-medium underline">
        Back to sign in
      </Link>
    </div>
  );
}
