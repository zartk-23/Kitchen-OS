import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

export default function LocalLogin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const availability = trpc.auth.localAvailable.useQuery();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.loginLocal.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); setLocation("/app"); }, onError: failure => setError(failure.message) });
  const register = trpc.auth.registerLocal.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); setLocation("/app"); }, onError: failure => setError(failure.message) });

  useEffect(() => { if (user) setLocation("/app"); }, [user, setLocation]);
  const submitting = login.isPending || register.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (mode === "register") register.mutate({ name, email, password });
    else login.mutate({ email, password });
  };

  if (loading || availability.isLoading) return <div className="grid min-h-screen place-items-center bg-[#071d2e]"><Loader2 className="animate-spin text-[#d9923b]" /></div>;
  if (!availability.data?.enabled) return <div className="grid min-h-screen place-items-center bg-[#071d2e] p-5 text-center text-white"><div><ShieldCheck className="mx-auto mb-5 text-[#d9923b]" /><h1 className="font-[Instrument_Serif] text-4xl">Local access is not enabled.</h1><p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">Use the standard secure sign-in route, or enable local testing only in a controlled environment.</p><Link href="/app" className="mt-6 inline-flex text-sm text-[#e9b96f]">Back to sign in</Link></div></div>;

  return <main className="local-auth-page"><section className="local-auth-card"><Link href="/" className="local-back"><ArrowLeft size={15} /> KitchenOS home</Link><div className="local-auth-badge"><ShieldCheck size={16} /> Secure local testing</div><h1>{mode === "login" ? "Return to the pass." : "Create a test account."}</h1><p>{mode === "login" ? "Use your local testing credentials to enter the workspace." : "Passwords are bcrypt-hashed; this fallback is intended for controlled local testing."}</p><form onSubmit={submit}><label>{mode === "register" && <>Name<Input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required autoComplete="name" placeholder="Kitchen owner" /></>} </label><label>Email<Input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@restaurant.test" /></label><label>Password<Input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "register" ? 12 : 1} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? "12+ chars, upper/lower/number" : "Your password"} /></label>{error && <p className="local-auth-error" role="alert">{error}</p>}<Button type="submit" disabled={submitting}>{submitting ? "Checking…" : mode === "login" ? "Sign in securely" : "Create and sign in"}<ArrowRight size={16} /></Button></form><button className="local-mode-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Need a local test account? Create one" : "Already have a local account? Sign in"}</button><p className="local-auth-footnote">For normal use, KitchenOS continues to use its primary OAuth sign-in.</p></section></main>;
}
