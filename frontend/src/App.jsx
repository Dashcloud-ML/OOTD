import React, { useState, useRef, useEffect } from "react";
import { requestOutfits } from "./api.js";

/* OOTD frontend — editorial ink-on-white with one violet accent.
   Outfit cards show a real photo when the backend finds one, and fall
   back to the signature color-swatch flat-lay when it doesn't. */

const T = {
  ink: "#191521",
  paper: "#FFFFFF",
  soft: "#F4F2F7",
  line: "#E4E0EA",
  violet: "#5B2EDD",
  violetSoft: "#EFE9FF",
  gray: "#726C7E",
};

const display = "'Didot', 'Bodoni MT', 'Playfair Display', Georgia, serif";
const body = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const OCCASIONS = ["First date 💘", "Job interview", "Wedding guest", "Casual day out", "Party 🎉", "College fest"];
const REFINE = ["Less formal", "Cheaper options", "Different colors", "Bolder look", "I don't own that"];

const ITEM_ICON = {
  top: "👕", shirt: "👔", tshirt: "👕", blouse: "👚", dress: "👗", jacket: "🧥",
  blazer: "🧥", coat: "🧥", sweater: "🧶", hoodie: "🧥", bottom: "👖", pants: "👖",
  jeans: "👖", trousers: "👖", skirt: "👗", shorts: "🩳", shoes: "👟", sneakers: "👟",
  boots: "🥾", heels: "👠", loafers: "🥿", accessory: "⌚", watch: "⌚", bag: "👜",
  belt: "🧵", scarf: "🧣", jewelry: "💍", sunglasses: "🕶️", hat: "🧢",
};
const iconFor = (type) => ITEM_ICON[(type || "").toLowerCase()] || "🧷";

function SwatchStrip({ items }) {
  return (
    <div style={{ display: "flex", height: 46, borderRadius: 10, overflow: "hidden", border: `1px solid ${T.line}` }}>
      {items.map((it, i) => (
        <div key={i} title={it.name} style={{ flex: 1, background: it.color_hex || "#ccc", position: "relative" }}>
          <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", fontSize: 13 }}>
            {iconFor(it.type)}
          </span>
        </div>
      ))}
    </div>
  );
}

function OutfitCard({ outfit, saved, onSave }) {
  return (
    <div style={{
      background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18,
      display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 10px rgba(25,21,33,0.05)",
      animation: "rise .35s ease both",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 21, lineHeight: 1.15 }}>{outfit.name}</div>
          <div style={{ fontSize: 12, color: T.gray, marginTop: 3, textTransform: "capitalize" }}>{outfit.budget}</div>
        </div>
        <button onClick={onSave} aria-label={saved ? "Remove from lookbook" : "Save to lookbook"} style={{
          border: `1px solid ${saved ? T.violet : T.line}`, background: saved ? T.violetSoft : T.paper,
          color: saved ? T.violet : T.ink, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontSize: 13,
        }}>
          {saved ? "♥ Saved" : "♡ Save"}
        </button>
      </div>

      {outfit.image ? (
        <figure style={{ margin: 0 }}>
          <img
            src={outfit.image.url}
            alt={outfit.image.alt}
            loading="lazy"
            style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 10, border: `1px solid ${T.line}` }}
          />
          <figcaption style={{ fontSize: 10.5, color: T.gray, marginTop: 4 }}>
            Photo: {outfit.image.credit} / Unsplash
          </figcaption>
        </figure>
      ) : (
        <SwatchStrip items={outfit.items} />
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        {outfit.items.map((it, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14 }}>
            <span style={{
              width: 14, height: 14, borderRadius: "50%", background: it.color_hex,
              border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0,
            }} />
            <span style={{ fontSize: 15 }}>{iconFor(it.type)}</span>
            <span>{it.name}</span>
          </li>
        ))}
      </ul>

      <div style={{ fontSize: 13.5, color: T.gray, lineHeight: 1.5, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
        <strong style={{ color: T.ink }}>Why it works · </strong>{outfit.why}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(outfit.tags || []).map((t, i) => (
          <span key={i} style={{
            fontSize: 11.5, padding: "3px 10px", borderRadius: 999,
            background: T.soft, color: T.ink, letterSpacing: 0.3,
          }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

const chipStyle = (active) => ({
  border: `1px solid ${active ? T.violet : T.line}`,
  background: active ? T.violet : T.paper,
  color: active ? "#fff" : T.ink,
  borderRadius: 999, padding: "8px 15px", cursor: "pointer", fontSize: 13.5, fontFamily: body,
});

export default function App() {
  const [view, setView] = useState("home"); // home | chat | lookbook
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
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, loading]);

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
      });
      setHistory(data.history || []);
      setChat((c) => [...c, { role: "ootd", text: data.reply, outfits: data.outfits, weatherUsed: data.weatherUsed }]);
    } catch (e) {
      setError(e.message || "The stylist couldn't process that. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (outfit) => {
    setSaved((s) => (s.some((o) => o.name === outfit.name)
      ? s.filter((o) => o.name !== outfit.name)
      : [...s, outfit]));
  };
  const isSaved = (o) => saved.some((x) => x.name === o.name);

  return (
    <div style={{ minHeight: "100vh", background: T.soft, color: T.ink, fontFamily: body }}>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes blink { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${T.violet}; outline-offset: 2px; }
      `}</style>

      <header style={{
        background: T.paper, borderBottom: `1px solid ${T.line}`, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5,
      }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: display, fontSize: 30, letterSpacing: 2 }}>OOTD</span>
          <span style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: T.gray }}>Outfit of the day</span>
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView(chat.length ? "chat" : "home")} style={chipStyle(view !== "lookbook")}>Stylist</button>
          <button onClick={() => setView("lookbook")} style={chipStyle(view === "lookbook")}>Lookbook {saved.length ? `(${saved.length})` : ""}</button>
        </nav>
      </header>

      {view === "home" && (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 20px 80px", textAlign: "center" }}>
          <h1 style={{ fontFamily: display, fontWeight: 400, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.08, margin: 0 }}>
            Never wonder<br /><em style={{ color: T.violet }}>what to wear</em> again.
          </h1>
          <p style={{ color: T.gray, fontSize: 16, margin: "18px auto 30px", maxWidth: 460, lineHeight: 1.6 }}>
            Tell OOTD where you're going. Get three complete outfits, each explained by your AI stylist.
          </p>

          <div style={{ display: "flex", gap: 8, maxWidth: 540, margin: "0 auto" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder='Try "I have a first date at a café tonight…"'
              style={{
                flex: 1, padding: "14px 18px", borderRadius: 999, border: `1px solid ${T.line}`,
                fontSize: 15, fontFamily: body, background: T.paper,
              }}
            />
            <button onClick={() => send(input)} style={{ ...chipStyle(true), padding: "14px 22px", fontSize: 15 }}>
              Style me
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", margin: "22px 0 34px" }}>
            {OCCASIONS.map((o) => (
              <button key={o} onClick={() => send(`I'm going to a ${o.replace(/[^\w\s]/g, "").trim().toLowerCase()}. What should I wear?`)} style={chipStyle(false)}>
                {o}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center" }}>
            {[["Style", gender, setGender, ["Men", "Women", "Neutral"]],
              ["Budget", budget, setBudget, ["Casual", "Mid-range", "Premium"]],
              ["Weather", weather, setWeather, ["Hot", "Mild", "Cold", "Rainy"]]].map(([label, val, set, opts]) => (
              <label key={label} style={{ fontSize: 12.5, color: T.gray, display: "flex", alignItems: "center", gap: 6 }}>
                {label}
                <select value={val} onChange={(e) => set(e.target.value)} style={{
                  border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 8px",
                  fontFamily: body, fontSize: 13, background: T.paper, color: T.ink,
                }}>
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label style={{ fontSize: 12.5, color: T.gray, display: "flex", alignItems: "center", gap: 6 }}>
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="for live weather"
                style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: body, fontSize: 13, width: 120 }}
              />
            </label>
          </div>

          <details style={{ maxWidth: 540, margin: "26px auto 0", textAlign: "left", background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px" }}>
            <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>👕 Wardrobe mode — style only what I own</summary>
            <textarea
              value={wardrobe}
              onChange={(e) => setWardrobe(e.target.value)}
              placeholder="e.g. blue denim jacket, white sneakers, black jeans, grey hoodie…"
              rows={3}
              style={{ width: "100%", marginTop: 10, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, fontFamily: body, fontSize: 14, boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 12, color: T.gray, margin: "6px 0 0" }}>When filled in, OOTD builds outfits only from these pieces.</p>
          </details>
        </main>
      )}

      {view === "chat" && (
        <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 150px" }}>
          {chat.map((m, i) =>
            m.role === "user" ? (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end", margin: "14px 0" }}>
                <div style={{ background: T.violet, color: "#fff", padding: "10px 16px", borderRadius: "18px 18px 4px 18px", maxWidth: "78%", fontSize: 14.5, lineHeight: 1.5 }}>
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} style={{ margin: "14px 0 26px" }}>
                <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: T.gray, marginBottom: 6 }}>
                  OOTD Stylist{m.weatherUsed ? ` · dressing for ${m.weatherUsed}` : ""}
                </div>
                <div style={{ fontSize: 15, marginBottom: 14, lineHeight: 1.5 }}>{m.text}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
                  {(m.outfits || []).map((o, j) => (
                    <OutfitCard key={j} outfit={o} saved={isSaved(o)} onSave={() => toggleSave(o)} />
                  ))}
                </div>
              </div>
            )
          )}

          {loading && (
            <div style={{ color: T.gray, fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
              <span>Your stylist is picking looks</span>
              {[0, 1, 2].map((d) => (
                <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: T.violet, animation: `blink 1s ${d * 0.2}s infinite` }} />
              ))}
            </div>
          )}
          {error && (
            <div style={{ background: "#FDECEC", border: "1px solid #F2C4C4", color: "#8C2B2B", borderRadius: 10, padding: "10px 14px", fontSize: 14 }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />

          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, background: T.paper,
            borderTop: `1px solid ${T.line}`, padding: "10px 16px 16px",
          }}>
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
                {REFINE.map((r) => (
                  <button key={r} onClick={() => send(r)} disabled={loading || !chat.length} style={{ ...chipStyle(false), whiteSpace: "nowrap", opacity: loading ? 0.5 : 1 }}>
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(input)}
                  placeholder="Refine the look or ask for a new occasion…"
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 999, border: `1px solid ${T.line}`, fontSize: 14.5, fontFamily: body }}
                />
                <button onClick={() => send(input)} disabled={loading} style={{ ...chipStyle(true), opacity: loading ? 0.6 : 1 }}>Send</button>
              </div>
            </div>
          </div>
        </main>
      )}

      {view === "lookbook" && (
        <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 16px 80px" }}>
          <h2 style={{ fontFamily: display, fontWeight: 400, fontSize: 32, margin: "0 0 6px" }}>My Lookbook</h2>
          <p style={{ color: T.gray, fontSize: 13.5, margin: "0 0 22px" }}>
            Saved this session. Next step in the plan: persist these with Supabase or Firebase.
          </p>
          {saved.length === 0 ? (
            <div style={{ background: T.paper, border: `1px dashed ${T.line}`, borderRadius: 16, padding: 40, textAlign: "center", color: T.gray }}>
              No saved looks yet. Ask the stylist for outfits, then tap ♡ Save on your favorites.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
              {saved.map((o, i) => (
                <OutfitCard key={i} outfit={o} saved onSave={() => toggleSave(o)} />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
