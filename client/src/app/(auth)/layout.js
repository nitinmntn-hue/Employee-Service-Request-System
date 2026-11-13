export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
