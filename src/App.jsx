import { useState, useCallback, useEffect } from "react";

// ─── STORAGE (localStorage for standalone app) ─────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem("ganna_wardrobe");
    return raw ? JSON.parse(raw) : { items: [], wishlist: [] };
  } catch { return { items: [], wishlist: [] }; }
}
function saveData(data) {
  try { localStorage.setItem("ganna_wardrobe", JSON.stringify(data)); } catch {}
}

const CATEGORIES = ["All","Tops","Bottoms","Dresses","Outerwear","Shoes","Bags","Accessories","Jewellery","Sportswear","Other"];
const SEASONS = ["All Seasons","Spring","Summer","Autumn","Winter","Vacation"];
const OCCASIONS = ["All","Work","Casual","Evening","Sport","Travel","Special"];

function tempFeel(c) {
  if (c <= 0)  return "Freezing";
  if (c <= 7)  return "Very cold";
  if (c <= 13) return "Cold";
  if (c <= 18) return "Cool";
  if (c <= 23) return "Mild";
  if (c <= 28) return "Warm";
  return "Hot";
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function analyseItem(dataUrl, mediaType) {
  const base64 = dataUrl.split(",")[1];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a luxury fashion expert. Analyse the clothing or accessory item in the photo.
Look carefully for brand logos, labels, hardware, stitching patterns to identify brand.
Return ONLY valid JSON, no markdown:
{
  "name": "item name",
  "brand": "brand name or null",
  "brandConfidence": "high/medium/low/unknown",
  "category": "Tops/Bottoms/Dresses/Outerwear/Shoes/Bags/Accessories/Jewellery/Sportswear/Other",
  "color": "primary color",
  "material": "material e.g. Cotton, Silk, Leather, Wool, Synthetic",
  "warmthLevel": "very warm/warm/medium/light/very light",
  "style": "Minimalist/Dramatic/Classic/Casual/Elegant/Streetwear/Bohemian",
  "occasion": ["Work","Evening","Casual","Sport","Travel","Special"],
  "season": ["Spring","Summer","Autumn","Winter","Vacation"],
  "description": "2 sentences on the item",
  "stylistTip": "one sharp styling tip",
  "careInstructions": "brief care note"
}`,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Analyse this item. JSON only." }
        ]
      }]
    })
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function generateOutfits(items, { occasion = "All", tempC = null } = {}) {
  const list = items.map((item, i) =>
    `${i}: ${item.name} (${item.category}, ${item.color}, ${item.style}${item.brand ? ", " + item.brand : ""}${item.material ? ", " + item.material : ""}${item.warmthLevel ? ", warmth: " + item.warmthLevel : ""})`
  ).join("\n");
  const tempNote = tempC !== null ? `Temperature: ${tempC}°C — ${tempFeel(tempC)}. Match items to weather.` : "";
  const occNote = occasion !== "All" ? `Occasion: ${occasion}.` : "Mix Work, Casual, Evening.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are a personal stylist. Create 3 outfits from this wardrobe.
Return ONLY a valid JSON array, no markdown:
[{
  "title": "outfit name",
  "occasion": "occasion",
  "vibe": "3-4 word vibe",
  "tempNote": "one sentence on fabric/temperature",
  "note": "2 sentences styling note",
  "ownedIndices": [0,1],
  "suggestions": [{"name":"item","hint":"color+material","emoji":"👢","shop":"store+price"}]
}]`,
      messages: [{ role: "user", content: `Wardrobe:\n${list}\n\n${tempNote}\n${occNote}\n\n3 outfits. JSON only.` }]
    })
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.find(b => b.type === "text")?.text || "[]";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap');

  :root {
    --bg:       #F7F4F0;
    --surface:  #FDFBF8;
    --card:     #FAF8F5;
    --border:   #E8E2DA;
    --border2:  #D4CCC0;
    --ink:      #2A2520;
    --muted:    #9A9088;
    --dim:      #C4BDB4;
    --accent:   #8B7355;
    --accent2:  #C4956A;
    --soft-red: #C4756A;
    --soft-blu: #6A8FA0;
    --tag-bg:   #EFE9E0;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    font-size: 13px;
    min-height: 100vh;
  }

  .root { display: flex; height: 100vh; overflow: hidden; }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 210px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-logo {
    padding: 28px 20px 20px;
    border-bottom: 1px solid var(--border);
  }

  .logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 38px;
    font-weight: 300;
    letter-spacing: 6px;
    color: var(--ink);
    line-height: 1;
  }

  .logo-sub {
    font-size: 9px;
    letter-spacing: 3px;
    color: var(--dim);
    text-transform: uppercase;
    margin-top: 4px;
  }

  .sidebar-count {
    padding: 12px 20px;
    font-size: 11px;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }

  .sidebar-count strong { color: var(--accent); font-weight: 500; }

  .nav-section { padding: 16px 10px 8px; }

  .nav-label {
    font-size: 8px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--dim);
    padding: 0 10px;
    margin-bottom: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 12px;
    color: var(--muted);
    border: 1px solid transparent;
    margin-bottom: 1px;
  }

  .nav-item:hover { background: var(--tag-bg); color: var(--ink); }

  .nav-item.active {
    background: var(--tag-bg);
    color: var(--accent);
    border-color: var(--border);
  }

  .nav-item .ni-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
  .nav-item .ni-badge { margin-left: auto; background: var(--border); color: var(--muted); font-size: 9px; padding: 1px 7px; border-radius: 10px; }
  .nav-item.active .ni-badge { background: rgba(139,115,85,0.15); color: var(--accent); }

  .sidebar-bottom { margin-top: auto; padding: 16px 20px; border-top: 1px solid var(--border); font-size: 9px; color: var(--dim); line-height: 1.8; }

  /* ── MAIN ── */
  .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: var(--bg); }

  .topbar {
    padding: 18px 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
  }

  .page-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 300;
    letter-spacing: 1px;
    flex: 1;
    color: var(--ink);
  }

  .search-wrap { position: relative; }
  .search-input {
    background: var(--tag-bg);
    border: 1px solid var(--border);
    color: var(--ink);
    padding: 8px 12px 8px 32px;
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    border-radius: 20px;
    outline: none;
    width: 200px;
    transition: border-color 0.15s;
  }
  .search-input:focus { border-color: var(--accent); }
  .search-input::placeholder { color: var(--dim); }
  .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--dim); font-size: 11px; }

  .content { padding: 24px 28px; flex: 1; }

  /* ── FILTERS ── */
  .filter-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }

  .chip {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 5px 14px;
    font-family: 'Jost', sans-serif;
    font-size: 10px;
    letter-spacing: 0.5px;
    cursor: pointer;
    border-radius: 20px;
    color: var(--muted);
    transition: all 0.15s;
    white-space: nowrap;
    font-weight: 400;
  }

  .chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
    font-weight: 500;
  }

  .chip:hover:not(.active) { border-color: var(--accent2); color: var(--ink); }
  .chip-sep { width: 1px; height: 18px; background: var(--border); margin: 0 2px; flex-shrink: 0; }

  /* ── WARDROBE ── */
  .wardrobe-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 12px; }

  .item-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .item-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 4px 20px rgba(42,37,32,0.08); }
  .item-card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

  .item-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; object-position: center top; display: block; }

  .item-card-body { padding: 10px 12px 6px; }
  .item-card-name { font-size: 12px; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
  .item-card-meta { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .item-card-tags { padding: 4px 12px 10px; display: flex; gap: 4px; flex-wrap: wrap; }
  .mini-tag { font-size: 8px; padding: 2px 7px; border-radius: 10px; letter-spacing: 0.3px; }
  .mini-tag.season { background: rgba(106,143,160,0.12); color: var(--soft-blu); }
  .mini-tag.occ { background: rgba(139,115,85,0.1); color: var(--accent); }

  .sel-check { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; background: var(--accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; }

  .del-btn { position: absolute; top: 8px; left: 8px; width: 20px; height: 20px; background: rgba(247,244,240,0.9); border: 1px solid var(--border); color: var(--muted); border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 9px; cursor: pointer; transition: all 0.15s; }
  .item-card:hover .del-btn { display: flex; }
  .del-btn:hover { background: var(--soft-red); border-color: var(--soft-red); color: white; }

  .add-card { background: transparent; border: 1px dashed var(--border2); border-radius: 8px; min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; color: var(--dim); font-size: 10px; letter-spacing: 1px; }
  .add-card:hover { border-color: var(--accent); color: var(--accent); }
  .add-card-plus { font-size: 24px; line-height: 1; }

  /* Category sections */
  .cat-section { margin-bottom: 36px; }
  .cat-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
  .cat-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; letter-spacing: 1px; }
  .cat-count { font-size: 10px; color: var(--muted); }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 20px;
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.5px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
    border: 1px solid transparent;
  }

  .btn.primary { background: var(--accent); color: white; border-color: var(--accent); }
  .btn.primary:hover { background: #7A6348; }
  .btn.ghost { background: transparent; border-color: var(--border2); color: var(--muted); }
  .btn.ghost:hover { color: var(--ink); border-color: var(--accent); }
  .btn.soft-red { background: transparent; border-color: rgba(196,117,106,0.3); color: var(--soft-red); }
  .btn.soft-red:hover { background: rgba(196,117,106,0.08); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-row { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

  /* ── LOADER ── */
  .loader { display: flex; align-items: center; gap: 10px; padding: 16px 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
  .dots span { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); margin: 0 2px; animation: blink 1s infinite; }
  .dots span:nth-child(2) { animation-delay: 0.15s; background: var(--accent2); }
  .dots span:nth-child(3) { animation-delay: 0.3s; background: var(--soft-blu); }
  @keyframes blink { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1.2);opacity:1} }

  /* ── ADD ITEM ── */
  .add-panel { max-width: 660px; }

  .upload-zone { border: 1px dashed var(--border2); border-radius: 10px; padding: 48px 32px; text-align: center; transition: all 0.2s; background: var(--card); }
  .upload-zone.drag { border-color: var(--accent); background: rgba(139,115,85,0.03); }
  .upload-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px; }
  .upload-sub { font-size: 11px; color: var(--muted); line-height: 1.8; margin-bottom: 24px; }
  .upload-btns { display: flex; gap: 10px; justify-content: center; }
  .upload-btn { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-family: 'Jost', sans-serif; font-size: 11px; font-weight: 500; border: 1px solid var(--border2); background: var(--surface); color: var(--ink); cursor: pointer; border-radius: 6px; transition: all 0.15s; overflow: hidden; }
  .upload-btn:hover { border-color: var(--accent); color: var(--accent); }
  .upload-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }

  .analysis-wrap { display: grid; grid-template-columns: 200px 1fr; gap: 20px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-top: 20px; }
  .analysis-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; object-position: center top; border-radius: 6px; border: 1px solid var(--border); }
  .analysis-name { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 300; margin-bottom: 8px; line-height: 1.1; }

  .brand-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(139,115,85,0.12); color: var(--accent); border: 1px solid rgba(139,115,85,0.2); font-size: 10px; font-weight: 500; letter-spacing: 0.5px; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; }

  .tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; }
  .tag { background: var(--tag-bg); padding: 3px 10px; font-size: 9px; letter-spacing: 0.5px; color: var(--muted); border-radius: 10px; border: 1px solid transparent; }
  .tag.mat { background: rgba(106,143,160,0.1); color: var(--soft-blu); }
  .tag.warm { background: rgba(196,149,106,0.12); color: var(--accent2); }
  .tag.season { background: rgba(139,115,85,0.08); color: var(--accent); }

  .analysis-desc { font-size: 11px; line-height: 1.8; color: var(--muted); margin: 10px 0; }
  .analysis-tip { font-size: 11px; line-height: 1.7; color: var(--ink); background: rgba(139,115,85,0.06); border-left: 2px solid var(--accent2); padding: 8px 12px; margin: 8px 0; border-radius: 0 6px 6px 0; }

  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0 10px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
  .field input, .field select { background: var(--tag-bg); border: 1px solid var(--border); color: var(--ink); padding: 7px 10px; font-family: 'Jost', sans-serif; font-size: 11px; border-radius: 6px; outline: none; transition: border-color 0.15s; }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  .field select option { background: var(--surface); }

  /* ── ERROR / NOTICE ── */
  .error-box { background: rgba(196,117,106,0.06); border: 1px solid rgba(196,117,106,0.2); border-radius: 6px; padding: 12px 16px; font-size: 11px; color: var(--soft-red); line-height: 1.7; margin: 12px 0; }
  .error-box strong { display: block; font-size: 12px; margin-bottom: 4px; }
  .notice { background: rgba(139,115,85,0.06); border: 1px solid rgba(139,115,85,0.15); border-radius: 6px; padding: 8px 14px; font-size: 10px; color: var(--accent); margin-bottom: 14px; }

  /* ── EMPTY ── */
  .empty { text-align: center; padding: 64px 20px; }
  .empty-title { font-family: 'Cormorant Garamond', serif; font-size: 48px; font-weight: 300; letter-spacing: 2px; color: var(--dim); margin-bottom: 10px; }
  .empty-text { font-size: 11px; color: var(--muted); line-height: 1.8; margin-bottom: 20px; }

  /* ── OUTFITS ── */
  .outfit-controls { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 20px; }
  .controls-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }

  .temp-row { display: flex; align-items: center; gap: 20px; margin-bottom: 14px; flex-wrap: wrap; }
  .temp-num { font-family: 'Cormorant Garamond', serif; font-size: 48px; font-weight: 300; line-height: 1; color: var(--ink); min-width: 100px; }
  .temp-num sub { font-size: 22px; color: var(--muted); }
  .temp-feel-text { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .temp-slider { flex: 1; min-width: 140px; appearance: none; height: 3px; background: linear-gradient(to right, var(--soft-blu), var(--accent), var(--soft-red)); border-radius: 2px; outline: none; cursor: pointer; }
  .temp-slider::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--ink); cursor: pointer; border: 2px solid var(--bg); box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
  .temp-marks { display: flex; justify-content: space-between; font-size: 9px; color: var(--dim); margin-top: 6px; }

  .toggle-row { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .toggle-btn { background: var(--tag-bg); border: 1px solid var(--border); padding: 6px 14px; font-family: 'Jost', sans-serif; font-size: 10px; color: var(--muted); cursor: pointer; border-radius: 20px; transition: all 0.15s; font-weight: 400; }
  .toggle-btn.on { background: var(--accent); border-color: var(--accent); color: white; font-weight: 500; }

  .unit-switch { display: flex; border: 1px solid var(--border); border-radius: 20px; overflow: hidden; }
  .unit-opt { background: none; border: none; padding: 6px 12px; font-family: 'Jost', sans-serif; font-size: 10px; cursor: pointer; color: var(--muted); transition: all 0.15s; }
  .unit-opt.active { background: var(--accent); color: white; }

  .occ-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }

  .generate-btn { width: 100%; padding: 14px; font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; letter-spacing: 4px; background: var(--ink); color: var(--bg); border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; margin: 16px 0; }
  .generate-btn:hover { background: #3D3530; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(42,37,32,0.15); }
  .generate-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }

  .outfit-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 16px; animation: fadeUp 0.4s ease forwards; opacity: 0; }
  .outfit-card:nth-child(1){animation-delay:.05s} .outfit-card:nth-child(2){animation-delay:.15s} .outfit-card:nth-child(3){animation-delay:.25s}
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  .outfit-head { padding: 14px 18px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .outfit-num { font-family: 'Cormorant Garamond', serif; font-size: 42px; font-weight: 300; color: var(--dim); line-height: 1; flex-shrink: 0; }
  .outfit-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; line-height: 1; }
  .outfit-occ { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
  .vibe-pill { background: var(--tag-bg); color: var(--accent); font-size: 10px; padding: 4px 14px; border-radius: 20px; border: 1px solid var(--border); margin-left: auto; white-space: nowrap; }

  .outfit-body { display: grid; grid-template-columns: 1fr 200px; }
  .outfit-photos { padding: 16px; display: flex; flex-wrap: wrap; gap: 10px; }
  .op-item { width: 84px; }
  .op-wrap { width: 84px; height: 100px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); position: relative; }
  .op-wrap img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
  .op-wrap.suggest { background: var(--tag-bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
  .op-emoji { font-size: 20px; }
  .op-hint { font-size: 7px; color: var(--muted); text-align: center; padding: 0 4px; line-height: 1.3; }
  .op-bar { position: absolute; bottom: 0; left: 0; right: 0; font-size: 7px; font-weight: 500; letter-spacing: 0.5px; text-align: center; padding: 3px; }
  .op-bar.own { background: rgba(139,115,85,0.9); color: white; }
  .op-bar.add { background: rgba(196,149,106,0.9); color: white; }
  .op-name { font-size: 9px; color: var(--muted); margin-top: 4px; text-align: center; line-height: 1.3; }

  .outfit-side { border-left: 1px solid var(--border); padding: 16px 14px; background: var(--surface); display: flex; flex-direction: column; gap: 12px; }
  .side-lbl { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: var(--dim); margin-bottom: 4px; }
  .temp-note-box { background: rgba(106,143,160,0.08); border: 1px solid rgba(106,143,160,0.15); border-radius: 4px; padding: 8px 10px; font-size: 10px; line-height: 1.6; color: var(--soft-blu); }
  .outfit-note { font-size: 10px; line-height: 1.7; color: var(--muted); }
  .outfit-side hr { border: none; border-top: 1px solid var(--border); }
  .shop-line { display: flex; gap: 8px; font-size: 10px; color: var(--muted); margin-bottom: 5px; line-height: 1.5; }
  .shop-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent2); margin-top: 5px; flex-shrink: 0; }
  .shop-line b { color: var(--ink); font-weight: 500; }

  /* ── WISHLIST ── */
  .wish-form { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
  .wish-form-title { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 300; letter-spacing: 1px; margin-bottom: 16px; }
  .wish-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .wish-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; }
  .wish-name { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
  .wish-meta { font-size: 10px; color: var(--muted); margin-bottom: 8px; }
  .wish-note { font-size: 10px; color: var(--muted); line-height: 1.6; border-left: 2px solid var(--border2); padding-left: 8px; }
  .wish-del { position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--dim); cursor: pointer; font-size: 12px; transition: color 0.15s; }
  .wish-del:hover { color: var(--soft-red); }

  /* ── PACKING ── */
  .pack-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .pack-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.15s; position: relative; }
  .pack-card:hover { border-color: var(--border2); }
  .pack-card.packed { opacity: 0.45; }
  .pack-card.packed::after { content: '✓ Packed'; position: absolute; inset: 0; background: rgba(139,115,85,0.12); display: flex; align-items: center; justify-content: center; font-family: 'Cormorant Garamond', serif; font-size: 16px; color: var(--accent); letter-spacing: 1px; }
  .pack-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; object-position: center top; display: block; }
  .pack-card-name { padding: 8px 10px; font-size: 11px; font-weight: 500; }

  /* ── STATS ── */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-bottom: 24px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .stat-num { font-family: 'Cormorant Garamond', serif; font-size: 40px; font-weight: 300; color: var(--accent); line-height: 1; }
  .stat-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; }
  .breakdown { display: flex; flex-direction: column; gap: 7px; }
  .br-row { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--muted); }
  .br-bar { flex: 1; height: 2px; background: var(--border); border-radius: 1px; overflow: hidden; }
  .br-fill { height: 100%; background: var(--accent2); border-radius: 1px; }
  .br-count { width: 20px; text-align: right; color: var(--ink); font-size: 10px; }

  /* ── MODAL ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(42,37,32,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s; backdrop-filter: blur(4px); }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(42,37,32,0.15); }
  .modal-head { padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .modal-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; }
  .modal-close { background: none; border: none; color: var(--muted); font-size: 16px; cursor: pointer; transition: color 0.15s; padding: 2px 6px; border-radius: 4px; }
  .modal-close:hover { color: var(--ink); background: var(--tag-bg); }
  .modal-body { display: grid; grid-template-columns: 180px 1fr; gap: 20px; padding: 20px 22px; }
  .modal-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
  .detail-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
  .detail-key { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--dim); width: 72px; flex-shrink: 0; padding-top: 1px; }
  .detail-val { font-size: 11px; color: var(--ink); line-height: 1.5; }

  @media (max-width: 700px) {
    .sidebar { display: none; }
    .analysis-wrap, .outfit-body, .modal-body { grid-template-columns: 1fr; }
    .outfit-side { border-left: none; border-top: 1px solid var(--border); }
  }
`;

function Loader({ text = "Processing" }) {
  return (
    <div className="loader">
      <div className="dots"><span/><span/><span/></div>
      {text}
    </div>
  );
}

function ItemDetail({ item, onClose, onDelete }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">{item.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <img src={item.dataUrl} alt={item.name} className="modal-img" />
          <div>
            {item.brand && <div className="detail-row"><span className="detail-key">Brand</span><span className="detail-val" style={{color:"var(--accent)",fontWeight:500}}>{item.brand}</span></div>}
            <div className="detail-row"><span className="detail-key">Category</span><span className="detail-val">{item.category}</span></div>
            <div className="detail-row"><span className="detail-key">Colour</span><span className="detail-val">{item.color}</span></div>
            <div className="detail-row"><span className="detail-key">Material</span><span className="detail-val">{item.material || "—"}</span></div>
            <div className="detail-row"><span className="detail-key">Warmth</span><span className="detail-val">{item.warmthLevel || "—"}</span></div>
            <div className="detail-row"><span className="detail-key">Season</span><span className="detail-val">{(item.season||[]).join(", ") || "—"}</span></div>
            <div className="detail-row"><span className="detail-key">Occasion</span><span className="detail-val">{(item.occasion||[]).join(", ") || "—"}</span></div>
            <div className="detail-row"><span className="detail-key">Care</span><span className="detail-val">{item.careInstructions || "—"}</span></div>
            {item.price && <div className="detail-row"><span className="detail-key">Price</span><span className="detail-val">£{item.price}</span></div>}
            {item.store && <div className="detail-row"><span className="detail-key">Store</span><span className="detail-val">{item.store}</span></div>}
            {item.notes && <div className="detail-row"><span className="detail-key">Notes</span><span className="detail-val" style={{color:"var(--muted)"}}>{item.notes}</span></div>}
            <div className="detail-row"><span className="detail-key">Added</span><span className="detail-val" style={{color:"var(--muted)"}}>{new Date(item.id).toLocaleDateString()}</span></div>
            {item.description && <p style={{fontSize:11,color:"var(--muted)",lineHeight:1.7,marginTop:10,borderTop:"1px solid var(--border)",paddingTop:10}}>{item.description}</p>}
            {item.stylistTip && <p style={{fontSize:11,background:"rgba(139,115,85,0.06)",borderLeft:"2px solid var(--accent2)",padding:"8px 10px",marginTop:8,lineHeight:1.6,color:"var(--ink)"}}>💡 {item.stylistTip}</p>}
            <div style={{marginTop:14}}>
              <button className="btn soft-red" onClick={() => { onDelete(item.id); onClose(); }}>Remove from wardrobe</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { id: "wardrobe", icon: "🗂", label: "Wardrobe" },
  { id: "add",      icon: "＋", label: "Add Item" },
  { id: "outfits",  icon: "✦", label: "My Looks" },
  { id: "wishlist", icon: "♡", label: "Wish List" },
  { id: "packing",  icon: "◻", label: "Pack a Trip" },
  { id: "stats",    icon: "↗", label: "Overview" },
];

export default function Ganna() {
  const [page, setPage] = useState("wardrobe");
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [catFilter, setCatFilter] = useState("All");
  const [seasonFilter, setSeasonFilter] = useState("All Seasons");
  const [occFilter, setOccFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyseError, setAnalyseError] = useState(null);
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const [notes, setNotes] = useState("");

  const [selected, setSelected] = useState([]);
  const [tempC, setTempC] = useState(16);
  const [tempEnabled, setTempEnabled] = useState(false);
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  const [occOutfit, setOccOutfit] = useState("All");
  const [outfits, setOutfits] = useState([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [outfitError, setOutfitError] = useState(null);

  const [wishName, setWishName] = useState("");
  const [wishCat, setWishCat] = useState("Tops");
  const [wishNote, setWishNote] = useState("");

  const [packSeason, setPackSeason] = useState("Vacation");
  const [packed, setPacked] = useState({});
  const [detailItem, setDetailItem] = useState(null);

  useEffect(() => {
    loadData().then(d => { setItems(d.items||[]); setWishlist(d.wishlist||[]); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (loaded) saveData({ items, wishlist });
  }, [items, wishlist, loaded]);

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith("image/")) return;
    const dataUrl = await toBase64(file);
    setPending({ dataUrl, mediaType: file.type });
    setAnalysis(null); setAnalyseError(null);
    setAnalysing(true); setPage("add");
    try { setAnalysis(await analyseItem(dataUrl, file.type)); }
    catch (e) { setAnalyseError(e.message); setAnalysis({ name: "New Item", category: "Other", color: "Unknown", style: "Classic", occasion: [], season: [], description: "", stylistTip: "", careInstructions: "" }); }
    setAnalysing(false);
  }, []);

  const handleDrop = useCallback((e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }, [handleFile]);

  const saveItem = () => {
    if (!pending || !analysis) return;
    setItems(prev => [...prev, { id: Date.now(), ...analysis, dataUrl: pending.dataUrl, price: price||null, store: store||null, notes: notes||null }]);
    setPending(null); setAnalysis(null); setAnalyseError(null);
    setPrice(""); setStore(""); setNotes("");
    setPage("wardrobe");
  };

  const deleteItem = (id) => { setItems(prev => prev.filter(i => i.id !== id)); setSelected(prev => prev.filter(x => x !== id)); };
  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleGenerate = async () => {
    const pool = selected.length >= 2 ? items.filter(i => selected.includes(i.id)) : items;
    if (pool.length < 2) return;
    setLoadingOutfits(true); setOutfits([]); setOutfitError(null);
    try {
      const raw = await generateOutfits(pool, { occasion: occOutfit, tempC: tempEnabled ? tempC : null });
      setOutfits(raw.map(o => ({ ...o, ownedItems: (o.ownedIndices||[]).map(idx => pool[idx]).filter(Boolean) })));
    } catch (e) { setOutfitError(e.message); }
    setLoadingOutfits(false);
  };

  const addWishItem = () => {
    if (!wishName.trim()) return;
    setWishlist(prev => [...prev, { id: Date.now(), name: wishName, category: wishCat, note: wishNote }]);
    setWishName(""); setWishNote("");
  };

  const filteredItems = items.filter(item => {
    if (catFilter !== "All" && item.category !== catFilter) return false;
    if (seasonFilter !== "All Seasons" && !(item.season||[]).includes(seasonFilter)) return false;
    if (occFilter !== "All" && !(item.occasion||[]).includes(occFilter)) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !(item.brand||"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byCategory = CATEGORIES.slice(1).reduce((acc, c) => {
    const ci = filteredItems.filter(i => i.category === c);
    if (ci.length) acc[c] = ci;
    return acc;
  }, {});

  const catCounts = CATEGORIES.slice(1).reduce((acc, c) => { acc[c] = items.filter(i => i.category === c).length; return acc; }, {});
  const maxCount = Math.max(...Object.values(catCounts), 1);
  const packItems = items.filter(i => packSeason === "All Seasons" || (i.season||[]).includes(packSeason));
  const displayTemp = useFahrenheit ? Math.round(tempC * 9/5 + 32) : tempC;
  const showCategoryView = catFilter === "All" && seasonFilter === "All Seasons" && occFilter === "All" && !search;

  if (!loaded) return (<><style>{STYLE}</style><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)"}}><Loader text="Loading your wardrobe" /></div></>);

  return (
    <>
      <style>{STYLE}</style>
      <div className="root">

        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo">GANNA</div>
            <div className="logo-sub">Personal Wardrobe</div>
          </div>
          <div className="sidebar-count">
            <strong>{items.length}</strong> pieces · <strong>{wishlist.length}</strong> wishes
          </div>
          <div className="nav-section">
            <div className="nav-label">Menu</div>
            {NAV.map(n => (
              <div key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
                <span className="ni-icon">{n.icon}</span>
                {n.label}
                {n.id==="wardrobe" && <span className="ni-badge">{items.length}</span>}
                {n.id==="wishlist" && wishlist.length > 0 && <span className="ni-badge">{wishlist.length}</span>}
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            Data saves automatically.<br/>
            Photos stored in-session.<br/>
            Deploy to keep forever.
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="page-title">{NAV.find(n=>n.id===page)?.label}</div>
            {page==="wardrobe" && <>
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
              </div>
              <button className="btn primary" onClick={()=>setPage("add")}>+ Add Item</button>
            </>}
          </div>

          <div className="content">

            {/* WARDROBE */}
            {page==="wardrobe" && (
              <div>
                <div className="filter-bar">
                  {CATEGORIES.map(c=><button key={c} className={`chip ${catFilter===c?"active":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
                  <div className="chip-sep"/>
                  {SEASONS.map(s=><button key={s} className={`chip ${seasonFilter===s?"active":""}`} onClick={()=>setSeasonFilter(s)}>{s}</button>)}
                  <div className="chip-sep"/>
                  {OCCASIONS.map(o=><button key={o} className={`chip ${occFilter===o?"active":""}`} onClick={()=>setOccFilter(o)}>{o}</button>)}
                </div>

                {selected.length>0 && <div className="notice">{selected.length} piece{selected.length>1?"s":""} selected — go to My Looks to generate outfits</div>}

                {items.length===0 ? (
                  <div className="empty">
                    <div className="empty-title">Empty wardrobe</div>
                    <div className="empty-text">Start adding your pieces.<br/>The AI will catalogue each one for you.</div>
                    <button className="btn primary" onClick={()=>setPage("add")}>Add first piece</button>
                  </div>
                ) : showCategoryView ? (
                  Object.entries(byCategory).map(([cat, catItems])=>(
                    <div key={cat} className="cat-section">
                      <div className="cat-header">
                        <div className="cat-title">{cat}</div>
                        <div className="cat-count">{catItems.length} piece{catItems.length!==1?"s":""}</div>
                      </div>
                      <div className="wardrobe-grid">
                        {catItems.map(item=>(
                          <div key={item.id} className={`item-card ${selected.includes(item.id)?"selected":""}`} onClick={()=>setDetailItem(item)}>
                            <img src={item.dataUrl} alt={item.name}/>
                            <button className="del-btn" onClick={e=>{e.stopPropagation();deleteItem(item.id);}}>✕</button>
                            {selected.includes(item.id)&&<div className="sel-check">✓</div>}
                            <div className="item-card-body">
                              <div className="item-card-name">{item.name}</div>
                              <div className="item-card-meta">{item.brand||item.color}{item.material?" · "+item.material:""}</div>
                            </div>
                            <div className="item-card-tags">
                              {(item.season||[]).slice(0,2).map(s=><span key={s} className="mini-tag season">{s}</span>)}
                              {(item.occasion||[]).slice(0,1).map(o=><span key={o} className="mini-tag occ">{o}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="wardrobe-grid">
                    {filteredItems.length===0 ? (
                      <div style={{gridColumn:"1/-1",padding:"40px",textAlign:"center",color:"var(--muted)",fontSize:11}}>No items match these filters.</div>
                    ) : filteredItems.map(item=>(
                      <div key={item.id} className={`item-card ${selected.includes(item.id)?"selected":""}`} onClick={()=>setDetailItem(item)}>
                        <img src={item.dataUrl} alt={item.name}/>
                        <button className="del-btn" onClick={e=>{e.stopPropagation();deleteItem(item.id);}}>✕</button>
                        {selected.includes(item.id)&&<div className="sel-check">✓</div>}
                        <div className="item-card-body">
                          <div className="item-card-name">{item.name}</div>
                          <div className="item-card-meta">{item.brand||item.color}{item.material?" · "+item.material:""}</div>
                        </div>
                        <div className="item-card-tags">
                          {(item.season||[]).slice(0,2).map(s=><span key={s} className="mini-tag season">{s}</span>)}
                          {(item.occasion||[]).slice(0,1).map(o=><span key={o} className="mini-tag occ">{o}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ADD ITEM */}
            {page==="add" && (
              <div className="add-panel">
                {!pending ? (
                  <div className={`upload-zone ${drag?"drag":""}`} onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}>
                    <div className="upload-title">Add a piece</div>
                    <div className="upload-sub">AI detects brand · material · warmth · care instructions<br/>Take a photo or choose from your library</div>
                    <div className="upload-btns">
                      <label className="upload-btn">📷 Take Photo<input type="file" accept="image/*" capture="environment" onChange={e=>handleFile(e.target.files[0])}/></label>
                      <label className="upload-btn">🖼 Photo Library<input type="file" accept="image/*" onChange={e=>handleFile(e.target.files[0])}/></label>
                    </div>
                  </div>
                ) : (
                  <div className="analysis-wrap">
                    <img src={pending.dataUrl} className="analysis-img" alt="Item"/>
                    <div>
                      {analysing && <Loader text="Analysing your piece…"/>}
                      {analyseError && <div className="error-box"><strong>Analysis failed</strong>{analyseError}</div>}
                      {!analysing && analysis && <>
                        <div className="analysis-name">{analysis.name}</div>
                        {analysis.brand && <div className="brand-pill">🏷 {analysis.brand} <span style={{fontSize:9,opacity:0.6}}>({analysis.brandConfidence})</span></div>}
                        <div className="tags">
                          <span className="tag">{analysis.category}</span>
                          <span className="tag">{analysis.color}</span>
                          <span className="tag">{analysis.style}</span>
                          {analysis.material&&<span className="tag mat">{analysis.material}</span>}
                          {analysis.warmthLevel&&<span className="tag warm">{analysis.warmthLevel}</span>}
                          {(analysis.season||[]).map(s=><span key={s} className="tag season">{s}</span>)}
                        </div>
                        {analysis.description&&<p className="analysis-desc">{analysis.description}</p>}
                        {analysis.stylistTip&&<p className="analysis-tip">💡 {analysis.stylistTip}</p>}
                        {analysis.careInstructions&&<p style={{fontSize:10,color:"var(--muted)",marginTop:6}}>🧺 {analysis.careInstructions}</p>}
                        <div className="field-row">
                          <div className="field"><label>Price (£)</label><input type="number" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)}/></div>
                          <div className="field"><label>Store</label><input type="text" placeholder="e.g. Zara, ASOS" value={store} onChange={e=>setStore(e.target.value)}/></div>
                        </div>
                        <div className="field" style={{marginBottom:14}}>
                          <label>Personal Notes</label>
                          <input type="text" placeholder="e.g. Gift, fits small, favourite for meetings" value={notes} onChange={e=>setNotes(e.target.value)}/>
                        </div>
                        <div className="btn-row">
                          <button className="btn primary" onClick={saveItem}>Save to wardrobe</button>
                          <button className="btn ghost" onClick={()=>{setPending(null);setAnalysis(null);setAnalyseError(null);}}>Cancel</button>
                        </div>
                      </>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OUTFITS */}
            {page==="outfits" && (
              <div>
                {items.length<2 ? (
                  <div className="empty">
                    <div className="empty-title">Not yet</div>
                    <div className="empty-text">Add at least 2 pieces to generate outfit combinations.</div>
                    <button className="btn primary" onClick={()=>setPage("add")}>Add pieces</button>
                  </div>
                ) : <>
                  <div className="outfit-controls">
                    <div className="controls-label">Settings</div>
                    <div className="toggle-row">
                      <button className={`toggle-btn ${tempEnabled?"on":""}`} onClick={()=>setTempEnabled(p=>!p)}>🌡 Temperature {tempEnabled?"on":"off"}</button>
                      {tempEnabled&&<div className="unit-switch"><button className={`unit-opt ${!useFahrenheit?"active":""}`} onClick={()=>setUseFahrenheit(false)}>°C</button><button className={`unit-opt ${useFahrenheit?"active":""}`} onClick={()=>setUseFahrenheit(true)}>°F</button></div>}
                    </div>
                    {tempEnabled&&<>
                      <div className="temp-row">
                        <div><div className="temp-num">{displayTemp}<sub>°{useFahrenheit?"F":"C"}</sub></div><div className="temp-feel-text">{tempFeel(tempC)}</div></div>
                        <div style={{flex:1}}>
                          <input type="range" min="-10" max="40" value={tempC} className="temp-slider" onChange={e=>setTempC(Number(e.target.value))}/>
                          <div className="temp-marks"><span>-10</span><span>0</span><span>10</span><span>20</span><span>30</span><span>40</span></div>
                        </div>
                      </div>
                    </>}
                    <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>Occasion</div>
                    <div className="occ-row">{OCCASIONS.map(o=><button key={o} className={`chip ${occOutfit===o?"active":""}`} onClick={()=>setOccOutfit(o)}>{o}</button>)}</div>
                  </div>

                  {selected.length>=2&&<div className="notice">Using {selected.length} selected pieces — deselect in Wardrobe to use all</div>}

                  <button className="generate-btn" onClick={handleGenerate} disabled={loadingOutfits}>
                    {loadingOutfits?"Styling…":"Generate My Looks"}
                  </button>

                  {loadingOutfits&&<Loader text="Building your looks…"/>}

                  {outfitError&&<div className="error-box"><strong>Could not generate</strong>{outfitError}<div style={{marginTop:10}}><button className="btn primary" onClick={handleGenerate}>Try again</button></div></div>}

                  {outfits.map((outfit,i)=>(
                    <div key={i} className="outfit-card">
                      <div className="outfit-head">
                        <div className="outfit-num">0{i+1}</div>
                        <div><div className="outfit-title">{outfit.title}</div><div className="outfit-occ">{outfit.occasion}</div></div>
                        {outfit.vibe&&<div className="vibe-pill">{outfit.vibe}</div>}
                      </div>
                      <div className="outfit-body">
                        <div className="outfit-photos">
                          {(outfit.ownedItems||[]).map((item,j)=>(
                            <div key={j} className="op-item">
                              <div className="op-wrap"><img src={item.dataUrl} alt={item.name}/><div className="op-bar own">Owned</div></div>
                              <div className="op-name">{item.name}</div>
                            </div>
                          ))}
                          {(outfit.suggestions||[]).map((s,j)=>(
                            <div key={`s${j}`} className="op-item">
                              <div className="op-wrap suggest"><div className="op-emoji">{s.emoji}</div><div className="op-hint">{s.hint}</div><div className="op-bar add">Add</div></div>
                              <div className="op-name">{s.name}</div>
                            </div>
                          ))}
                        </div>
                        <div className="outfit-side">
                          {outfit.tempNote&&tempEnabled&&<div><div className="side-lbl">Weather</div><div className="temp-note-box">{outfit.tempNote}</div></div>}
                          <div><div className="side-lbl">Stylist note</div><div className="outfit-note">{outfit.note}</div></div>
                          {(outfit.suggestions||[]).length>0&&<><hr/><div><div className="side-lbl">Shop to complete</div>{outfit.suggestions.map((s,j)=><div key={j} className="shop-line"><div className="shop-dot"/><div><b>{s.name}</b> — {s.shop}</div></div>)}</div></>}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!loadingOutfits&&!outfitError&&outfits.length===0&&<div className="empty" style={{padding:"24px 0"}}><div className="empty-text">Configure above and hit Generate.</div></div>}
                </>}
              </div>
            )}

            {/* WISH LIST */}
            {page==="wishlist" && (
              <div>
                <div className="wish-form">
                  <div className="wish-form-title">Add to wish list</div>
                  <div className="field-row">
                    <div className="field"><label>Item</label><input type="text" placeholder="e.g. White linen trousers" value={wishName} onChange={e=>setWishName(e.target.value)}/></div>
                    <div className="field"><label>Category</label><select value={wishCat} onChange={e=>setWishCat(e.target.value)}>{CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}</select></div>
                  </div>
                  <div className="field" style={{marginBottom:14}}>
                    <label>Notes (brand, budget, where to find…)</label>
                    <input type="text" placeholder="e.g. Under £50, looking at Arket or COS" value={wishNote} onChange={e=>setWishNote(e.target.value)}/>
                  </div>
                  <button className="btn primary" onClick={addWishItem}>Add to list</button>
                </div>

                {wishlist.length===0 ? (
                  <div className="empty" style={{padding:"32px 0"}}>
                    <div className="empty-title">Empty</div>
                    <div className="empty-text">Add pieces you want to buy next.</div>
                  </div>
                ) : (
                  <div className="wish-grid">
                    {wishlist.map(item=>(
                      <div key={item.id} className="wish-card">
                        <div className="wish-name">{item.name}</div>
                        <div className="wish-meta">{item.category}</div>
                        {item.note&&<div className="wish-note">{item.note}</div>}
                        <button className="wish-del" onClick={()=>setWishlist(prev=>prev.filter(w=>w.id!==item.id))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PACKING */}
            {page==="packing" && (
              <div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:10}}>Filter by season</div>
                  <div className="filter-bar">{SEASONS.map(s=><button key={s} className={`chip ${packSeason===s?"active":""}`} onClick={()=>{setPackSeason(s);setPacked({});}}>{s}</button>)}</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:8}}>{packItems.length} suitable pieces — tap to mark as packed</div>
                </div>
                {packItems.length===0 ? (
                  <div className="empty" style={{padding:"32px 0"}}><div className="empty-text">No items tagged for this season yet.</div></div>
                ) : (
                  <div className="pack-grid">
                    {packItems.map(item=>(
                      <div key={item.id} className={`pack-card ${packed[item.id]?"packed":""}`} onClick={()=>setPacked(p=>({...p,[item.id]:!p[item.id]}))}>
                        <img src={item.dataUrl} alt={item.name}/>
                        <div className="pack-card-name">{item.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STATS */}
            {page==="stats" && (
              <div>
                <div className="stats-grid">
                  {[
                    {num:items.length, label:"Total Pieces"},
                    {num:Object.values(catCounts).filter(v=>v>0).length, label:"Categories"},
                    {num:items.filter(i=>i.brand).length, label:"Branded Items"},
                    {num:wishlist.length, label:"Wish List"},
                  ].map((s,i)=>(
                    <div key={i} className="stat-card"><div className="stat-num">{s.num}</div><div className="stat-label">{s.label}</div></div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div className="stat-card">
                    <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginBottom:14}}>By Category</div>
                    <div className="breakdown">
                      {Object.entries(catCounts).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([cat,count])=>(
                        <div key={cat} className="br-row">
                          <span style={{width:90,fontSize:10}}>{cat}</span>
                          <div className="br-bar"><div className="br-fill" style={{width:`${count/maxCount*100}%`}}/></div>
                          <span className="br-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginBottom:14}}>By Season</div>
                    <div className="breakdown">
                      {["Spring","Summer","Autumn","Winter","Vacation"].map(s=>{
                        const count=items.filter(i=>(i.season||[]).includes(s)).length;
                        return (
                          <div key={s} className="br-row">
                            <span style={{width:90,fontSize:10}}>{s}</span>
                            <div className="br-bar"><div className="br-fill" style={{width:`${count/Math.max(items.length,1)*100}%`,background:"var(--soft-blu)"}}/></div>
                            <span className="br-count">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {detailItem && <ItemDetail item={detailItem} onClose={()=>setDetailItem(null)} onDelete={id=>{deleteItem(id);setDetailItem(null);}}/>}
    </>
  );
}
