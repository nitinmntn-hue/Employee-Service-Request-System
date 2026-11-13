"use client";

import Link from "next/link";
import {
  Headset,
  ArrowRight,
  ClipboardList,
  Clock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LoadingSpinner fullScreen size="lg" message="Loading ServiceDesk..." />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Headset size={22} />
            </div>

            <span className="text-xl font-bold text-slate-900">
              ServiceDesk
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Dashboard
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Login
                </Link>

                <Link
                  href="/register"
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <ShieldCheck size={16} />
            Employee Service Management
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Your workplace support,
            <span className="text-blue-600"> made simple.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Submit service requests, track progress, communicate with support
            teams, and get the help you need — all from one centralized
            platform.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Go to Dashboard
                <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  Create Account
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {isAuthenticated && (
            <p className="mt-5 text-sm text-slate-500">
              Welcome back,{" "}
              <span className="font-semibold text-slate-800">{user?.name}</span>
            </p>
          )}
        </div>

        {/* Dashboard Preview */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-blue-100/70 blur-2xl" />

          <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/70">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <h2 className="font-bold text-slate-900">Service Overview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your support workspace
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
                <ClipboardList size={24} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-blue-50 p-5">
                <ClipboardList className="text-blue-600" size={22} />
                <p className="mt-4 text-2xl font-bold text-slate-900">
                  Requests
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Submit and track issues
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-5">
                <Clock className="text-emerald-600" size={22} />
                <p className="mt-4 text-2xl font-bold text-slate-900">
                  Tracking
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor request status
                </p>
              </div>

              <div className="rounded-xl bg-violet-50 p-5">
                <Users className="text-violet-600" size={22} />
                <p className="mt-4 text-2xl font-bold text-slate-900">
                  Support
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Connect with support staff
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 p-5">
                <ShieldCheck className="text-amber-600" size={22} />
                <p className="mt-4 text-2xl font-bold text-slate-900">Secure</p>
                <p className="mt-1 text-sm text-slate-500">Role-based access</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Everything in one place
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Manage requests, assignments, departments, categories,
                notifications, and service-level agreements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              Everything your team needs
            </h2>
            <p className="mt-3 text-slate-600">
              A centralized solution for efficient employee support and service
              management.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Feature
              icon={<ClipboardList size={24} />}
              title="Request Management"
              description="Create, update, and track service requests with clear status visibility."
            />

            <Feature
              icon={<Users size={24} />}
              title="Team Collaboration"
              description="Assign requests to support staff and communicate through comments."
            />

            <Feature
              icon={<Clock size={24} />}
              title="SLA Tracking"
              description="Monitor response and resolution deadlines to improve support efficiency."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} ServiceDesk. All rights reserved.</p>
          <p>Employee Service Request System</p>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>

      <h3 className="text-lg font-bold text-slate-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
