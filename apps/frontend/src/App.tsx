import { NavLink, Route, Routes } from "react-router"
import { trpc } from "./trpc"

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-50">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-8 flex gap-3">
          <AppNavLink to="/">Home</AppNavLink>
          <AppNavLink to="/about">About</AppNavLink>
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </div>
  )
}

function AppNavLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "rounded-full border px-4 py-2 transition",
          isActive
            ? "border-cyan-400 bg-cyan-400 text-slate-950"
            : "border-white/10 bg-slate-900/80 text-slate-200 hover:border-cyan-400/50",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  )
}

function SimplePage({
  page,
  title,
}: {
  page: "home" | "about"
  title: string
}) {
  const logPage = trpc.logPage.useMutation()

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h1 className="text-4xl font-semibold text-white">{title}</h1>
      <button
        className="mt-6 rounded-xl bg-cyan-400 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={logPage.isPending}
        onClick={() => logPage.mutate({ page })}
        type="button"
      >
        {logPage.isPending ? "Logging..." : `Log ${title}`}
      </button>
      {logPage.isSuccess ? (
        <p className="mt-3 text-sm text-slate-300">
          Logged in the backend console.
        </p>
      ) : null}
      {logPage.isError ? (
        <p className="mt-3 text-sm text-red-300">Request failed.</p>
      ) : null}
      <p className="mt-4 text-sm text-slate-400">
        Calls `logPage` with `{page}`.
      </p>
    </section>
  )
}

function HomePage() {
  return <SimplePage page="home" title="Home" />
}

function AboutPage() {
  return <SimplePage page="about" title="About" />
}

function NotFoundPage() {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h1 className="text-4xl font-semibold text-white">Not found</h1>
    </section>
  )
}
