"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";

import { signIn } from "@/app/actions/auth";
import { VideoBackground } from "@/components/ui/login-form";

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
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden select-none">
      {/* Premium topographic video background */}
      <VideoBackground />

      <div className="relative w-full max-w-md p-8 space-y-6 bg-neutral-900/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/95 border border-white/10 shadow-md p-2 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/RKE logo.png" alt="RKE Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white font-sans">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-neutral-300">
            Sign in to manage your RKE accounts & billing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Email Input with Animated Label */}
          <div className="relative z-0">
            <input
              type="email"
              id="floating_email"
              className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-neutral-400 appearance-none focus:outline-none focus:ring-0 focus:border-blue-500 peer disabled:opacity-50"
              placeholder=" " 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              autoComplete="email"
            />
            <label
              htmlFor="floating_email"
              className="absolute text-sm text-neutral-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-blue-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 flex items-center"
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
              className="block py-2.5 pl-0 pr-10 w-full text-sm text-white bg-transparent border-0 border-b-2 border-neutral-400 appearance-none focus:outline-none focus:ring-0 focus:border-blue-500 peer disabled:opacity-50"
              placeholder=" "
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              autoComplete="current-password"
            />
            <label
              htmlFor="floating_password"
              className="absolute text-sm text-neutral-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-blue-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 flex items-center"
            >
              <Lock className="inline-block mr-2 h-4 w-4" />
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-3 text-neutral-400 hover:text-white focus:outline-none cursor-pointer"
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
            className="group w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-blue-500 transition-all duration-300 cursor-pointer"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing In...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
