import React, { useState, useRef, useEffect } from "react";
import {
  requestOutfits, fetchLookbook, saveToLookbook, removeFromLookbook, fetchWardrobe, saveWardrobe,
} from "./api.js";

/* ─── OOTD — visual direction ───
   The fitting room, not a template: Fraunces serif with fashion character,
   a fill-in-the-blank hero ("I'm going to ______") because that IS the
   stylist's question, and outfit cards as numbered lookbook plates with a
   stitched note from the stylist. Ink on muslin, one violet, plenty of air. */

const PALETTES = {
  light: {
    ink: "#1C1826", paper: "#FFFFFF", soft: "#F2F0EC", line: "#E3E0D9",
    violet: "#5B2EDD", violetSoft: "#EFE9FF", gray: "#77716A",
  },
  dark: {
    ink: "#F1EEF7", paper: "#1F1B28", soft: "#141118", line: "#373047",
    violet: "#A88BFF", violetSoft: "#332A52", gray: "#A79FBB",
  },
};

// Components reference colors through CSS variables set on the app root,
// so the whole UI re-themes when the dark toggle flips.
const T = {
  ink: "var(--ink)", paper: "var(--paper)", soft: "var(--soft)", line: "var(--line)",
  violet: "var(--violet)", violetSoft: "var(--violetSoft)", gray: "var(--gray)",
};

const display = "'Bodoni Moda', 'Didot', 'Bodoni MT', Georgia, serif";
const body = "'Outfit', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const OCCASIONS = ["First date", "Job interview", "Wedding guest", "Casual day out", "Party", "College fest"];
const REFINE = ["Less formal", "Cheaper options", "Different colors", "Bolder look", "I don't own that"];

const ITEM_ICON = {
  top: "👕", shirt: "👔", tshirt: "👕", blouse: "👚", dress: "👗", jacket: "🧥",
  blazer: "🧥", coat: "🧥", sweater: "🧶", hoodie: "🧥", bottom: "👖", pants: "👖",
  jeans: "👖", trousers: "👖", skirt: "👗", shorts: "🩳", shoes: "👟", sneakers: "👟",
  boots: "🥾", heels: "👠", loafers: "🥿", accessory: "⌚", watch: "⌚", bag: "👜",
  belt: "🧵", scarf: "🧣", jewelry: "💍", sunglasses: "🕶️", hat: "🧢",
};
const iconFor = (type) => ITEM_ICON[(type || "").toLowerCase()] || "🧷";

// Shopping search links per item. Level 2 later: append your affiliate tag
// (e.g. &tag=yourid-21 for Amazon Associates).
const SHOPS = [
  { label: "Amazon", url: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
  { label: "Myntra", url: (q) => `https://www.myntra.com/${encodeURIComponent(q)}` },
  { label: "Flipkart", url: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}` },
];

// Downscale + JPEG-compress the user's photo in the browser so uploads stay small.
async function fileToDataUrl(file, maxSide = 768) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Defined at module level (not inside App) so React keeps them mounted across
// re-renders — defining components inside a component remounts them on every
// keystroke, which makes inputs lose focus while typing.
function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, textAlign: "left" }}>
      <span className="eyebrow">{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: T.gray }}>{hint}</span>}
    </label>
  );
}

function PhotoControl({ photo, onPick, onRemove, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {photo ? (
        <>
          <img src={photo} alt="Your photo" style={{ width: compact ? 28 : 40, height: compact ? 28 : 40, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.line}` }} />
          {!compact && <span style={{ fontSize: 12.5, color: T.gray }}>Styling for your photo</span>}
          <button className="chip" onClick={onRemove} aria-label="Remove photo">✕{compact ? "" : " Remove"}</button>
        </>
      ) : (
        <button className="chip" onClick={onPick}>
          📸 {compact ? "Add photo" : "Add a photo of yourself"}
        </button>
      )}
    </div>
  );
}

function SwatchStrip({ items }) {
  return (
    <div style={{ display: "flex", height: 52, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line}` }}>
      {items.map((it, i) => (
        <div key={i} title={it.name} style={{ flex: 1, background: it.color_hex || "#ccc", position: "relative" }}>
          <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 13 }}>
            {iconFor(it.type)}
          </span>
        </div>
      ))}
    </div>
  );
}

function OutfitCard({ outfit, index, saved, onSave }) {
  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="eyebrow" style={{ color: T.violet }}>
          Look {String((index ?? 0) + 1).padStart(2, "0")}
        </span>
        <span className="eyebrow">{outfit.budget}</span>
      </header>

      <h3 style={{ fontFamily: display, fontWeight: 500, fontStyle: "italic", fontSize: 23, lineHeight: 1.15, margin: 0 }}>
        {outfit.name}
      </h3>

      {outfit.image ? (
        <figure style={{ margin: 0 }}>
          <img
            src={outfit.image.url}
            alt={outfit.image.alt}
            loading="lazy"
            style={{ width: "100%", height: 230, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }}
          />
          <figcaption style={{ fontSize: 10.5, color: T.gray, marginTop: 5 }}>
            Photo: {outfit.image.credit} / Unsplash
          </figcaption>
        </figure>
      ) : (
        <SwatchStrip items={outfit.items} />
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {outfit.items.map((it, i) => (
          <li key={i} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{
                width: 13, height: 13, borderRadius: "50%", background: it.color_hex,
                border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0,
              }} />
              <span style={{ fontSize: 15, flexShrink: 0 }}>{iconFor(it.type)}</span>
              <span style={{ lineHeight: 1.45 }}>{it.name}</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", paddingLeft: 44 }}>
              {SHOPS.map((s) => (
                <a key={s.label} className="shop" href={s.url(it.name)} target="_blank" rel="noopener noreferrer"
                  title={`Search "${it.name}" on ${s.label}`}>
                  {s.label} ↗
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Stylist's note — pinned to the look with a stitched divider */}
      <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
        <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>Stylist's note</span>
        <p style={{ fontFamily: display, fontStyle: "italic", fontWeight: 400, fontSize: 14.5, lineHeight: 1.55, color: T.gray, margin: 0 }}>
          {outfit.why}
        </p>
      </div>

      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(outfit.tags || []).map((t, i) => (
            <span key={i} className="eyebrow" style={{ padding: "4px 9px", background: T.soft, borderRadius: 4 }}>{t}</span>
          ))}
        </div>
        <button className={saved ? "chip chip--on" : "chip"} onClick={onSave}
          aria-label={saved ? "Remove from lookbook" : "Save to lookbook"}>
          {saved ? "♥ Saved" : "♡ Save"}
        </button>
      </footer>
    </article>
  );
}

// A stable anonymous identity for this browser, so the Lookbook and wardrobe
// can sync to Supabase without requiring a login. Clearing site data or
// switching browsers starts a fresh identity — real accounts are a later upgrade.
function getUserId() {
  const KEY = "ootd_uid";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `uid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function App() {
  const [view, setView] = useState("home"); // home | chat | lookbook
  const [dark, setDark] = useState(false);
  const P = PALETTES[dark ? "dark" : "light"];
  const [gender, setGender] = useState("Neutral");
  const [budget, setBudget] = useState("Mid-range");
  const [weather, setWeather] = useState("Mild");
  const [city, setCity] = useState("");
  const [wardrobe, setWardrobe] = useState("");
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [history, setHistory] = useState([]); // API-shaped history, returned by the backend each turn
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState([]);
  const [photo, setPhoto] = useState(null); // data-URL of the user's photo (optional)
  const photoInputRef = useRef(null);
  const bottomRef = useRef(null);
  const userId = useRef(getUserId()).current;
  const [dbConfigured, setDbConfigured] = useState(null); // null = not checked yet, then true/false
  const [syncError, setSyncError] = useState(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, loading]);

  // Load any previously saved outfits and wardrobe once, on first mount.
  useEffect(() => {
    (async () => {
      try {
        const { items, configured } = await fetchLookbook(userId);
        setDbConfigured(configured);
        if (configured) setSaved(items.map((r) => ({ id: r.id, outfit: r.outfit })));
      } catch {
        setDbConfigured(false);
        setSyncError("Lookbook sync is offline right now — saves will only last this session.");
      }
    })();
    (async () => {
      try {
        const { wardrobe: w, configured } = await fetchWardrobe(userId);
        if (configured && w) setWardrobe(w);
      } catch {
        // Wardrobe sync is a quiet nice-to-have — fail silently, keep typing locally.
      }
    })();
  }, []);

  const onPhotoPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPhoto(await fileToDataUrl(file));
    } catch {
      setError("Couldn't read that image — try a different photo.");
    }
  };

  const send = async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setView("chat");
    setError(null);
    setInput("");
    setChat((c) => [...c, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const data = await requestOutfits({
        message: msg, gender, budget, weather, city: city.trim() || undefined,
        wardrobe: wardrobe.trim() || undefined, history,
        photo: photo || undefined, // sent each turn while attached, so refinements stay personalized
      });
      setHistory(data.history || []);
      setChat((c) => [...c, { role: "ootd", text: data.reply, outfits: data.outfits, weatherUsed: data.weatherUsed }]);
    } catch (e) {
      setError(e.message || "The stylist couldn't process that. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = async (outfit) => {
    const existing = saved.find((s) => s.outfit.name === outfit.name);
    if (existing) {
      setSaved((s) => s.filter((x) => x !== existing)); // optimistic
      if (existing.id) {
        try {
          await removeFromLookbook(userId, existing.id);
        } catch {
          setSyncError("Couldn't sync that removal — it may reappear next visit.");
        }
      }
    } else {
      const temp = { id: null, outfit };
      setSaved((s) => [...s, temp]); // optimistic
      try {
        const { item } = await saveToLookbook(userId, outfit);
        setSaved((s) => s.map((x) => (x === temp ? { id: item.id, outfit: item.outfit } : x)));
      } catch {
        setSyncError("Lookbook sync is offline — this save will only last this session.");
      }
    }
  };
  const isSaved = (o) => saved.some((s) => s.outfit.name === o.name);

  return (
    <div className="ootd" style={{
      minHeight: "100vh", background: T.soft, color: T.ink, fontFamily: body,
      colorScheme: dark ? "dark" : "light",
      transition: "background .25s ease, color .25s ease",
      "--ink": P.ink, "--paper": P.paper, "--soft": P.soft, "--line": P.line,
      "--violet": P.violet, "--violetSoft": P.violetSoft, "--gray": P.gray,
      "--onViolet": dark ? "#141118" : "#FFFFFF",
      "--shadow": dark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(28,24,38,0.06)",
      "--shadow-lift": dark ? "0 14px 30px rgba(0,0,0,0.45)" : "0 14px 30px rgba(28,24,38,0.12)",
    }}>
      <style>{`
        .ootd * { box-sizing: border-box; min-width: 0; }
        .ootd { overflow-x: clip; }
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes blink { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        .ootd .eyebrow { font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--gray); font-weight: 500; }
        .ootd .card {
          background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 20px;
          box-shadow: var(--shadow); animation: rise .4s ease both;
          transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
        }
        .ootd .card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lift); }
        .ootd .chip {
          font-family: inherit; font-size: 12px; letter-spacing: .04em; cursor: pointer;
          border: 1px solid var(--line); background: var(--paper); color: var(--ink);
          border-radius: 999px; padding: 7px 14px; transition: border-color .2s, color .2s, background .2s;
        }
        .ootd .chip:hover { border-color: var(--violet); color: var(--violet); }
        .ootd .chip--on { border-color: var(--violet); background: var(--violetSoft); color: var(--violet); }
        .ootd .chip:disabled { opacity: .5; cursor: default; }
        .ootd .navlink {
          font-family: inherit; font-size: 13px; background: none; border: none; cursor: pointer;
          color: var(--gray); padding: 6px 2px; border-bottom: 1px solid transparent; letter-spacing: .02em;
        }
        .ootd .navlink:hover { color: var(--ink); }
        .ootd .navlink--on { color: var(--ink); border-bottom-color: var(--ink); }
        .ootd .shop {
          font-size: 10px; letter-spacing: .06em; text-decoration: none; color: var(--gray);
          border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; background: var(--paper);
          transition: color .2s, border-color .2s;
        }
        .ootd .shop:hover { color: var(--violet); border-color: var(--violet); }
        .ootd .searchbar {
          display: flex; align-items: center; gap: 8px;
          background: var(--paper); border: 1px solid var(--line); border-radius: 14px;
          padding: 8px 8px 8px 20px; box-shadow: var(--shadow);
          transition: border-color .2s, box-shadow .2s;
        }
        .ootd .searchbar:focus-within { border-color: var(--violet); box-shadow: 0 0 0 3px var(--violetSoft); }
        .ootd .searchbar input {
          flex: 1; min-width: 0; border: none; background: transparent; padding: 12px 0;
          font-family: inherit; font-size: 15.5px; color: var(--ink); border-radius: 0;
        }
        .ootd .searchbar input:focus { outline: none; }
        .ootd .searchbar input::placeholder { color: var(--gray); opacity: .7; }
        .ootd .panel {
          background: var(--paper); border: 1px solid var(--line); border-radius: 14px;
          padding: 24px; box-shadow: var(--shadow);
        }
        .ootd .cta {
          font-family: inherit; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600;
          background: var(--ink); color: var(--soft); border: 1px solid var(--ink); border-radius: 999px;
          padding: 13px 24px; cursor: pointer; transition: background .2s, color .2s; white-space: nowrap;
        }
        .ootd .cta:hover { background: var(--violet); border-color: var(--violet); color: var(--onViolet); }
        .ootd .cta:disabled { opacity: .5; cursor: default; }
        .ootd select, .ootd input:not(.fill), .ootd textarea {
          font-family: inherit; font-size: 13px; color: var(--ink); background: var(--paper);
          border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
        }
        .ootd button:focus-visible, .ootd select:focus-visible, .ootd input:focus-visible,
        .ootd textarea:focus-visible, .ootd a:focus-visible, .ootd summary:focus-visible {
          outline: 2px solid var(--violet); outline-offset: 2px;
        }
        .ootd .scroller {
          display: flex; gap: 6px; align-items: center;
          overflow-x: auto; padding-bottom: 8px;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .ootd .scroller::-webkit-scrollbar { display: none; }
        .ootd .scroller > * { flex: 0 0 auto; }
        .ootd .scroller .chip { white-space: nowrap; }
        .ootd .mainnav { gap: 18px; }
        @media (max-width: 640px) {
          .ootd .tagline { display: none; }
          .ootd .masthead { padding: 13px 16px; }
          .ootd .mainnav { gap: 10px; }
          .ootd .navlink { font-size: 12.5px; }
          .ootd .card { padding: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ootd * { animation: none !important; transition: none !important; }
          .ootd .card:hover { transform: none; }
        }
      `}</style>

      {/* No "capture" attribute: mobile browsers show the native chooser
          (Take Photo / Photo Library), giving users both camera and gallery. */}
      <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoPicked} style={{ display: "none" }} />

      {/* Masthead */}
      <header className="masthead" style={{
        background: T.paper, borderBottom: `1px solid ${T.line}`, padding: "16px clamp(20px, 5vw, 48px)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "sticky", top: 0, zIndex: 5,
      }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: display, fontWeight: 600, fontSize: 25, letterSpacing: "0.12em" }}>OOTD</span>
          <span className="eyebrow tagline">Your AI stylist</span>
        </div>
        <nav className="mainnav" style={{ display: "flex", alignItems: "center" }}>
          <button className={view !== "lookbook" ? "navlink navlink--on" : "navlink"} onClick={() => setView(chat.length ? "chat" : "home")}>
            Stylist
          </button>
          <button className={view === "lookbook" ? "navlink navlink--on" : "navlink"} onClick={() => setView("lookbook")}>
            Lookbook{saved.length ? ` (${saved.length})` : ""}
          </button>
          <button className="chip" onClick={() => setDark((d) => !d)} style={{ padding: "6px 10px" }}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? "☀️" : "🌙"}
          </button>
        </nav>
      </header>

      {/* HOME */}
      {view === "home" && (
        <main style={{ maxWidth: 880, margin: "0 auto", padding: "clamp(40px, 8vh, 84px) clamp(20px, 5vw, 48px) 90px", textAlign: "center" }}>
          <p className="eyebrow" style={{ margin: "0 0 18px" }}>Personal styling, in seconds</p>
          <h1 style={{
            fontFamily: display, fontWeight: 470, fontSize: "clamp(40px, 7vw, 74px)",
            lineHeight: 1.02, letterSpacing: "-0.015em", margin: 0,
          }}>
            Never wonder<br />
            <em style={{ color: T.violet, fontWeight: 500 }}>what to wear</em> again.
          </h1>
          <p style={{ color: T.gray, fontSize: 15.5, margin: "22px auto 0", maxWidth: 480, lineHeight: 1.65 }}>
            Tell OOTD where you're going. It returns three complete looks — every piece chosen for the occasion, the weather, and you.
          </p>

          <div className="searchbar" style={{ maxWidth: 640, margin: "clamp(36px, 7vh, 56px) auto 0" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder={'Where are you going? Try "a first date at a café tonight"'}
              aria-label="Where are you going?"
            />
            <button className="cta" onClick={() => send(input)} disabled={loading} style={{ borderRadius: 10 }}>
              Style me
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "18px 0 0" }}>
            <span className="eyebrow">Popular</span>
            {OCCASIONS.map((o) => (
              <button key={o} className="chip" onClick={() => send(`I'm going to a ${o.toLowerCase()}. What should I wear?`)}>
                {o}
              </button>
            ))}
          </div>

          <section className="panel" style={{ maxWidth: 640, margin: "clamp(40px, 8vh, 64px) auto 0", textAlign: "left" }}>
            <p className="eyebrow" style={{ margin: "0 0 16px" }}>Preferences</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
              <Field label="Style">
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  {["Men", "Women", "Neutral"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Budget">
                <select value={budget} onChange={(e) => setBudget(e.target.value)}>
                  {["Casual", "Mid-range", "Premium"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Weather">
                <select value={weather} onChange={(e) => setWeather(e.target.value)}>
                  {["Hot", "Mild", "Cold", "Rainy"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>

            <hr style={{ border: 0, borderTop: `1px solid ${T.line}`, margin: "20px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, alignItems: "start" }}>
              <Field label="Live weather" hint="Enter your city and OOTD uses real weather instead of the Weather setting.">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" />
              </Field>
              <Field label="Your photo" hint="Used only to personalize — never stored.">
                <div style={{ paddingTop: 2 }}>
                  <PhotoControl photo={photo} onPick={() => photoInputRef.current?.click()} onRemove={() => setPhoto(null)} />
                </div>
              </Field>
            </div>

            <details style={{ marginTop: 20 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Wardrobe mode — style only what I own</summary>
              <textarea
                value={wardrobe}
                onChange={(e) => setWardrobe(e.target.value)}
                onBlur={() => saveWardrobe(userId, wardrobe).catch(() => {})}
                placeholder="e.g. blue denim jacket, white sneakers, black jeans, grey hoodie…"
                rows={3}
                style={{ width: "100%", marginTop: 10 }}
              />
              <p style={{ fontSize: 12, color: T.gray, margin: "6px 0 0" }}>When filled in, OOTD builds looks only from these pieces.</p>
            </details>
          </section>
        </main>
      )}

      {/* CHAT */}
      {view === "chat" && (
        <main style={{ maxWidth: 980, margin: "0 auto", padding: "26px clamp(16px, 4vw, 40px) 170px" }}>
          {chat.map((m, i) =>
            m.role === "user" ? (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end", margin: "18px 0" }}>
                <div style={{
                  background: T.violet, color: "var(--onViolet)", padding: "10px 16px",
                  borderRadius: "16px 16px 4px 16px", maxWidth: "78%", fontSize: 14, lineHeight: 1.55,
                }}>
                  {m.text}
                </div>
              </div>
            ) : (
              <section key={i} style={{ margin: "18px 0 34px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span className="eyebrow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    OOTD Stylist{m.weatherUsed ? ` · dressing for ${m.weatherUsed}` : ""}
                  </span>
                  <span style={{ flex: 1, minWidth: 24, height: 1, background: T.line }} />
                </div>
                <p style={{ fontFamily: display, fontStyle: "italic", fontWeight: 450, fontSize: 18, lineHeight: 1.5, margin: "0 0 18px", maxWidth: 640 }}>
                  {m.text}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 }}>
                  {(m.outfits || []).map((o, j) => (
                    <OutfitCard key={j} outfit={o} index={j} saved={isSaved(o)} onSave={() => toggleSave(o)} />
                  ))}
                </div>
              </section>
            )
          )}

          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontFamily: display, fontStyle: "italic", fontSize: 16, color: T.gray }}>
                Pulling looks from the rack
              </span>
              {[0, 1, 2].map((d) => (
                <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: T.violet, animation: `blink 1s ${d * 0.2}s infinite` }} />
              ))}
            </div>
          )}
          {error && (
            <div role="alert" style={{
              background: dark ? "#3A2026" : "#FBEBE9", border: `1px solid ${dark ? "#6E3440" : "#F0C7C1"}`,
              color: dark ? "#F2A9B4" : "#8C2B2B", borderRadius: 10, padding: "10px 14px", fontSize: 13.5,
            }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />

          {/* Composer */}
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0,
            background: T.paper, borderTop: `1px solid ${T.line}`,
            padding: "10px clamp(16px, 4vw, 40px) 16px",
          }}>
            <div style={{ maxWidth: 980, margin: "0 auto" }}>
              <div className="scroller">
                <PhotoControl compact photo={photo} onPick={() => photoInputRef.current?.click()} onRemove={() => setPhoto(null)} />
                {REFINE.map((r) => (
                  <button key={r} className="chip" onClick={() => send(r)} disabled={loading || !chat.length}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="searchbar" style={{ padding: "4px 4px 4px 16px" }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(input)}
                  placeholder="Refine a look, or name a new occasion…"
                  aria-label="Message the stylist"
                  style={{ padding: "10px 0" }}
                />
                <button className="cta" onClick={() => send(input)} disabled={loading} style={{ padding: "10px 18px", borderRadius: 10 }}>Send</button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* LOOKBOOK */}
      {view === "lookbook" && (
        <main style={{ maxWidth: 980, margin: "0 auto", padding: "44px clamp(16px, 4vw, 40px) 90px" }}>
          <p className="eyebrow" style={{ margin: "0 0 10px" }}>Your saved looks</p>
          <h2 style={{ fontFamily: display, fontWeight: 400, fontSize: 38, margin: "0 0 10px" }}>My Lookbook</h2>
          <p style={{ fontSize: 12.5, color: syncError ? (dark ? "#F2A9B4" : "#8C2B2B") : T.gray, margin: "0 0 26px" }}>
            {syncError
              ? syncError
              : dbConfigured === false
              ? "Connect Supabase in the backend to keep these across visits — see README."
              : "Synced — these will still be here next time you visit."}
          </p>
          {saved.length === 0 ? (
            <div style={{ background: T.paper, border: `1px dashed ${T.line}`, borderRadius: 10, padding: 48, textAlign: "center" }}>
              <p style={{ fontFamily: display, fontStyle: "italic", fontSize: 18, margin: "0 0 6px" }}>Nothing on the rack yet.</p>
              <p style={{ color: T.gray, fontSize: 13.5, margin: 0 }}>Ask the stylist for looks, then save the ones you'd wear.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 }}>
              {saved.map((s, i) => (
                <OutfitCard key={s.id ?? i} outfit={s.outfit} index={i} saved onSave={() => toggleSave(s.outfit)} />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}