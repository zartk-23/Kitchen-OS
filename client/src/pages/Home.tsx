/**
 * KitchenOS / The Quiet Shift
 * The restaurant story leads the page. Product detail arrives as calm shift cards—editorial,
 * grounded in kitchen work, and never a generic dashboard.
 */
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  LineChart,
  Menu,
  Play,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

const ASSETS = {
  mark: "/manus-storage/kitchenos-mark_48254396.png",
  morning: "/manus-storage/kitchenos-morning-poster_66af16d7.jpg",
  prep: "/manus-storage/kitchenos-prep-still_167e7c54.jpg",
  night: "/manus-storage/kitchenos-night-still_76d4b4de.jpg",
};

const navItems = [
  { label: "Home", href: "#home" },
  { label: "Intelligence", href: "#intelligence" },
  { label: "Menu", href: "#menu-intelligence" },
  { label: "Kitchen", href: "#inventory-intelligence" },
  { label: "About", href: "#waitlist" },
];

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const waitlistJoin = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: () => setEmailError("We could not save your place just now. Please try again shortly."),
  });

  const openWaitlist = () => {
    setEmail("");
    setEmailError("");
    setSubmitted(false);
    setWaitlistOpen(true);
  };

  const submitWaitlist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid work email.");
      return;
    }
    await waitlistJoin.mutateAsync({ email: trimmedEmail });
    setEmailError("");
  };

  const enterWorkspace = () => {
    if (isAuthenticated && user) setLocation("/app");
    else startLogin();
  };

  const navigate = () => setMenuOpen(false);

  return (
    <main id="home" className="site-shell selection:bg-[#d9923b]/45">
      <section className="hero-shell" aria-labelledby="hero-title">
        <div className="hero-poster" aria-hidden="true" />
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={ASSETS.morning}
          className="hero-video"
          aria-label="Cinematic KitchenOS restaurant scene"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
        <div className="hero-tint" aria-hidden="true" />
        <div className="hero-grain" aria-hidden="true" />

        <header className="absolute inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10">
          <nav className="liquid-glass mx-auto flex h-16 max-w-[1540px] items-center justify-between rounded-[1.2rem] px-3.5 sm:h-[4.5rem] sm:px-5">
            <a href="#home" className="group flex items-center gap-3 rounded-md pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9923b]" aria-label="KitchenOS home">
              <img src={ASSETS.mark} alt="" className="h-9 w-9 object-contain transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105 sm:h-10 sm:w-10" />
              <span className="brand-wordmark text-[1.7rem] leading-none text-white sm:text-[1.86rem]">
                Kitchen<span className="font-sans text-[0.55em] font-medium tracking-[0.04em] text-[#d9923b]">OS</span>
              </span>
            </a>

            <div className="hidden items-center gap-7 xl:flex" aria-label="Primary navigation">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} className="nav-link">{item.label}</a>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button className="nav-cta hidden sm:inline-flex" onClick={openWaitlist}>
                Join waitlist <ArrowUpRight size={14} strokeWidth={1.8} />
              </button>
              <button className="inline-grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/10 text-white transition-all duration-200 hover:border-white/35 hover:bg-white/10 active:scale-95 xl:hidden" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
                {menuOpen ? <X size={19} /> : <Menu size={19} />}
              </button>
            </div>
          </nav>

          {menuOpen && (
            <div className="liquid-glass mx-auto mt-2 max-w-[1540px] rounded-[1.2rem] p-3 xl:hidden">
              <div className="grid gap-1">
                {navItems.map((item) => (
                  <a key={item.label} href={item.href} className="rounded-xl px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white" onClick={navigate}>
                    {item.label}
                  </a>
                ))}
                <button className="nav-cta mt-1 inline-flex sm:hidden" onClick={openWaitlist}>
                  Join waitlist <ArrowUpRight size={14} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          )}
        </header>

        <div className="absolute bottom-0 left-0 top-0 z-20 hidden w-14 flex-col items-center justify-end border-r border-white/10 pb-9 xl:flex">
          <span className="vertical-note">SERVICE / 07:45</span>
          <span className="my-4 h-14 w-px bg-gradient-to-b from-transparent via-[#d9923b] to-transparent" />
          <span className="h-2 w-2 rounded-full bg-[#d9923b] shadow-[0_0_0_5px_rgba(217,146,59,0.12)]" />
        </div>

        <div className="relative z-20 flex min-h-[100svh] items-end px-5 pb-8 pt-36 sm:px-8 sm:pb-10 lg:px-14 lg:pb-14 xl:pl-[9rem]">
          <div className="w-full">
            <div className="hero-copy max-w-[885px]">
              <div className="eyebrow flex items-center gap-3"><span className="h-px w-8 bg-[#d9923b]" /><span>Before service / all signals in view</span></div>
              <h1 id="hero-title" className="hero-title mt-6 max-w-5xl text-[4rem] font-normal leading-[0.86] tracking-[-0.065em] text-white sm:mt-8 sm:text-7xl md:text-8xl lg:text-[7.7rem]">
                Where every <span className="text-white/58">kitchen</span> has a story.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-white/66 sm:mt-8 sm:text-lg">
                Before the first ticket arrives and after the last bowl is washed, KitchenOS keeps the quiet count — what is moving, what is low, and what tomorrow needs.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10">
                <button className="hero-cta hero-cta-primary" onClick={enterWorkspace}>{isAuthenticated ? "Open workspace" : "Enter the Kitchen"} <ArrowUpRight size={17} strokeWidth={1.8} /></button>
                <button className="hero-cta hero-cta-quiet" onClick={() => setStoryOpen(true)}><span className="grid h-5 w-5 place-items-center rounded-full border border-white/30"><Play size={8} className="ml-px fill-current" /></span>See how it works</button>
              </div>
            </div>

            <div className="mt-10 flex items-end justify-between border-t border-white/14 pt-4 sm:mt-14 lg:mr-5 lg:max-w-[88rem]">
              <div className="flex items-center gap-3 text-[0.64rem] font-medium uppercase tracking-[0.18em] text-white/45"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d9923b]" />One clear handover before the rush</div>
              <a href="#intelligence" className="group hidden items-center gap-3 text-xs text-white/55 transition-colors hover:text-white sm:flex">Follow the shift <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 transition-transform duration-300 group-hover:translate-y-1"><ArrowDown size={15} /></span></a>
            </div>
          </div>
        </div>

        <aside className="absolute right-5 top-[19%] z-20 hidden w-[230px] lg:block xl:right-10 xl:top-[24%]">
          <div className="liquid-glass data-panel panel-enter panel-lift rounded-2xl p-4">
            <div className="flex items-center justify-between"><span className="panel-label">Today</span><span className="text-[0.61rem] font-medium text-white/38">10:36</span></div>
            <div className="mt-5 flex items-end justify-between"><div><p className="text-[1.8rem] leading-none tracking-[-0.06em] text-white">184</p><p className="mt-1 text-xs text-white/48">orders so far</p></div><div className="rounded-full border border-[#d9923b]/25 bg-[#d9923b]/10 px-2.5 py-1 text-[0.62rem] font-medium text-[#f3c47e]">+12% demand</div></div>
            <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/62"><span className="h-1.5 w-1.5 rounded-full bg-[#d9923b]" />Kitchen healthy</div>
          </div>
        </aside>

        <aside className="absolute bottom-[9.5rem] right-5 z-20 hidden w-[248px] xl:block xl:right-10">
          <div className="liquid-glass data-panel panel-enter-delayed panel-lift rounded-2xl p-4">
            <div className="flex items-center justify-between"><span className="panel-label">Inventory / 04</span><span className="h-1.5 w-1.5 rounded-full bg-[#d9923b]" /></div>
            <div className="mt-4 space-y-2.5 text-xs"><InventoryLine label="Chicken" value="18 kg" emphasis /><InventoryLine label="Tomatoes" value="4 kg" /><InventoryLine label="Rice" value="22 kg" /></div>
            <div className="mt-4 border-t border-white/10 pt-3 text-[0.67rem] text-[#f1bf74]">Chicken running low</div>
          </div>
        </aside>
      </section>

      <section id="intelligence" className="narrative-section" aria-labelledby="intelligence-title">
        <Reveal className="narrative-intro">
          <div><div className="eyebrow flex items-center gap-3"><span className="h-px w-8 bg-[#d9923b]" /><span>Intelligence that stays close to the work</span></div><h2 id="intelligence-title" className="section-title mt-6">The shift does not need another dashboard.</h2></div>
          <p className="narrative-lead">KitchenOS reads the details already passing through your kitchen and returns them as a useful next move. The owner stays in the room; the system keeps the count.</p>
        </Reveal>

        <div className="feature-thread">
          <Reveal className="feature-story inventory-story" id="inventory-intelligence">
            <div className="feature-image-wrap"><img src={ASSETS.prep} alt="Chef preparing ingredients in a restaurant kitchen" className="feature-image" /><div className="image-caption"><span className="panel-label">Inventory / first to know</span><span>Every crate has a place in the story.</span></div></div>
            <div className="feature-copy">
              <div className="feature-icon"><Boxes size={20} /></div>
              <p className="panel-label mt-6">Inventory management</p>
              <h3 className="feature-title mt-3">Know what the shelves are telling you.</h3>
              <p className="feature-body mt-5">Track what arrived, what moved, and what needs using first — without interrupting the pace of service. KitchenOS brings counts, batches, expiry windows, and purchase signals into a single quiet handover.</p>
              <div className="signal-list mt-7"><Signal text="FEFO cues for ingredients nearing their date" /><Signal text="Low-stock warnings before the dinner rush" /><Signal text="A clean ledger for every count, waste note, and delivery" /></div>
              <a href="#waitlist" className="inline-link mt-8">See inventory in the kitchen <ChevronRight size={16} /></a>
            </div>
          </Reveal>

          <Reveal className="feature-story menu-story" id="menu-intelligence">
            <div className="feature-copy menu-copy">
              <div className="feature-icon"><LineChart size={20} /></div>
              <p className="panel-label mt-6">Menu intelligence</p>
              <h3 className="feature-title mt-3">Every dish earns its place on the pass.</h3>
              <p className="feature-body mt-5">See the quiet tradeoffs behind the menu: cost, contribution, preparation time, and the way each dish moves through a service. The next price change or promotion arrives with context, not guesswork.</p>
              <div className="signal-list mt-7"><Signal text="Contribution margins that update with ingredient costs" /><Signal text="A clear stars, workhorses, premium, and rework menu map" /><Signal text="Signals for prep effort, demand, and revenue per service hour" /></div>
              <a href="#waitlist" className="inline-link mt-8">Read the menu more clearly <ChevronRight size={16} /></a>
            </div>
            <div className="menu-matrix" aria-label="Menu intelligence matrix">
              <div className="matrix-heading"><div><span className="panel-label">Today&apos;s menu map</span><p className="mt-1 text-sm text-white/72">A gentler way to decide what stays.</p></div><UtensilsCrossed size={18} className="text-[#d9923b]" /></div>
              <div className="matrix-grid"><MatrixCell label="Stars" note="Promote" tone="star" /><MatrixCell label="Premium" note="Protect margin" tone="premium" /><MatrixCell label="Workhorses" note="Make simpler" tone="workhorse" /><MatrixCell label="Rework" note="Review cost" tone="rework" /></div>
              <div className="menu-observation"><Sparkles size={14} /><span>Paneer bowl is moving well. Its margin is asking for a closer look.</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="waitlist" className="waitlist-section" aria-labelledby="waitlist-heading">
        <Reveal className="waitlist-card">
          <div className="waitlist-mark"><ShoppingBasket size={23} /></div>
          <div><p className="panel-label">Early service</p><h2 id="waitlist-heading" className="section-title mt-4">There&apos;s room at the pass.</h2><p className="mt-5 max-w-xl text-base leading-relaxed text-white/60">Be first to hear when KitchenOS is ready to make tomorrow&apos;s shift easier.</p></div>
          <button className="hero-cta hero-cta-primary waitlist-button" onClick={openWaitlist}>Save my place <ArrowUpRight size={17} /></button>
        </Reveal>
      </section>

      {storyOpen && <StoryDialog onClose={() => setStoryOpen(false)} onWaitlist={openWaitlist} />}
      {waitlistOpen && <WaitlistDialog email={email} error={emailError} submitted={submitted} isSubmitting={waitlistJoin.isPending} onClose={() => setWaitlistOpen(false)} onEmailChange={(value) => { setEmail(value); setEmailError(""); }} onSubmit={submitWaitlist} />}
    </main>
  );
}

function WaitlistDialog({ email, error, submitted, isSubmitting, onClose, onEmailChange, onSubmit }: { email: string; error: string; submitted: boolean; isSubmitting: boolean; onClose: () => void; onEmailChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  return <section className="story-layer" role="dialog" aria-modal="true" aria-labelledby="waitlist-dialog-title"><div className="story-backdrop" onClick={onClose} /><div className="waitlist-dialog">{submitted ? <div className="success-state"><span className="success-orbit"><Check size={27} strokeWidth={2} /></span><p className="panel-label">Seat saved</p><h2 id="waitlist-dialog-title" className="hero-title mt-4 text-5xl leading-[0.9] text-white">You&apos;re on the prep list.</h2><p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/60">We&apos;ll write to <strong className="font-medium text-white/90">{email}</strong> when KitchenOS opens its doors.</p><button className="hero-cta hero-cta-primary mt-8" onClick={onClose}>Back to the kitchen <ArrowUpRight size={16} /></button></div> : <><button className="story-close absolute right-5 top-5" onClick={onClose} aria-label="Close waitlist"><X size={18} /></button><p className="panel-label">Early service / KitchenOS</p><h2 id="waitlist-dialog-title" className="hero-title mt-4 max-w-xl text-5xl leading-[0.9] text-white sm:text-6xl">A better shift starts with one note.</h2><p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">Leave your email and we&apos;ll invite you in when the first tables are set.</p><form className="waitlist-form mt-8 manus-no-record" noValidate onSubmit={onSubmit}><label htmlFor="waitlist-email" className="sr-only">Work email</label><input id="waitlist-email" name="waitlist-email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@restaurant.com" aria-describedby={error ? "email-error" : undefined} aria-invalid={Boolean(error)} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} autoFocus disabled={isSubmitting} /><button type="submit" aria-label="Join KitchenOS waitlist" disabled={isSubmitting}>{isSubmitting ? <span className="text-[0.64rem] font-medium">…</span> : <ArrowUpRight size={18} />}</button></form>{error && <p id="email-error" className="mt-3 text-sm text-[#f1bf74]" role="alert">{error}</p>}<p className="mt-5 text-[0.67rem] leading-relaxed text-white/36">No noise from the pass. Just the occasional note when there is something worth serving.</p></>}</div></section>;
}

function StoryDialog({ onClose, onWaitlist }: { onClose: () => void; onWaitlist: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { label: "01 / Count", title: "Inventory that speaks before it shouts.", body: "KitchenOS brings stock, expiry windows, and expected service demand into one useful pre-shift read. It suggests what needs using first; your team confirms the count.", image: ASSETS.morning, signals: ["Tomatoes / 4.8 kg / expires tomorrow", "Chicken / projected shortfall after 18:30", "Rice / enough for 1.3 services"] },
    { label: "02 / Decide", title: "A menu that earns its place at the pass.", body: "See contribution, demand, and prep effort together. KitchenOS frames a decision and its evidence, rather than silently changing a price or removing a dish.", image: ASSETS.prep, signals: ["Paneer bowl / high demand, margin needs review", "Biryani / star dish, stock prep early", "Tomato soup / timely use for FEFO batch"] },
    { label: "03 / Approve", title: "A swarm that stays answerable to people.", body: "Shared notes move from observation to preparation, approval, and learning. Teams can shape the next move together; recommendations never place orders or rewrite operations on their own.", image: ASSETS.night, signals: ["Observe / chicken demand signal", "Prepare / draft purchase recommendation", "Approve / manager makes the final call"] },
  ];
  const current = steps[step];
  return <section id="story" className="story-layer" role="dialog" aria-modal="true" aria-labelledby="story-title"><div className="story-backdrop" onClick={onClose} /><div className="story-sheet"><div className="flex items-start justify-between gap-8 border-b border-white/10 pb-5 sm:items-center sm:pb-6"><div><div className="eyebrow flex items-center gap-3"><span className="h-px w-7 bg-[#d9923b]" /><span>KitchenOS product tour</span></div><h2 id="story-title" className="hero-title mt-3 text-4xl leading-none tracking-[-0.055em] text-white sm:text-5xl">The shift, made legible.</h2></div><button className="story-close" onClick={onClose} aria-label="Close story"><X size={18} /></button></div><div className="tour-progress" aria-label="Product tour steps">{steps.map((tourStep, index) => <button key={tourStep.label} className={index === step ? "is-active" : ""} onClick={() => setStep(index)}><span>{tourStep.label}</span><i /></button>)}</div><div className="tour-stage"><div className="tour-image"><img src={current.image} alt="Cinematic KitchenOS workflow preview" /><div className="tour-image-overlay"><span>{current.label}</span><strong>{step === 0 ? "FEFO watch" : step === 1 ? "Margin map" : "Human approval"}</strong></div></div><div className="tour-copy"><p className="panel-label">{current.label}</p><h3>{current.title}</h3><p>{current.body}</p><div className="tour-signals">{current.signals.map(signal => <div key={signal}><span className="signal-dot" />{signal}</div>)}</div><button className="tour-next" onClick={() => setStep((step + 1) % steps.length)}>{step === steps.length - 1 ? "Begin again" : "Next signal"} <ArrowRight size={15} /></button></div></div><div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center"><p className="max-w-xl text-sm leading-relaxed text-white/56">KitchenOS turns small operational signals into a grounded recommendation, with a human owner of every consequential action.</p><button className="hero-cta hero-cta-primary shrink-0" onClick={onWaitlist}>Save my place <ArrowUpRight size={16} /></button></div></div></section>;
}

function Reveal({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  const elementRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const element = elementRef.current; if (!element) return; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(entry.target); } }, { threshold: 0.18 }); observer.observe(element); return () => observer.disconnect(); }, []);
  return <section id={id} ref={elementRef} className={`scroll-reveal ${visible ? "is-visible" : ""} ${className}`}>{children}</section>;
}

function InventoryLine({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) { return <div className="flex items-center justify-between text-white/65"><span>{label}</span><span className={emphasis ? "font-medium text-[#f1bf74]" : "text-white/86"}>{value}</span></div>; }
function Signal({ text }: { text: string }) { return <div className="signal-row"><span className="signal-dot" /><span>{text}</span></div>; }
function MatrixCell({ label, note, tone }: { label: string; note: string; tone: string }) { return <div className={`matrix-cell ${tone}`}><span>{label}</span><small>{note}</small></div>; }
function StoryFrame({ image, time, text }: { image: string; time: string; text: string }) { return <article className="story-frame"><img src={image} alt="KitchenOS cinematic restaurant moment" /><div className="story-frame-tint" /><div className="relative z-10 flex min-h-56 flex-col justify-end p-4"><p className="panel-label">{time}</p><p className="mt-2 max-w-[17rem] text-sm leading-snug text-white/78">{text}</p></div></article>; }
