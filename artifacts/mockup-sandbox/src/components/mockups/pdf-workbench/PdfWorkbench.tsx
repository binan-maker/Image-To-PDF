import React, { useMemo, useState } from "react";
import "./PdfWorkbench.css";

type DocumentItem = {
  id: number;
  title: string;
  pages: number;
  size: string;
  date: string;
  tone: string;
};

const initialDocuments: DocumentItem[] = [
  { id: 1, title: "Q2 receipts", pages: 18, size: "4.8 MB", date: "Today, 09:42", tone: "coral" },
  { id: 2, title: "Apt lease — signed", pages: 6, size: "1.2 MB", date: "Yesterday", tone: "lavender" },
  { id: 3, title: "Field notes / June", pages: 24, size: "8.1 MB", date: "Jun 18", tone: "mint" },
  { id: 4, title: "Passport scans", pages: 4, size: "2.4 MB", date: "Jun 14", tone: "sand" },
];

export default function PdfWorkbench() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeTab, setActiveTab] = useState<"all" | "starred">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  const visibleDocs = useMemo(() => {
    const filtered = documents.filter((doc) => doc.title.toLowerCase().includes(query.toLowerCase()));
    return activeTab === "starred" ? filtered.slice(0, 2) : filtered;
  }, [activeTab, documents, query]);

  const toggleSelected = (title: string) => {
    setSelected((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
  };

  const createPdf = () => {
    setIsGenerating(true);
    setNotice("");
    window.setTimeout(() => {
      const newDoc: DocumentItem = {
        id: Date.now(),
        title: "Untitled scan",
        pages: selected.length || 3,
        size: "—",
        date: "Just now",
        tone: "blue",
      };
      setDocuments((current) => [newDoc, ...current]);
      setSelected([]);
      setIsGenerating(false);
      setShowComposer(false);
      setNotice("PDF saved to your library");
    }, 850);
  };

  return (
    <main className="workbench-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">↗</span><span>paper<span className="brand-red">/</span>press</span></div>
        <div className="topbar-center"><span className="status-dot" /> Private workspace <span className="topbar-slash">/</span> On device</div>
        <button className="avatar-button" aria-label="Open profile">AM</button>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">DOCUMENT WORKBENCH <span>01</span></p>
          <h1>Turn the pile<br /><em>into a file.</em></h1>
          <p className="lede">A quiet place for the pages that need to become official.</p>
        </div>
        <div className="intro-note"><span className="note-line" />Last export<br /><strong>Today at 09:42</strong></div>
      </section>

      <section className="action-grid">
        <button className="drop-card" onClick={() => setShowComposer(true)}>
          <span className="drop-kicker">START A NEW PDF</span>
          <span className="drop-title">Drop images here<br />or <u>choose from device</u></span>
          <span className="drop-footer"><span className="plus">+</span> JPG, PNG, HEIC <span>Up to 150 pages</span></span>
        </button>
        <div className="quick-card">
          <span className="drop-kicker">QUICK ACTIONS</span>
          <button onClick={() => { setShowComposer(true); setNotice("Choose images in the next step"); }}>＋ Scan with camera <span>→</span></button>
          <button onClick={() => setNotice("Your library is already stored offline")}>◌ Import from Files <span>→</span></button>
          <p className="quick-foot">No uploads. No accounts. No surprises.</p>
        </div>
      </section>

      <section className="library-head">
        <div>
          <p className="eyebrow">YOUR LIBRARY <span>{documents.length.toString().padStart(2, "0")}</span></p>
          <h2>Recent documents</h2>
        </div>
        <div className="library-tools">
          <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files" /></label>
          <div className="tabs"><button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>All files</button><button className={activeTab === "starred" ? "active" : ""} onClick={() => setActiveTab("starred")}>Starred</button></div>
        </div>
      </section>

      <section className="document-list" aria-label="Recent documents">
        {visibleDocs.map((doc, index) => (
          <button className={`document-row ${selected.includes(doc.title) ? "selected" : ""}`} key={doc.id} onClick={() => toggleSelected(doc.title)}>
            <span className={`file-preview ${doc.tone}`}><span>PDF</span><i>{String(doc.pages).padStart(2, "0")}</i></span>
            <span className="doc-copy"><strong>{doc.title}</strong><small>{doc.pages} pages <b>·</b> {doc.size}</small></span>
            <span className="doc-date">{doc.date}</span>
            <span className="row-number">0{index + 1}</span>
            <span className="row-check">{selected.includes(doc.title) ? "✓" : "＋"}</span>
          </button>
        ))}
        {!visibleDocs.length && <div className="empty-state">No files match “{query}”. <button onClick={() => setQuery("")}>Clear search</button></div>}
      </section>

      <footer className="bottom-note"><span>LOCAL-FIRST BY DESIGN</span><span className="footer-rule" /><span>All files stay on this device</span></footer>

      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<span>×</span></button>}

      {showComposer && <div className="composer-backdrop" onClick={() => !isGenerating && setShowComposer(false)}>
        <section className="composer" onClick={(event) => event.stopPropagation()}>
          <button className="close-composer" onClick={() => setShowComposer(false)}>×</button>
          <p className="eyebrow">NEW DOCUMENT</p>
          <h2>Assemble your pages.</h2>
          <p className="composer-copy">Choose images from your device, then arrange them before export.</p>
          <div className="composer-drop" onClick={() => toggleSelected("Untitled scan")}><span className="composer-icon">＋</span><strong>{selected.length ? `${selected.length} page${selected.length === 1 ? "" : "s"} ready` : "Choose images"}</strong><small>Tap to add a page placeholder</small></div>
          <div className="composer-actions"><button className="text-button" onClick={() => setShowComposer(false)}>Cancel</button><button className="primary-button" disabled={isGenerating} onClick={createPdf}>{isGenerating ? "Building…" : "Generate PDF  →"}</button></div>
        </section>
      </div>}
    </main>
  );
}