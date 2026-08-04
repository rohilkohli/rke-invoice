"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";

import { signIn } from "@/app/actions/auth";

export default function LoginClientPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    startTransition(async () => {
      const result = await signIn({ email, password });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Signed in successfully!");
      }
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden select-none bg-slate-950">
      {/* Background Image from public folder */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sl_122221_47450_06.jpg"
        alt="Background"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* Subtle overlay for optimal contrast */}
      <div className="absolute inset-0 bg-slate-950/30" />

      {/* Liquid Glass Login Box */}
      <div className="relative w-full max-w-md p-8 sm:p-9 space-y-8 liquid-glass-card rounded-3xl z-10 overflow-hidden transition-all duration-500">
        {/* Specular Liquid Light Sheen Overlay */}
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none rounded-full transform -rotate-12 blur-[1px]" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        <div className="relative flex flex-col items-center text-center z-10">
          <div className="flex justify-center items-center h-16 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/RKE logo.png" 
              alt="RKE Logo" 
              className="h-full w-auto max-w-[200px] object-contain filter invert brightness-200 drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)]" 
            />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white font-sans drop-shadow-sm">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-300/80 font-normal">
            Sign in to manage your RKE accounts &amp; billing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-7 z-10">
          {/* Email Input with Animated Label */}
          <div className="relative z-0">
            <input
              type="email"
              id="floating_email"
              className="block py-3 px-4 w-full text-sm text-white bg-sky-950/40 rounded-xl border border-sky-200/20 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300/80 peer disabled:opacity-50 font-medium transition-all duration-300 shadow-inner"
              placeholder=" "
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              autoComplete="email"
            />
            <label
              htmlFor="floating_email"
              className="absolute text-sm text-slate-300/70 font-normal duration-300 transform -translate-y-7 scale-75 top-3 left-4 origin-[0] peer-focus:text-blue-300 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-7 flex items-center pointer-events-none"
            >
              <Mail className="inline-block mr-2 h-4 w-4" />
              Email Address
            </label>
          </div>

          {/* Password Input with Animated Label */}
          <div className="relative z-0">
            <input
              type={showPassword ? "text" : "password"}
              id="floating_password"
              className="block py-3 pl-4 pr-11 w-full text-sm text-white bg-sky-950/40 rounded-xl border border-sky-200/20 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300/80 peer disabled:opacity-50 font-medium transition-all duration-300 shadow-inner"
              placeholder=" "
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              autoComplete="current-password"
            />
            <label
              htmlFor="floating_password"
              className="absolute text-sm text-slate-300/70 font-normal duration-300 transform -translate-y-7 scale-75 top-3 left-4 origin-[0] peer-focus:text-blue-300 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-7 flex items-center pointer-events-none"
            >
              <Lock className="inline-block mr-2 h-4 w-4" />
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white focus:outline-none cursor-pointer transition-colors"
              disabled={isPending}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="group relative overflow-hidden w-full flex items-center justify-center py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 rounded-xl text-white font-semibold liquid-glass-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-400 transition-all duration-300 cursor-pointer"
          >
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
            {isPending ? (
              <span className="relative flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing In...
              </span>
            ) : (
              <span className="relative flex items-center justify-center gap-2">
                Sign In <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

