import { LoaderCircle } from "lucide-react";

export default function LoadingSpinner({
  size = "md",
  message = "Loading...",
  fullScreen = false,
}) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };

  return (
    <div
      className={`flex items-center justify-center gap-3 ${
        fullScreen ? "min-h-screen flex-col" : "py-6"
      }`}
    >
      <LoaderCircle
        className={`${sizes[size] || sizes.md} animate-spin text-blue-600`}
      />

      {message && (
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {message}
        </p>
      )}
    </div>
  );
}
