import React, { useEffect, useState, useRef } from 'react';
import { fdb } from './firebase';
import './index.css';
import './kiosk.css';
import { Search, X, ArrowRight, ArrowLeft, CheckCircle2, Utensils, ShoppingBag } from 'lucide-react';

export default function Kiosk() {
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState({});
  const [stock, setStock] = useState({});
  const [cart, setCart] = useState({});
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [type, setType] = useState("Dine-in");
  const [cust, setCust] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState("menu"); // menu | review | done
  const [orderToken, setOrderToken] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [tbl, setTbl] = useState("");
  const [placing, setPlacing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [menuErr, setMenuErr] = useState(false);
  const orderRef = useRef(null);

  useEffect(() => {
    document.body.className = "kiosk-body";

    const u1 = fdb.doc("menu/main").onSnapshot(s => {
      if (s.exists) setMenu(s.data().items || []);
      setLoaded(true); setMenuErr(false);
    }, () => { setLoaded(true); setMenuErr(true); });
    const u2 = fdb.doc("settings/main").onSnapshot(s => {
      if (s.exists) setSettings(s.data() || {});
    });
    const u3 = fdb.collection("stock").onSnapshot(s => {
      const st = {};
      s.docs.forEach(d => st[d.id] = d.data());
      setStock(st);
    }, () => {});

    return () => { u1(); u2(); u3(); };
  }, []);

  // Privacy + real-kiosk hygiene: clear the screen for the next customer.
  useEffect(() => {
    const busy = step === "done" || step === "review" || Object.keys(cart).length > 0;
    if (!busy) return;
    const limit = step === "done" ? 20000 : 120000;
    const id = setTimeout(resetAll, limit);
    return () => clearTimeout(id);
  }, [step, cart, cust, phone, tbl, type]);

  const cats = ["All", ...new Set(menu.map(m => m.cat))];

  const calc = () => {
    let sub = 0;
    const lines = Object.keys(cart).map(id => {
      const m = menu.find(x => x.id == id);
      if (!m) return null;
      const amt = m.price * cart[id];
      sub += amt;
      return { name: m.name, qty: cart[id], price: m.price, amt, id: parseInt(id) };
    }).filter(Boolean);

    const gstPct = settings.gst || 0;
    const g = sub * gstPct / 100;
    const raw = sub + g;
    const tot = Math.round(raw);
    const ro = tot - raw;

    return { lines, sub, g, tot, ro };
  };

  const c = calc();
  const cartCount = c.lines.reduce((a, x) => a + x.qty, 0);

  const addItem = (m) => {
    const s = stock[m.id];
    const out = s && s.qty <= 0;
    if (out) return;
    if (s && (cart[m.id] || 0) >= s.qty) return;
    setCart({ ...cart, [m.id]: (cart[m.id] || 0) + 1 });
  };

  const removeOne = (id) => {
    const n = cart[id] - 1;
    if (n <= 0) {
      const nc = { ...cart }; delete nc[id]; setCart(nc);
    } else {
      setCart({ ...cart, [id]: n });
    }
  };

  const addOne = (id) => {
    const s = stock[id];
    if (s && cart[id] >= s.qty) return;
    setCart({ ...cart, [id]: cart[id] + 1 });
  };

  const placeOrder = async () => {
    if (!c.lines.length || placing) return;

    // Validate phone number (must be at least 10 digits)
    const sanitizedPhone = phone.replace(/\D/g, '');
    if (!cust.trim() || sanitizedPhone.length < 10) {
      alert("Please enter a valid 10-digit phone number and your name.");
      return;
    }

    setPlacing(true);
    const day = new Date().toLocaleDateString("en-CA");
    const o = {
      t: Date.now(),
      day,
      cust: cust.trim().slice(0, 60),
      phone: sanitizedPhone.slice(-10), // Store exactly 10 digits for WhatsApp
      tbl: type === "Dine-in" ? tbl.trim().slice(0, 10) : "",
      type,
      lines: c.lines,
      sub: c.sub,
      d: 0,
      g: c.g,
      ro: c.ro,
      tot: c.tot,
      gst: settings.gst || 0,
      status: "pending",
      token: ""
    };

    try {
      // Same order ref on retry so a slow first attempt can never create a duplicate.
      if (!orderRef.current) orderRef.current = fdb.collection("kiosk_orders").doc();
      const ref = orderRef.current;
      const cref = fdb.doc("kiosk_counter/" + day);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000));
      // Two customers ordering at the same instant fight over the counter; the loser just retries.
      const save = (async () => {
        let err;
        for (let i = 0; i < 6; i++) {
          try {
            await fdb.runTransaction(async t => {
              const cs = await t.get(cref);
              const n = cs.exists ? (cs.data().n || 0) + 1 : 1;
              o.token = String(n).padStart(3, "0");
              if (cs.exists) t.update(cref, { n }); else t.set(cref, { n });
              t.set(ref, o);
            });
            return;
          } catch (e) {
            err = e;
            await new Promise(r => setTimeout(r, 100 + Math.random() * 400));
          }
        }
        throw err;
      })();
      await Promise.race([save, timeout]);
      setOrderToken(o.token);
      setOrderTotal(c.tot);
      setStep("done");
    } catch (e) {
      alert("Could not place the order. Please check the internet and try again, or order at the counter.");
    }
    setPlacing(false);
  };

  const resetAll = () => {
    setCart({});
    setCust("");
    setPhone("");
    setType("Dine-in");
    setQ("");
    setCat("All");
    setStep("menu");
    setOrderToken("");
    setOrderTotal(0);
    setTbl("");
    orderRef.current = null;
  };

  // ── DONE SCREEN ──
  if (step === "done") {
    return (
      <div className="k-page">
        <div className="k-done-screen">
          <div className="k-done-icon"><CheckCircle2 size={48} /></div>
          <h2 className="k-done-title">Order Placed!</h2>
          <p className="k-done-sub">Your order has been sent to the kitchen</p>
          <div className="k-done-card">
            <div className="k-done-row">
              <span>Order Token</span>
              <b className="k-token">#{orderToken}</b>
            </div>
            <div className="k-done-row">
              <span>Name</span>
              <b>{cust}</b>
            </div>
            {phone && (
              <div className="k-done-row">
                <span>Phone</span>
                <b>{phone}</b>
              </div>
            )}
            {tbl && type === "Dine-in" && (
              <div className="k-done-row">
                <span>Table</span>
                <b>{tbl}</b>
              </div>
            )}
            <div className="k-done-row">
              <span>Type</span>
              <b>{type}</b>
            </div>
            <div className="k-done-divider"></div>
            <div className="k-done-row k-done-total">
              <span>Pay at Counter</span>
              <b>₹{orderTotal}</b>
            </div>
          </div>
          <button className="k-btn k-btn-primary k-done-btn" onClick={resetAll}>
            Done (clears in 20s)
          </button>
        </div>
      </div>
    );
  }

  // ── REVIEW / CHECKOUT SCREEN ──
  if (step === "review") {
    return (
      <div className="k-page">
        <div className="k-review-header">
          <button className="k-back-btn" onClick={() => setStep("menu")}>
            <ArrowLeft size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'4px'}}/> Back
          </button>
          <h2>Review Order</h2>
          <span>{cartCount} items</span>
        </div>

        <div className="k-review-body">
          {/* Order Type */}
          <div className="k-section">
            <label className="k-section-label">Order Type</label>
            <div className="k-type-toggle">
              <button className={`k-type-btn ${type === "Dine-in" ? "active" : ""}`} onClick={() => setType("Dine-in")}>
                <Utensils className="k-type-icon" size={28} strokeWidth={2.5} />
                <span>Dine-in</span>
              </button>
              <button className={`k-type-btn ${type === "Takeaway" ? "active" : ""}`} onClick={() => setType("Takeaway")}>
                <ShoppingBag className="k-type-icon" size={28} strokeWidth={2.5} />
                <span>Takeaway</span>
              </button>
            </div>
          </div>

          {/* Name & Phone */}
          <div className="k-section">
            <label className="k-section-label">Your Details</label>
            <div className="k-input-group">
              <input
                className="k-name-input"
                placeholder="Enter your name"
                value={cust}
                onChange={e => setCust(e.target.value)}
                autoFocus
              />
              {type === "Dine-in" && (
                <input
                  className="k-phone-input"
                  placeholder="Table number (optional)"
                  value={tbl}
                  maxLength={10}
                  onChange={e => setTbl(e.target.value)}
                />
              )}
              <input
                className="k-phone-input"
                placeholder="Enter your phone number"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Items */}
          <div className="k-section">
            <label className="k-section-label">Items ({cartCount})</label>
            <div className="k-items-list">
              {c.lines.map(l => (
                <div key={l.id} className="k-review-item">
                  <div className="k-review-item-info">
                    <b>{l.name}</b>
                    <small>₹{l.price} each</small>
                  </div>
                  <div className="k-review-item-actions">
                    <button className="k-qty-btn" onClick={() => removeOne(l.id)}>−</button>
                    <span className="k-qty-num">{l.qty}</span>
                    <button className="k-qty-btn" onClick={() => addOne(l.id)}>+</button>
                  </div>
                  <b className="k-review-item-price">₹{l.amt}</b>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="k-summary">
            <div className="k-summary-row"><span>Subtotal</span><span>₹{c.sub}</span></div>
            {(settings.gst || 0) > 0 && <div className="k-summary-row"><span>GST ({settings.gst}%)</span><span>₹{c.g.toFixed(2)}</span></div>}
            <div className="k-summary-row k-summary-total"><span>Total</span><span>₹{c.tot}</span></div>
          </div>
        </div>

        <div className="k-review-footer">
          <button
            className={`k-btn k-btn-primary k-place-btn ${(!cust.trim() || phone.replace(/\D/g, '').length < 10 || !c.lines.length) ? "disabled" : ""}`}
            onClick={placeOrder}
            disabled={placing || !cust.trim() || phone.replace(/\D/g, '').length < 10 || !c.lines.length}
          >
            {placing ? "Placing order…" : `Place Order — ₹${c.tot}`}
          </button>
          <small className="k-pay-note">No online payment · Pay at counter</small>
        </div>
      </div>
    );
  }

  // ── MENU SCREEN ──
  const filteredMenu = menu.filter(m =>
    m.on && (cat === "All" || m.cat === cat) && m.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="k-page">
      {/* Header */}
      <div className="k-header">
        <img src="/logo.png" alt="Logo" className="k-logo" />
        <div className="k-header-text">
          <h1>{settings.name || "2 Friends Cafe"}</h1>
          <small>Scan · Order · Pay at Counter</small>
        </div>
      </div>

      {/* Search */}
      <div className="k-search-wrap">
        <Search className="k-search-icon" size={18} />
        <input
          className="k-search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search menu..."
        />
        {q && <button className="k-search-clear" onClick={() => setQ("")}><X size={18} /></button>}
      </div>

      {/* Categories */}
      <div className="k-cats">
        {cats.map(catName => (
          <button
            key={catName}
            className={`k-cat ${catName === cat ? "active" : ""}`}
            onClick={() => setCat(catName)}
          >
            {catName}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="k-menu-grid">
        {filteredMenu.length === 0 && (
          <div className="k-empty">{!loaded ? "Loading menu…" : menuErr ? "Menu unavailable. Please order at the counter." : "No items found"}</div>
        )}
        {filteredMenu.map(m => {
          const s = stock[m.id];
          const out = s && s.qty <= 0;
          const inCart = cart[m.id] || 0;

          return (
            <div key={m.id} className={`k-menu-item ${out ? "out" : ""} ${inCart > 0 ? "in-cart" : ""}`}>
              <div className="k-menu-item-body" onClick={() => !out && addItem(m)}>
                <b className="k-item-name">{m.name}</b>
                <span className="k-item-price">₹{m.price}</span>
                {s && s.qty <= s.low && s.qty > 0 && <small className="k-item-low">Only {s.qty} left</small>}
                {out && <small className="k-item-out">Out of stock</small>}
              </div>
              {inCart > 0 && (
                <div className="k-item-qty-bar">
                  <button className="k-qty-btn" onClick={() => removeOne(m.id)}>−</button>
                  <span className="k-qty-num">{inCart}</span>
                  <button className="k-qty-btn" onClick={() => addOne(m.id)}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Cart Bar */}
      {cartCount > 0 && (
        <div className="k-cart-bar" onClick={() => setStep("review")}>
          <div className="k-cart-bar-left">
            <span className="k-cart-badge">{cartCount}</span>
            <span>{cartCount === 1 ? "item" : "items"} added</span>
          </div>
          <div className="k-cart-bar-right">
            <b>₹{c.tot}</b>
            <span className="k-cart-arrow"><ArrowRight size={20} /></span>
          </div>
        </div>
      )}
    </div>
  );
}
