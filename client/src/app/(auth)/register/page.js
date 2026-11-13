"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import AuthCard from "@/components/auth/AuthCard";
import PasswordInput from "@/components/auth/PasswordInput";

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(100, "Name is too long"),

    email: z.string().trim().email("Enter a valid email address"),

    password: z.string().min(8, "Password must contain at least 8 characters"),

    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);

      const { confirmPassword, ...userData } = values;

      await registerAccount(userData);

      toast.success("Account created successfully!");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      description="Register as an employee to submit service requests."
      footerText="Already have an account?"
      footerLink="/login"
      footerLinkText="Sign in"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Full name
          </label>

          <div className="relative">
            <User
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              {...register("name")}
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              className={`w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                errors.name ? "border-red-400" : "border-slate-300"
              }`}
            />
          </div>

          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>

          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              {...register("email")}
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              className={`w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                errors.email ? "border-red-400" : "border-slate-300"
              }`}
            />
          </div>

          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <PasswordInput
          label="Password"
          registration={register("password")}
          error={errors.password?.message}
          placeholder="Minimum 8 characters"
        />

        <PasswordInput
          label="Confirm password"
          registration={register("confirmPassword")}
          error={errors.confirmPassword?.message}
          placeholder="Re-enter your password"
        />

        <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
          <ShieldCheck size={17} className="shrink-0" />
          <p>
            New accounts are registered with the Employee role. Contact your
            administrator if you need another role.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
