import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Route as IndexRoute } from "@/routes/index";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

describe("Landing Page (Index Route)", () => {
  it("defines search engine and AI agent friendly meta tags in Route.head", () => {
    const headFn = IndexRoute.options.head;
    expect(headFn).toBeDefined();

    const headData = (headFn as () => { meta: Array<{ name?: string; property?: string; content: string }>; links: Array<{ rel: string; href: string }> })();
    expect(headData.meta).toBeDefined();

    const titles = headData.meta.filter(
      (m: { title?: string; property?: string; content?: string }) =>
        m.title?.includes("BhaiBiz") || (m.property === "og:title" && m.content?.includes("BhaiBiz"))
    );
    expect(titles.length).toBeGreaterThanOrEqual(1);

    const descriptions = headData.meta.filter(
      (m: { name?: string; property?: string }) => m.name === "description" || m.property === "og:description"
    );
    expect(descriptions.length).toBeGreaterThanOrEqual(2);

    const keywords = headData.meta.find((m: { name?: string }) => m.name === "keywords") as
      | { name: string; content: string }
      | undefined;
    expect(keywords?.content).toContain("labour contractor");
    expect(keywords?.content).toContain("commission ledger");
    expect(keywords?.content).toContain("kerala");

    const canonical = headData.links.find((l: { rel: string }) => l.rel === "canonical");
    expect(canonical?.href).toBe("https://bhaibiz.com/");
  });

  it("renders the hero headline, value proposition, and primary CTAs", () => {
    const Component = IndexRoute.options.component!;
    render(<Component />);

    // Headline
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Who worked today, what's due, who still owes/i
    );

    // Call to action buttons
    const ctas = screen.getAllByRole("link", { name: /Start free/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Schema.org JSON-LD graph with WebApplication and FAQPage for AI and search bots", () => {
    const Component = IndexRoute.options.component!;
    const { container } = render(<Component />);
    const scriptTag = container.querySelector('script[type="application/ld+json"]');
    expect(scriptTag).not.toBeNull();

    const parsedJson = JSON.parse(scriptTag?.textContent || "{}");
    expect(parsedJson["@context"]).toBe("https://schema.org");
    expect(parsedJson["@graph"]).toBeDefined();

    interface SchemaItem {
      "@type": string;
      name?: string;
      featureList?: string[];
      mainEntity?: unknown[];
    }

    const webApp = (parsedJson["@graph"] as SchemaItem[]).find((item) => item["@type"] === "WebApplication");
    expect(webApp).toBeDefined();
    expect(webApp?.name).toBe("BhaiBiz");
    expect(webApp?.featureList?.length).toBeGreaterThanOrEqual(5);

    const faq = (parsedJson["@graph"] as SchemaItem[]).find((item) => item["@type"] === "FAQPage");
    expect(faq).toBeDefined();
    expect(faq?.mainEntity?.length).toBeGreaterThanOrEqual(5);
  });

  it("renders all key feature pillars including Aadhaar vault, camps, and WhatsApp receipts", () => {
    const Component = IndexRoute.options.component!;
    render(<Component />);

    // Features
    expect(screen.getAllByText(/Daily & Bulk Attendance Register/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Automated Commission Ledger & Dues/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Instant WhatsApp & Thermal Receipts/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AES-256 Encrypted Aadhaar Vault/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Labour Camps & Accommodation Management/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5 Exportable Financial & Attendance Reports/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the comparison table showing why BhaiBiz beats paper registers and spreadsheets", () => {
    const Component = IndexRoute.options.component!;
    render(<Component />);

    expect(screen.getByText(/Why labour contractors choose BhaiBiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Paper Notebooks/i)).toBeInTheDocument();
    expect(screen.getByText(/Excel Spreadsheets/i)).toBeInTheDocument();
  });

  it("renders the structured AI search summary block and FAQ accordion", () => {
    const Component = IndexRoute.options.component!;
    const { container } = render(<Component />);

    const aiSection = container.querySelector("#about-bhaibiz");
    expect(aiSection).not.toBeNull();
    expect(aiSection).toHaveTextContent(/About BhaiBiz/i);

    expect(screen.getByText(/Frequently Asked Questions/i)).toBeInTheDocument();
  });
});
