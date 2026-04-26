import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Work_Sans } from "next/font/google";
import { type ReactNode } from "react";

import { AuthPanel } from "@/components/auth-panel";
import { AppSessionProvider } from "@/components/session-provider";
import { SidebarTree } from "@/components/sidebar-tree";
import { getCategoryTreeData } from "@/lib/catalog";

import "@/app/globals.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

const uiFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-ui"
});

export const metadata: Metadata = {
  title: "BioCatalog",
  description: "A personal field guide for cataloging living organisms."
};

export const dynamic = "force-dynamic";

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const categoryTree = await getCategoryTreeData();

  return (
    <html className={`${displayFont.variable} ${uiFont.variable}`} lang="en">
      <body>
        <AppSessionProvider>
          <div className="app-frame">
            <aside className="sidebar">
              <Link className="brand" href="/">
                <span className="brand__kicker">Field archive</span>
                <strong>BioCatalog</strong>
              </Link>
              <p className="sidebar__intro">
                Catalog organisms, attach local images, and keep the taxonomy tree within reach while you work.
              </p>
              <div className="sidebar__actions">
                <Link className="button" href="/entries/new">
                  New entry
                </Link>
                <Link className="button button--ghost" href="/categories">
                  Browse categories
                </Link>
              </div>
              <AuthPanel />
              <section className="sidebar__section">
                <div className="sidebar__section-header">
                  <span className="eyebrow">Classification</span>
                  <Link href="/categories">Tree view</Link>
                </div>
                <SidebarTree tree={categoryTree} />
              </section>
            </aside>
            <main className="main-panel">{children}</main>
          </div>
        </AppSessionProvider>
      </body>
    </html>
  );
}