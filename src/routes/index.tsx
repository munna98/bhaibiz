import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarCheck,
  Wallet,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Home,
  Receipt,
  Share2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Smartphone,
  Building2,
  FileText,
  ChevronRight,
  Check,
  X,
  Menu,
  Lock,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BhaiBiz — Labour Contractor Software & Daily Commission Ledger | Kerala" },
      {
        name: "description",
        content:
          "Track daily worker attendance, automate daily commission calculations, safeguard Aadhaar documents in an encrypted vault, manage worker camps, and share instant WhatsApp receipts. Purpose-built for labour contractors in Kerala and India.",
      },
      {
        name: "keywords",
        content:
          "labour contractor software kerala, commission ledger for labour suppliers, migrant worker attendance app, labour supplier accounting, bhai labour contractor app, labour camp management software, labour commission calculator, aadhaar secure worker register, kerala guest worker app",
      },
      { property: "og:title", content: "BhaiBiz — Labour Contractor Software & Daily Commission Ledger" },
      {
        property: "og:description",
        content:
          "Who worked today, what's due, who still owes — tracked in two taps. Daily attendance, automatic commission calculations, encrypted Aadhaar vault, camp tracking, and WhatsApp receipts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bhaibiz.com/" },
      { property: "og:site_name", content: "BhaiBiz" },
      { property: "og:image", content: "https://bhaibiz.com/favicon.svg" },
      { property: "og:locale", content: "en_IN" },
      { property: "og:locale:alternate", content: "ml_IN" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BhaiBiz — Labour Contractor Software & Daily Commission Ledger" },
      {
        name: "twitter:description",
        content:
          "Who worked today, what's due, who still owes — tracked in two taps. Automated commission ledger, WhatsApp receipts, and Aadhaar vault.",
      },
      { name: "twitter:image", content: "https://bhaibiz.com/favicon.svg" },
    ],
    links: [{ rel: "canonical", href: "https://bhaibiz.com/" }],
  }),
  component: Index,
});

const schemaGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://bhaibiz.com/#webapp",
      name: "BhaiBiz",
      url: "https://bhaibiz.com",
      applicationCategory: "BusinessApplication, FinanceApplication",
      operatingSystem: "All modern web browsers, Android, iOS",
      inLanguage: ["en", "ml"],
      description:
        "Daily attendance register, automated commission ledger, encrypted Aadhaar vault, camp accommodation management, and WhatsApp receipts platform for labour contractors and manpower suppliers in Kerala and India.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
        description: "Free trial available",
      },
      featureList: [
        "2-tap daily and bulk worker attendance marking",
        "Automated daily commission calculations based on effective date agreements",
        "FIFO cash ledger automatically clearing oldest unpaid shifts first",
        "Digital receipt generation formatted for Bluetooth thermal printers and WhatsApp sharing",
        "AES-GCM 256-bit encrypted Aadhaar vault with masked staff view",
        "Labour camp, quarters, and room accommodation management",
        "Zero-friction staff creation with username and password (no email required)",
        "Four-tier role-based access control (Owner, Manager, Operator, Accountant)",
        "Five real-time exportable Excel and PDF financial and attendance reports",
        "Full English and Malayalam (മലയാളം) bilingual interface",
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://bhaibiz.com/#organization",
      name: "BhaiBiz",
      url: "https://bhaibiz.com",
      logo: "https://bhaibiz.com/favicon.svg",
    },
    {
      "@type": "FAQPage",
      "@id": "https://bhaibiz.com/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is BhaiBiz?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "BhaiBiz is an all-in-one software platform purpose-built for labour contractors, manpower agencies, and camp managers in Kerala and India. It automates daily worker attendance, daily commission calculation, cash and UPI collections with instant WhatsApp receipts, bank-grade encrypted Aadhaar storage, camp accommodation tracking, and audit-ready Excel reports.",
          },
        },
        {
          "@type": "Question",
          name: "How does BhaiBiz calculate worker commission?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "When a worker is marked as 'Worked' for a given day, BhaiBiz automatically looks up the active commission agreement for that date and credits the commission ledger. If commission rates change, agreements are stored with effective dates so historical records are never retroactively altered.",
          },
        },
        {
          "@type": "Question",
          name: "Can field supervisors see workers' full 12-digit Aadhaar numbers?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. To protect worker privacy and meet Indian identity data compliance, Aadhaar numbers are encrypted using AES-GCM 256-bit encryption. Staff supervisors only see the masked last 4 digits (e.g., •••• •••• 1234). Only the verified company owner can reveal the full 12 digits.",
          },
        },
        {
          "@type": "Question",
          name: "Can I print receipts or share them on WhatsApp?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Every recorded payment (Cash, UPI, or Bank) generates an instant, uniquely numbered digital receipt that can be shared to workers or clients via WhatsApp in one tap, or printed via Bluetooth thermal printers or standard paper printers.",
          },
        },
        {
          "@type": "Question",
          name: "How does BhaiBiz manage labour camps and accommodations?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "BhaiBiz includes dedicated accommodations management. Contractors can track multiple camps, rented buildings, and rooms, monitor bed capacities, assign workers to specific rooms, and assign site operators to oversee each accommodation.",
          },
        },
        {
          "@type": "Question",
          name: "Do field supervisors need an email address to log in?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. BhaiBiz provides zero-friction staff provisioning. Company owners can create operator accounts with a direct username and password on the spot, eliminating email verification barriers for non-tech-savvy site supervisors.",
          },
        },
        {
          "@type": "Question",
          name: "Can I export attendance and commission reports to Excel?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. BhaiBiz includes 5 comprehensive real-time reports (Net Outstanding Due, Daily Attendance Log, Work Commission Earned, Payment Receipts Register, and Advance Loans & Repayments), all of which can be exported directly to formatted Excel (.xlsx) files or printed as PDF.",
          },
        },
        {
          "@type": "Question",
          name: "Does BhaiBiz support Malayalam (മലയാളം)?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. BhaiBiz has full native support for Malayalam (മലയാളം) as well as English. The entire app interface, labels, buttons, and navigation can be switched with one tap.",
          },
        },
      ],
    },
  ],
};

function Index() {
  const t = useT();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/15 selection:text-primary">
      {/* Schema.org Structured Data for Search Engines & AI Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph) }}
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 64 64"
                  className="h-6 w-6"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19 14 H35 C42 14 47 18 47 24 C47 28.5 43.5 32 38.5 33 C44.5 34.5 48 39 48 44.5 C48 51 42 55 35 55 H19 Z" fill="#ffffff" />
                  <path d="M27 21 H34 C37.5 21 40 22.8 40 25.5 C40 28.2 37.5 30 34 30 H27 Z" fill="#0d5f47" />
                  <path d="M27 38 H35 C38.5 38 41 40 41 43 C41 46 38.5 48 35 48 H27 Z" fill="#0d5f47" />
                  <circle cx="48" cy="48" r="9" fill="#f59e0b" />
                  <path d="M45 48 L47.5 50.5 L51.5 45.5" stroke="#043828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="font-[family-name:var(--font-display)] text-xl font-bold leading-none tracking-tight text-foreground">
                  BhaiBiz
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Kerala & India
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              {t("Features")}
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              {t("How it works")}
            </a>
            <a href="#accommodations" className="transition-colors hover:text-foreground">
              {t("Camp management")}
            </a>
            <a href="#security" className="transition-colors hover:text-foreground">
              {t("Security & Aadhaar")}
            </a>
            <a href="#comparison" className="transition-colors hover:text-foreground">
              {t("Comparison")}
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              {t("FAQ")}
            </a>
          </nav>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelect className="h-9 text-xs" />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">{t("Sign in")}</Link>
            </Button>
            <Button asChild size="sm" className="shadow-sm">
              <Link to="/auth">{t("Start free")}</Link>
            </Button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Collapse */}
        {mobileMenuOpen && (
          <div className="border-b border-border bg-card px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-3 text-sm font-medium">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                {t("Features")}
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                {t("How it works")}
              </a>
              <a
                href="#accommodations"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                {t("Camp management")}
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                {t("Security & Aadhaar")}
              </a>
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                {t("Comparison")}
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                {t("FAQ")}
              </a>
              <div className="mt-2 pt-2 border-t border-border flex justify-between items-center">
                <Link to="/auth" className="text-sm font-semibold text-primary">
                  {t("Sign in to your account")} →
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(13,95,71,0.12),transparent)]" />
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-secondary/80 px-3.5 py-1 text-xs font-semibold text-secondary-foreground shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
              <span>{t("Trusted by Labour Contractors Across Kerala & India")}</span>
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {t("Who worked today, what's due, who still owes.")}{" "}
              <span className="block text-primary">
                {t("Tracked in two taps.")}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(
                "The complete commission ledger and workforce management app for labour suppliers. Mark daily attendance in seconds, auto-calculate commission dues, generate instant WhatsApp receipts, secure Aadhaar cards with bank-grade encryption, and manage worker camps without losing a single rupee."
              )}
            </p>

            {/* Primary CTAs */}
            <div className="mt-8 flex flex-wrap justify-center items-center gap-3 sm:gap-4">
              <Button asChild size="lg" className="h-12 px-6 text-base font-semibold shadow-md">
                <Link to="/auth">
                  {t("Start free in 60 seconds")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
                <a href="#how-it-works">{t("See how it works")}</a>
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap justify-center items-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t("AES-256 Encrypted Aadhaar Vault")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t("Instant WhatsApp & Thermal Receipts")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t("5 Exportable Financial & Attendance Reports")}
              </span>
            </div>
          </div>
        </section>

        {/* Stats & Trust Bar */}
        <section className="border-y border-border bg-card/60 py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8 text-center">
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-primary sm:text-4xl">
                  ₹0
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Zero Lost Commission")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80 hidden sm:block">
                  Auto-calculated with FIFO balances
                </p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-foreground sm:text-4xl">
                  2 Taps
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Two-Tap Attendance")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80 hidden sm:block">
                  Individual or bulk squad marking
                </p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-primary sm:text-4xl">
                  100%
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Bank-Grade Security")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80 hidden sm:block">
                  AES-256 encrypted Aadhaar vault
                </p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-foreground sm:text-4xl">
                  5
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("5 Exportable Reports")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80 hidden sm:block">
                  One-click Excel & print downloads
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features Deep Dive */}
        <section id="features" className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="text-primary border-primary/30">
                {t("Features")}
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("All the latest features built for modern labour supply")}
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                {t(
                  "From worksite attendance and camp quarters to encrypted Aadhaar storage and instant WhatsApp payment receipts, BhaiBiz is packed with purpose-built tools."
                )}
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1: Attendance */}
              <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarCheck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {t("Daily & Bulk Attendance Register")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(
                      "Mark shifts in two taps — Worked, Not worked, or Pending. Bulk mark entire worksites or squads in seconds. Real-time commission recalculation."
                    )}
                  </p>
                </div>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Effective-date commission rates (never alters history)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Complete correction audit with mandatory supervisor notes</span>
                  </li>
                </ul>
              </div>

              {/* Feature 2: Ledger & Dues */}
              <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {t("Automated Commission Ledger & Dues")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(
                      "FIFO (First-In, First-Out) ledger automatically clears oldest unpaid days first. Insert-only rate agreements ensure historical integrity."
                    )}
                  </p>
                </div>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Earned − Collections ± Adjustments = Net Due</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Separate advance loans vs. daily commission dues</span>
                  </li>
                </ul>
              </div>

              {/* Feature 3: Receipts */}
              <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {t("Instant WhatsApp & Thermal Receipts")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(
                      "Record Cash, UPI, and Bank collections. Issue professional numbered receipts ready for Bluetooth thermal printers and one-tap WhatsApp sharing."
                    )}
                  </p>
                </div>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Sequential receipt numbers (BB-2026-0001)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Thermal printer 58mm/80mm & WhatsApp layout</span>
                  </li>
                </ul>
              </div>

              {/* Feature 4: Aadhaar Vault */}
              <div id="security" className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {t("AES-256 Encrypted Aadhaar Vault")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(
                      "Bank-grade AES-GCM encryption with HMAC hashing. Staff only see masked digits (•••• •••• 1234); only verified owners can view full numbers."
                    )}
                  </p>
                </div>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Prevents duplicate registrations via HMAC hash</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Secure photo and card scan storage in private buckets</span>
                  </li>
                </ul>
              </div>

              {/* Feature 5: Camp Management */}
              <div id="accommodations" className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Home className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {t("Labour Camps & Accommodation Management")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(
                      "Track worker camps, rented houses, and rooms across locations. Monitor bed capacities, assign workers to rooms, and manage supervisors."
                    )}
                  </p>
                </div>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Real-time occupancy and room vacancy tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Assign specific operators to individual camps</span>
                  </li>
                </ul>
              </div>

              {/* Feature 6: Staff Accounts & Reports */}
              <div id="reports" className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {t("5 Exportable Financial & Attendance Reports")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(
                      "Net Outstanding Due, Daily Attendance Log, Commission Earned, Payment Receipts, and Advance Loans — with 1-click Excel download."
                    )}
                  </p>
                </div>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>1-click formatted Excel (.xlsx) file download</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>0-email staff accounts (Owner, Manager, Operator, Accountant)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-t border-border bg-muted/30 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <Badge variant="outline" className="text-primary border-primary/30">
                {t("How it works")}
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("How BhaiBiz works in 3 simple steps")}
              </h2>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                  1
                </span>
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  {t("1. Add Workers & Agreement Rates")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "Set daily commission rates with effective start dates. Upload photos and store encrypted Aadhaar records safely."
                  )}
                </p>
              </div>

              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                  2
                </span>
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  {t("2. Mark Attendance Daily in 2 Taps")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "Supervisors mark attendance individually or in bulk squads on mobile. BhaiBiz instantly works out earned commission."
                  )}
                </p>
              </div>

              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                  3
                </span>
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  {t("3. Collect Dues, Share Receipts & Export")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "Log payments, send WhatsApp receipts to workers, and export comprehensive audit-ready Excel reports anytime."
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Matrix Table */}
        <section id="comparison" className="py-20 lg:py-28 border-t border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="text-primary border-primary/30">
                {t("Comparison")}
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("Why labour contractors choose BhaiBiz")}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {t("Why BhaiBiz beats paper registers and spreadsheets")}
              </p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
                    <th className="p-4 sm:p-5">{t("Features")}</th>
                    <th className="p-4 sm:p-5 text-muted-foreground/80">{t("Paper Notebooks")}</th>
                    <th className="p-4 sm:p-5 text-muted-foreground/80">{t("Excel Spreadsheets")}</th>
                    <th className="p-4 sm:p-5 bg-primary/10 text-primary font-bold">BhaiBiz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Attendance Speed")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Slow, illegible, registers tear or get lost")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("Requires laptop, bulky on construction sites")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("2 taps per worker or 1-tap bulk squad marking on phone")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Commission Calculations")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Manual math errors, disputes with workers")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("Complex formulas break easily with rate changes")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("Instant calculation based on effective agreement dates")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Payment Receipts")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Messy paper slips, easily misplaced")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("No receipt generation mechanism")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("Instant WhatsApp & thermal Bluetooth receipts")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Worker Aadhaar Privacy")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Unsafe physical copies exposed to theft")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("Plain text spreadsheets risk serious compliance fines")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("Military-grade AES-256 vault; staff see only last 4 digits")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Camp & Room Tracking")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Disorganized handwritten lists")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("Disconnected sheets lead to double-booking")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("Built-in camp quarters, room capacities & operator assignments")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Staff Access Control")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Anyone can alter or tamper with pages")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("Difficult to enforce restricted roles on mobile")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("Owner, Manager, Operator & Accountant permissions with audit log")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-foreground">{t("Financial Reporting")}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground flex items-center gap-1.5">
                      <X className="h-4 w-4 text-destructive shrink-0" />
                      {t("Hours of tedious manual calculation at month end")}
                    </td>
                    <td className="p-4 sm:p-5 text-muted-foreground">
                      {t("Manual chart drawing, high formula maintenance")}
                    </td>
                    <td className="p-4 sm:p-5 bg-primary/5 font-semibold text-primary">
                      {t("5 one-click exportable Excel (.xlsx) and print-ready reports")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section id="faq" className="border-t border-border py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <Badge variant="outline" className="text-primary border-primary/30">
                {t("FAQ")}
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("Frequently Asked Questions")}
              </h2>
            </div>

            <div className="mt-12">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    What is BhaiBiz and who is it designed for?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    BhaiBiz is an all-in-one labour management app and commission ledger designed specifically for labour contractors, manpower agencies, construction subcontractors, and migrant worker camp managers in Kerala and India. It simplifies attendance marking, commission calculations, cash/UPI payment collection, camp accommodation tracking, and financial reporting.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    How does BhaiBiz calculate worker commission automatically?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    Whenever a supervisor marks a worker as "Worked" on a date, BhaiBiz identifies the commission rate agreement active for that date and automatically credits the commission ledger. Agreement rates carry effective start dates, which means modifying a rate never retroactively rewrites or alters previous earned days.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    Can field supervisors see workers' full 12-digit Aadhaar numbers?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    No. All Aadhaar numbers in BhaiBiz are encrypted using bank-grade AES-GCM 256-bit encryption with cryptographic HMAC hashing. Field staff and supervisors can only view masked numbers (e.g., •••• •••• 1234). Only the verified company owner has authorization to reveal the full number.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    Can I print receipts or share them on WhatsApp?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    Yes. When you record a payment (Cash, UPI, or Bank), BhaiBiz automatically generates a uniquely sequenced digital receipt (e.g. BB-2026-0001). You can share it to the worker or site owner directly via WhatsApp in one tap, or print it to any Bluetooth thermal printer or standard printer.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    How does BhaiBiz manage worker accommodations and camps?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    BhaiBiz includes dedicated accommodation management. You can record camps, rented quarters, and individual rooms, track total bed capacity, allocate workers to specific rooms, and assign site operators to monitor each accommodation.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-6">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    Do my field supervisors need email accounts to sign in?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    No. BhaiBiz provides zero-friction staff provisioning. Company owners can create accounts with a simple username and password on the spot. Supervisors do not need email addresses or email confirmation links to begin marking attendance.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-7">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    Can I export my attendance and financial records to Excel?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    Yes. BhaiBiz provides 5 real-time reports: Net Outstanding Due, Daily Attendance Log, Work Commission Earned, Payment Receipts Register, and Advance Loans & Repayments. All 5 can be downloaded as formatted Excel (.xlsx) files or printed directly to PDF at any time.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-8">
                  <AccordionTrigger className="text-left font-semibold text-foreground">
                    Does BhaiBiz support Malayalam (മലയാളം)?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    Yes! BhaiBiz is fully bilingual and provides complete native Malayalam (മലയാളം) language support alongside English. You can switch between Malayalam and English with a single tap in the navigation bar.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        {/* High-Conversion Final CTA */}
        <section className="relative overflow-hidden bg-primary py-16 sm:py-24 text-primary-foreground">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_120%,rgba(255,255,255,0.15),transparent)]" />
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              {t("Ready to run your labour supply business with confidence?")}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-primary-foreground/90 max-w-2xl mx-auto">
              {t("Join labour contractors across Kerala and India who trust BhaiBiz every day.")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-12 px-8 text-base font-bold shadow-lg"
              >
                <Link to="/auth">
                  {t("Start free in 60 seconds")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-primary-foreground/75">
              100% Free Trial • No Credit Card Required • Instant Setup
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12 text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                  B
                </span>
                <span className="font-[family-name:var(--font-display)] text-lg font-bold text-foreground">
                  BhaiBiz
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed">
                The smart daily attendance register and commission ledger for labour contractors, manpower agencies, and worker camp managers.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <LanguageSelect className="h-8 text-xs w-28" />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {t("Features")}
              </h3>
              <ul className="mt-3 space-y-2 text-xs">
                <li><a href="#features" className="hover:text-foreground">{t("Daily attendance")}</a></li>
                <li><a href="#features" className="hover:text-foreground">{t("Automatic Commission")}</a></li>
                <li><a href="#features" className="hover:text-foreground">{t("WhatsApp Receipts")}</a></li>
                <li><a href="#security" className="hover:text-foreground">{t("Encrypted Aadhaar")}</a></li>
                <li><a href="#accommodations" className="hover:text-foreground">{t("Camp Allocation")}</a></li>
                <li><a href="#reports" className="hover:text-foreground">{t("Excel Reports")}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Company & Security
              </h3>
              <ul className="mt-3 space-y-2 text-xs">
                <li><a href="#security" className="hover:text-foreground">AES-256 Vault</a></li>
                <li><a href="#security" className="hover:text-foreground">Row-Level Security</a></li>
                <li><a href="#comparison" className="hover:text-foreground">Why BhaiBiz</a></li>
                <li><a href="#faq" className="hover:text-foreground">FAQ & Knowledge Base</a></li>
                <li><a href="/llms.txt" className="hover:text-foreground">llms.txt (AI Search Spec)</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Get Started
              </h3>
              <ul className="mt-3 space-y-2 text-xs">
                <li><Link to="/auth" className="hover:text-foreground">{t("Sign in")}</Link></li>
                <li><Link to="/auth" className="hover:text-foreground">{t("Create account")}</Link></li>
                <li><a href="mailto:support@bhaibiz.com" className="hover:text-foreground">support@bhaibiz.com</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <p>© {new Date().getFullYear()} BhaiBiz. All rights reserved.</p>
            <p className="text-muted-foreground/80">
              Built with precision for labour contractors in Kerala & across India.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
