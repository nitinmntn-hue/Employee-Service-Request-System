import Link from "next/link";
import { Headset } from "lucide-react";

export default function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLink,
  footerLinkText,
}) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <Headset size={28} />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ServiceDesk
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Employee Service Request System
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>

          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        {children}

        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
          {footerText}{" "}
          <Link
            href={footerLink}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {footerLinkText}
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Secure employee service management
      </p>
    </div>
  );
}
