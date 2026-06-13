import { useState, useRef, useEffect } from "react";

// ============ THEME ============
const C = {
  // Base — deep tactical board feel, not just "green pitch"
  bg: "#080c10",
  surface: "#0e1419",
  surface2: "#141c24",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",

  // Primary — chalk white
  chalk: "#f0ece0",
  chalkDim: "rgba(240,236,224,0.5)",
  chalkFaint: "rgba(240,236,224,0.2)",

  // Accents
  gold: "#e8b84b",
  goldDim: "rgba(232,184,75,0.12)",
  goldLine: "rgba(232,184,75,0.3)",

  // Status
  green: "#3d9970",
  greenDim: "rgba(61,153,112,0.15)",
  red: "#e74c3c",
  redDim: "rgba(231,76,60,0.12)",

  // Phase colours
  possess: "#3d9970",   // in possession
  defend: "#e74c3c",    // out of possession
  transit: "#e8b84b",   // transition
  rondo: "#5b8dee",     // rondos
  build: "#9b59b6",     // build up

  // Legacy compat
  pitch: "#080c10",
  pitchDeep: "#0e1419",
  grass: "#3d9970",
  grassLight: "#52b585",
  laterite: "#e74c3c",
  line: "rgba(255,255,255,0.08)",
};

const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Mukta:wght@400;500;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; background: ${C.bg}; }
    .display { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; }
    .body { font-family: 'Inter', 'Mukta', sans-serif; }
    .mono { font-family: 'Space Grotesk', monospace; }

    @keyframes chalkIn { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%,100% { opacity:.3; transform:scale(.85); } 50% { opacity:1; transform:scale(1.15); } }

    .fade-up { animation: fadeUp 0.25s ease both; }
    .chalk-line { animation: chalkIn 1s ease both; }

    ::-webkit-scrollbar { width: 2px; }
    ::-webkit-scrollbar-thumb { background: ${C.borderStrong}; border-radius: 2px; }

    button:focus-visible, textarea:focus-visible, select:focus-visible, input:focus-visible {
      outline: 2px solid ${C.gold}; outline-offset: 2px;
    }

    /* Phase pill variants */
    .phase-possess { background: rgba(61,153,112,0.15); color: #3d9970; border-color: rgba(61,153,112,0.4); }
    .phase-defend  { background: rgba(231,76,60,0.12);  color: #e74c3c; border-color: rgba(231,76,60,0.35); }
    .phase-transit { background: rgba(232,184,75,0.12); color: #e8b84b; border-color: rgba(232,184,75,0.35); }
    .phase-rondo   { background: rgba(91,141,238,0.12); color: #5b8dee; border-color: rgba(91,141,238,0.35); }
    .phase-build   { background: rgba(155,89,182,0.12); color: #9b59b6; border-color: rgba(155,89,182,0.35); }

    @media (prefers-reduced-motion: reduce) {
      .fade-up { animation: none; }
      .chalk-line { animation: none !important; stroke-dashoffset: 0 !important; }
    }
  `}</style>
);

const PitchDivider = () => (
  <svg viewBox="0 0 320 20" style={{ width: "100%", display: "block", margin: "2px 0", opacity: 0.3 }} aria-hidden="true">
    <line x1="0" y1="10" x2="130" y2="10" stroke={C.chalk} strokeWidth="1" className="chalk-line" strokeDasharray="600" />
    <circle cx="160" cy="10" r="8" fill="none" stroke={C.chalk} strokeWidth="1" className="chalk-line" strokeDasharray="600" />
    <circle cx="160" cy="10" r="1.5" fill={C.chalk} />
    <line x1="190" y1="10" x2="320" y2="10" stroke={C.chalk} strokeWidth="1" className="chalk-line" strokeDasharray="600" />
  </svg>
);

// ============ API ============
async function callClaude(messages, system, max_tokens = 1500) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, system, max_tokens }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "API error");
  return data.text || "";
}

async function db(action, body = {}) {
  const coach_code = localStorage.getItem("nvfc_code") || "";
  const r = await fetch("/api/db", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, coach_code, ...body }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "DB error");
  return data;
}

function parseJSON(raw) {
  let t = raw.replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  if (start >= 0) t = t.slice(start);
  try { return JSON.parse(t); } catch (e) {}
  let idx = t.lastIndexOf("}");
  while (idx > 0) {
    const cut = t.slice(0, idx + 1);
    for (const tail of ["", "]", "}", "]}", "}]}", "]}]}", "\"}]}"]) {
      try { return JSON.parse(cut + tail); } catch (e) {}
    }
    idx = t.lastIndexOf("}", idx - 1);
  }
  return JSON.parse(t);
}

// ============ COACHING BRAIN ============
const PHILOSOPHIES = [
  { id: "nvfc", hi: "NVFC मिट्टी", en: "Pure NVFC", one: "कैज़ेन • आनंद • चरित्र",
    lens: "Pure NVFC: kaizen (small daily improvement), joy in repetition, character through the game, low equipment as a feature. Football as education." },
  { id: "coerver", hi: "कोएर्वर", en: "Coerver Method", one: "बॉल मास्टरी • 1v1 • हज़ार टच",
    lens: "Coerver Method: the skills pyramid — ball mastery first, then receiving/passing, then 1v1 moves, speed, finishing, group play. Maximum touches per child. Technique through joyful repetition." },
  { id: "cruyff", hi: "क्रॉयफ़", en: "Cruyff / Positional", one: "रोंडो • जगह • सोच",
    lens: "Cruyff school: positional play and game intelligence. Rondos and small-sided games as the classroom. Teach children to see space, create angles, make decisions. The pitch is a thinking problem." },
  { id: "zidane", hi: "ज़िदान", en: "Zidane Approach", one: "फर्स्ट टच • ठहराव • नज़र",
    lens: "The Zidane approach (an aesthetic, not a formal curriculum): control and calm. First touch as identity, la pausa, vision before speed. Slow drills done beautifully beat fast drills done roughly." },
];

const BASE_CONTEXT = `You are the coaching brain of NVFC (Narmada Valley Football Club), a grassroots football program by Mrida for rural children in the Narmada Valley, Madhya Pradesh. Coaches are local, Hindi-medium. Grounds are uneven red soil; equipment is minimal (few balls, stones or chappals as cones, often no goals). Players are village children aged 6-16, mixed ability, full of energy.

NVFC base values (ALWAYS on, the soil everything grows in): kaizen — small daily improvement; respect for ball and ground; discipline through rhythm not punishment; joy; football as education and character-building.

Teaching craft (Doug Lemov, always apply): feedback names the desired outcome, never dwells on the mistake; one consistent encoded verbal cue per skill, same words every time; check understanding with quick questions to every child, not just the loudest; consistent start/stop routines; coach novices with direct instruction, experts with questions.

Grassroots grounding (FIFA Grassroots manual + AFC Grassroots Charter — always apply): welcome every child regardless of age, sex, ability or background; fun above all; teach through encouragement — emphasise good points; small-sided games on small pitches beat queues and lectures; encourage initiative, risk-taking and invention; every session needs safety basics (water breaks, check ground for stones/glass, footwear awareness); girls play equally; festival spirit over results — no child sits out; respect and fair-play rituals; involve parents and community where possible.

Greeting: always greet with "जय सेवा" (e.g., "Hello Coach! जय सेवा"). NEVER use "राम राम" or other greetings.

Language: simple Hindi (Devanagari), football terms in English where natural. Short, spoken-style, like a coach on the ground.`;

const MASTER_CURRICULUM = `NVFC MASTER CURRICULUM — YOU ARE NOT A SESSION PLANNER. You are the technical director of NVFC. Your first responsibility is to protect the long-term development pathway of every child. NEVER generate a session without first identifying: 1) Age stage 2) Development stage 3) Current competency 4) Target competency. Every session must move the player one step along the pathway.

THE PATHWAY:
AGE 6-8 (Foundation): Focus = love football. Priority: ball mastery, coordination, fun, confidence. Do NOT teach: positions, formations, pressing systems, tactical lectures. GK: all children experience goalkeeping. Graduation: dribble comfortably, both feet, basic passing/receiving, enjoy football.
AGE 9-10 (Technical Foundation): Focus = comfortable with the ball. Priority: ball mastery, first touch, passing, receiving, 1v1. Introduce: width, support, triangles, simple rondos. Do NOT teach: team pressing, formations, positional systems. GK: handling, footwork, distribution. Graduation: accurate passing, receiving under pressure, basic scanning, comfortable in rondos.
AGE 11-12 (Game Intelligence): Focus = understanding football. Priority: scanning, decision making, support angles, transitions. Introduce: positional play fundamentals, width, depth, angles, third-man, numerical superiority. Pressing: INDIVIDUAL only (closing space, forcing direction). Do NOT teach: full team pressing structures. GK: communication, 1v1, decision making. Graduation: scan before receiving, understand triangles/width/depth, effective in rondos.
AGE 13-14 (Positional Understanding): Focus = collective football. Introduce: positions, team shape, build-up, compactness, defensive shape. Positional play formal instruction begins: occupying spaces, passing lanes, overloads, free player. Pressing: UNIT pressing (front players together, midfield shifts together). GK: crosses, sweeper actions, starting attacks. Graduation: role within shape, positional discipline, press with teammates.
AGE 15-16 (Competitive Football): Focus = executing under pressure. Introduce: pressing systems, triggers, counter pressing, rest defence, counter attacks. Advanced positional play: rotations, build-up structures, positional relationships. GK: playing through pressure, advanced distribution, sweeper keeper. Graduation: read the game, adapt decisions, understand systems.
AGE 17-18 (Football Adult): Focus = independent footballer and leader. Introduce: multiple formations, match analysis, tactical adaptation, leadership. Pressing: full systems (high press, mid block, low block). GK: tactical leadership, team organisation, match management. Graduation: lead training, analyse matches, mentor younger players, represent NVFC values.

CHARACTER CURRICULUM (equal in importance): age 8 = care for equipment; age 10 = help younger players; age 12 = lead warm-up groups; age 14 = referee village games; age 16 = assist coaching; age 18 = lead football in another village.

When generating any session always state: CURRENT COMPETENCY, TARGET COMPETENCY, WHY THIS SESSION EXISTS — only then design drills. Never teach what the stage forbids. Never skip a stage.`;

// ============ PATHWAY DATA ============
const ytLink = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const sq = (q) => ({ t: "▶ " + q.split(" ").slice(0, 4).join(" ") + "…", u: ytLink(q), search: true });
const PATHWAY = [
  {
    id: "s1", age: "6-8", hi: "नींव", en: "Foundation", focus: "फुटबॉल से प्यार",
    avoid: "positions, formations, pressing, tactical भाषण — कुछ नहीं",
    character: "उम्र 8: सामान की देखभाल",
    grad: ["आराम से dribble", "दोनों पैर", "basic pass-receive", "फुटबॉल में मज़ा"],
    comps: [
      { hi: "बॉल मास्टरी", desc: "हर बच्चा, अपनी बॉल, हज़ार टच — sole, inside, outside।", v: [
        { t: "▶ Coerver full ball mastery session", u: "https://www.youtube.com/watch?v=zQdmPW018LQ" },
        { t: "▶ 30 ball mastery drills", u: "https://www.youtube.com/watch?v=IeMYh7roBjk" } ] },
      { hi: "कोऑर्डिनेशन और मज़ा", desc: "दौड़, कूद, रुकना, मुड़ना — खेल-खेल में शरीर की भाषा।", v: [sq("fun coordination games U6 U8 soccer kids")] },
      { hi: "दोनों पैर", desc: "कमज़ोर पैर भी दोस्त — हर drill दोनों तरफ।", v: [sq("two footed dribbling drills young kids football")] },
      { hi: "GK अनुभव — सबको", desc: "हर बच्चा गोल में खड़ा हो — डर अभी टूटे।", v: [
        { t: "▶ Fun GK drills U5-U10", u: "https://www.youtube.com/watch?v=BHsPdQ7EnZM" } ] },
    ],
  },
  {
    id: "s2", age: "9-10", hi: "तकनीकी नींव", en: "Technical Foundation", focus: "बॉल से दोस्ती पक्की",
    avoid: "team pressing, formations, positional systems नहीं",
    character: "उम्र 10: छोटों की मदद",
    grad: ["सटीक passing", "दबाव में receiving", "basic scanning", "rondo में सहज"],
    comps: [
      { hi: "बॉल मास्टरी+", desc: "रोज़ के टच — अब रफ़्तार और दिशा बदलते हुए।", v: [
        { t: "▶ 30 ball mastery drills", u: "https://www.youtube.com/watch?v=IeMYh7roBjk" } ] },
      { hi: "फर्स्ट टच", desc: "पहला टच अगले काम की तैयारी — दिशा में लो।", v: [
        { t: "▶ First Touch Drills — Soluna Football", u: "https://youtu.be/Mt17vBzxPwI?si=Sgg_bQbDjcU4MbSj" },
        { t: "▶ Soluna Football Channel", u: "https://youtube.com/@soluna-football?si=Kyyz_wEgsnElsw04" },
        sq("first touch drills U10 soccer")] },
      { hi: "पासिंग-रिसीविंग", desc: "ज़मीन पर, अंदर के पंजे से, साथी के सही पैर पर।", v: [
        { t: "▶ Passing Drills — Panda Bros", u: "https://youtu.be/3Lwku21Seb8?si=zPiVoTFZyv-X2Muo" },
        { t: "▶ Panda Bros Football Channel", u: "https://youtube.com/@pandabros.1818?si=L7BxpM5De2vqiW_U" },
        sq("passing receiving drills U10 football")] },
      { hi: "1v1 हुनर", desc: "एक move पक्का करो — feint, बदलाव, भागो।", v: [sq("Coerver 1v1 moves youth football")] },
      { hi: "Simple Rondo + त्रिकोण", desc: "4v1 गोला — width, support, triangle की पहली झलक।", v: [sq("simple rondo 4v1 U10")] },
      { hi: "GK: हाथ-पैर-बाँटना", desc: "Handling, footwork, distribution — GK की नींव।", v: [
        { t: "▶ Catching basics", u: "https://www.youtube.com/watch?v=PY1oJFuM5qU" },
        { t: "▶ GK footwork fundamentals", u: "https://www.youtube.com/watch?v=JDf3xV92fGM" } ] },
    ],
  },
  {
    id: "s3", age: "11-12", hi: "खेल की समझ", en: "Game Intelligence", focus: "फुटबॉल को समझना",
    avoid: "full team pressing structures नहीं — सिर्फ़ individual pressing",
    character: "उम्र 12: warm-up group की अगुवाई",
    grad: ["receive से पहले scan", "triangle/width/depth की समझ", "rondo में असरदार"],
    comps: [
      { hi: "स्कैनिंग", desc: "बॉल आने से पहले कंधे के ऊपर नज़र — photo खींचो।", v: [
        { t: "▶ Young players को SCAN सिखाओ", u: "https://www.youtube.com/watch?v=b_Gebed7DPE" },
        { t: "▶ How to coach scanning (vol 2)", u: "https://www.youtube.com/watch?v=4Get6r03mFE" } ] },
      { hi: "Decision Making", desc: "देखो — सोचो — चुनो: pass, dribble, या मोड़?", v: [
        { t: "▶ Scanning + decision making exercises", u: "https://www.youtube.com/watch?v=CgQxnkrYpC0" } ] },
      { hi: "Support Angles + तीसरा आदमी", desc: "सीधी लाइन से हटो — कोण बनाओ, third-man खोजो।", v: [sq("support angles third man drill youth football")] },
      { hi: "Transitions", desc: "बॉल खोई/मिली — पहले 3 सेकंड में क्या?", v: [sq("transition game U12 soccer drill")] },
      { hi: "Individual Pressing", desc: "जगह बंद करो, दिशा मजबूर करो — अकेले।", v: [sq("1v1 defending pressing youth soccer")] },
      { hi: "GK: आवाज़ + 1v1", desc: "Communication, breakaway timing, फ़ैसले।", v: [
        { t: "▶ GK 1v1 drills", u: "https://www.youtube.com/watch?v=BHsPdQ7EnZM" } ] },
    ],
  },
  {
    id: "s4", age: "13-14", hi: "पोज़ीशन की समझ", en: "Positional Understanding", focus: "मिलकर खेलना",
    avoid: "positional play अब formal शुरू — पर systems अभी हल्के",
    character: "उम्र 14: गाँव के match में referee",
    grad: ["shape में अपना रोल", "positional discipline", "साथियों संग press"],
    comps: [
      { hi: "Positions + Team Shape", desc: "मैदान के हिस्से, compactness, defensive shape।", v: [sq("teaching team shape U14 football session")] },
      { hi: "Build-up", desc: "पीछे से खेल बनाना — GK से midfield तक।", v: [sq("build up play drills U14 soccer")] },
      { hi: "Passing Lanes + Overloads", desc: "जगह occupy करो, lane खोलो, free player ढूँढो।", v: [sq("overloads passing lanes positional play youth")] },
      { hi: "फिनिशिंग", desc: "गोल के सामने — शांत रहो, सही कोने में मारो।", v: [
        { t: "▶ Finishing Drills", u: "https://youtu.be/rbRaC-_M4YQ?si=NRrFD9W6QRQjeg3UmK5r" },
        sq("finishing drills youth football session")] },
      { hi: "Unit Pressing", desc: "आगे वाले साथ press, midfield साथ shift।", v: [sq("pressing in units youth football session")] },
      { hi: "GK: Crosses + Sweeper", desc: "ऊँची बॉल पकड़ना, लाइन से बाहर खेलना, attack शुरू करना।", v: [sq("goalkeeper crosses high balls drill youth")] },
    ],
  },
  {
    id: "s5", age: "15-16", hi: "प्रतिस्पर्धा", en: "Competitive Football", focus: "दबाव में खेलना",
    avoid: "अब systems आते हैं — पर हमेशा खेल के अंदर सिखाओ",
    character: "उम्र 16: coaching में मदद",
    grad: ["खेल पढ़ना", "फ़ैसले बदलना", "systems की समझ"],
    comps: [
      { hi: "Pressing Systems + Triggers", desc: "कब press? — bad touch, पीठ की तरफ receive, sideline।", v: [sq("pressing triggers football session")] },
      { hi: "Counter-Pressing", desc: "बॉल खोते ही 5 सेकंड का तूफ़ान।", v: [sq("counter pressing drill session")] },
      { hi: "Rotations + Build-up Structures", desc: "जगह बदलो पर ढाँचा रखो।", v: [sq("midfield rotations positional play session")] },
      { hi: "Rest Defence + Counter", desc: "attack के वक़्त पीछे का बीमा — और पलटवार।", v: [sq("rest defence counter attack session")] },
      { hi: "GK: Sweeper Keeper", desc: "दबाव में पैर से, ऊँची लाइन, advanced distribution।", v: [
        { t: "▶ Youth GK session — distribution", u: "https://www.youtube.com/watch?v=bKlB-sSlPIU" }, sq("sweeper keeper training drills") ] },
    ],
  },
  {
    id: "s6", age: "17-18", hi: "फुटबॉल वयस्क", en: "Football Adult", focus: "आज़ाद खिलाड़ी, नेता",
    avoid: "अब कोई रोक नहीं — पर NVFC के मूल्य सबसे ऊपर",
    character: "उम्र 18: दूसरे गाँव में फुटबॉल की अगुवाई",
    grad: ["training lead करना", "match analysis", "छोटों के mentor", "NVFC के मूल्य"],
    comps: [
      { hi: "Formations + Blocks", desc: "High press, mid block, low block — कब क्या।", v: [sq("high press mid block low block explained")] },
      { hi: "Match Analysis", desc: "खेल देखो — pattern पकड़ो — शब्दों में बोलो।", v: [sq("football match analysis basics for players")] },
      { hi: "Leadership + Mentoring", desc: "training चलाओ, छोटों को सिखाओ।", v: [sq("youth captain leadership football")] },
      { hi: "GK: Match Management", desc: "टीम organize करो — मैदान का general।", v: [sq("goalkeeper organizing defense communication")] },
    ],
  },
];

// ============ PRIORITY VIDEO MATCHER ============
function getPriorityVideos(drillName, ytQuery) {
  const name = (drillName + " " + (ytQuery||"")).toLowerCase();
  const priority = [];
  if (name.match(/pass|rondo|gate|combination|combination play/)) {
    priority.push({ t: "▶ Panda Bros — Passing", u: "https://youtu.be/3Lwku21Seb8?si=zPiVoTFZyv-X2Muo", channel: "Panda Bros" });
  }
  if (name.match(/first.touch|touch|receive|receiving|control/)) {
    priority.push({ t: "▶ Soluna — First Touch", u: "https://youtu.be/Mt17vBzxPwI?si=Sgg_bQbDjcU4MbSj", channel: "Soluna Football" });
  }
  if (name.match(/finish|goal|shoot|scoring|strike/)) {
    priority.push({ t: "▶ Soluna — Finishing", u: "https://youtu.be/rbRaC-_M4YQ?si=NRrFD9W6QRQjeg3UmK5r", channel: "Soluna Football" });
  }
  return priority;
}
const VIDEO_LIBRARY = [
  {
    channel: "Panda Bros Football",
    handle: "@pandabros.1818",
    url: "https://youtube.com/@pandabros.1818?si=L7BxpM5De2vqiW_U",
    focus: "Passing Drills",
    videos: [
      { t: "Passing Drills", u: "https://youtu.be/3Lwku21Seb8?si=zPiVoTFZyv-X2Muo" },
    ]
  },
  {
    channel: "Soluna Football",
    handle: "@soluna-football",
    url: "https://youtube.com/@soluna-football?si=Kyyz_wEgsnElsw04",
    focus: "First Touch & Finishing",
    videos: [
      { t: "First Touch Drills", u: "https://youtu.be/Mt17vBzxPwI?si=Sgg_bQbDjcU4MbSj" },
      { t: "Finishing Drills", u: "https://youtu.be/rbRaC-_M4YQ?si=NRrFD9W6QRQjeg3UmK5r" },
    ]
  },
];

// ============ STATIC DATA ============
const DRILLS = [
  { hi: "रोंडो — 4v1", en: "Rondo 4v1", age: "8+", desc: "चार बच्चे गोले में, एक बीच में। बॉल छीनने तक पास करते रहो। बीच वाला छीने तो जगह बदलो।", cue: "पहला टच — अगले पास की तैयारी।", kaizen: "हर दिन एक टच कम।", q: "rondo 4v1 youth football drill" },
  { hi: "छाया ड्रिबल", en: "Shadow Dribble", age: "6+", desc: "जोड़ी में — आगे वाला बॉल लेकर मुड़ता-घूमता है, पीछे वाला बिना बॉल नक़ल करता है। सीटी पर रोल बदलो।", cue: "नज़र ऊपर, बॉल पैरों के पास।", kaizen: "आज कल से एक मोड़ ज़्यादा।", q: "shadow dribbling drill kids football" },
  { hi: "गेट पासिंग", en: "Gate Passing", age: "8+", desc: "पत्थरों से छोटे गेट बनाओ। जोड़ी में गेट के आर-पार पास। 2 मिनट में कितने गेट — गिनो।", cue: "अंदर के पंजे से — ज़मीन पर पास।", kaizen: "अपना ही स्कोर तोड़ो।", q: "gate passing drill youth soccer" },
  { hi: "1v1 दरवाज़ा", en: "1v1 Doors", age: "10+", desc: "दो छोटे गेट दोनों छोर पर। 1v1 — किसी भी गेट से ड्रिबल करके निकलो तो पॉइंट।", cue: "बदलाव की रफ़्तार — धीमे से तेज़।", kaizen: "हारो तो पूछो — कहाँ खुला था?", q: "1v1 two goal dribbling drill football" },
  { hi: "साँस और बॉल", en: "Breath & Ball", age: "6+", desc: "अंत में — हर बच्चा बॉल पर पैर रखकर आँख बंद करे। तीन गहरी साँस। आज क्या सीखा — एक शब्द।", cue: "बॉल का शुक्रिया, मैदान का शुक्रिया।", kaizen: "रोज़ का एक शब्द — साल की किताब।", q: "mindfulness cool down kids sports" },
];

const GK_STAGES = [
  { n: 1, hi: "बॉल से दोस्ती", coerver: "Ball Mastery → Handling",
    drill: "हर GK के हाथ में बॉल। उछालो — ताली — पकड़ो। फिर दीवार या साथी से बार-बार catch। बॉल हाथों की आदत बने।",
    cue: "आँख बॉल पर — आख़िरी पल तक।", kaizen: "रोज़ 50 catch — गिनती खुद रखो, कल 51।",
    videos: [
      { t: "Catching basics — beginner drills", u: "https://www.youtube.com/watch?v=PY1oJFuM5qU" },
      { t: "Handling सुधारो — drills", u: "https://www.youtube.com/watch?v=35lSiGALVyE" },
    ] },
  { n: 2, hi: "पकड़ के आकार", coerver: "Receiving → Catching Shapes",
    drill: "तीन पकड़ सीखो: ऊँची बॉल = W (दोनों अंगूठे मिले), पेट की बॉल = टोकरी, नीची बॉल = scoop। साथी हाथ से फेंके, GK नाम बोलकर पकड़े — \"W!\" \"टोकरी!\"",
    cue: "पहले आकार बोलो — फिर पकड़ो।", kaizen: "हर पकड़ का नाम — सोच और हाथ एक साथ।",
    videos: [
      { t: "तीन catching techniques", u: "https://www.youtube.com/watch?v=wnBlLlBASn4" },
      { t: "सभी PRO catching तरीक़े", u: "https://www.youtube.com/watch?v=DVIX2nXeEWg" },
    ] },
  { n: 3, hi: "पैर पहले", coerver: "Speed → Footwork",
    drill: "दो पत्थर 3 मीटर दूर। GK बीच में side-shuffle — पैर कभी cross नहीं। साथी कभी भी बॉल फेंके, GK रुककर set होकर पकड़े।",
    cue: "हाथ save करते हैं — पैर पहुँचाते हैं।", kaizen: "हर हफ़्ते shuffle थोड़ा और तेज़ — गिरो मत।",
    videos: [{ t: "Fundamental GK drills (footwork)", u: "https://www.youtube.com/watch?v=JDf3xV92fGM" }] },
  { n: 4, hi: "1v1 हिम्मत", coerver: "1v1 Moves → Breakaway",
    drill: "Attacker धीरे dribble करके आए। GK सही पल पर आगे बढ़े — बड़ा बने, नीचे रहे, बॉल पर हाथ। पहले धीमी रफ़्तार, फिर असली।",
    cue: "बड़े बनो — रुको — बॉल देखो, पैर नहीं।", kaizen: "हर 1v1 के बाद पूछो — मैं कब निकला, सही या जल्दी?",
    videos: [{ t: "Fun GK drills U5-U10 (1v1 समेत)", u: "https://www.youtube.com/watch?v=BHsPdQ7EnZM" }] },
  { n: 5, hi: "बाँटना", coerver: "Passing → Distribution",
    drill: "पकड़ के बाद ही असली काम — roll, throw, या पैर से pass। साथी दो गेट बनाएँ, GK पकड़कर 3 सेकंड में सही गेट चुने। पैर से ज़्यादा खेलो — हाथ से कम।",
    cue: "पकड़ा? — अब पहला attacker तुम हो।", kaizen: "हर session में feet-touch, hand-touch से ज़्यादा हों।",
    videos: [{ t: "Youth GK session — passing, handling, blocking", u: "https://www.youtube.com/watch?v=bKlB-sSlPIU" }] },
  { n: 6, hi: "खेल में", coerver: "Group Play → Game",
    drill: "छोटा खेल 3v3 + GK दोनों तरफ। GK के clean catch और अच्छे distribution के अलग पॉइंट। खेल ही असली परीक्षा।",
    cue: "खेल पढ़ो — बोलो — टीम को चलाओ।", kaizen: "हर खेल में एक बार पूरी टीम को आवाज़ से organize करो।",
    videos: [{ t: "5 GK drills for kids — game-based", u: "https://www.youtube.com/watch?v=kEKFYtyDduI" }] },
];

const Card = ({ children, style }) => (
  <div className="fade-up" style={{
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "14px 16px", marginBottom: 10,
    ...style
  }}>{children}</div>
);

const Tag = ({ children, color = C.gold }) => (
  <span className="body" style={{
    fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
    color: C.bg, background: color,
    borderRadius: 6, padding: "2px 8px", textTransform: "uppercase"
  }}>{children}</span>
);

const Btn = ({ children, onClick, primary, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} className="body" style={{
    background: primary ? C.gold : "transparent",
    color: primary ? C.bg : C.chalk,
    border: primary ? "none" : `1px solid ${C.borderStrong}`,
    borderRadius: 10, padding: "12px 18px",
    fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 1,
    width: "100%", transition: "opacity .15s", ...style,
  }}>{children}</button>
);

const Chip = ({ children, onClick, href, color = C.borderStrong, textColor = C.chalkDim }) => href ? (
  <a href={href} target="_blank" rel="noopener noreferrer" className="body" style={{
    border: `1px solid ${color}`, color: textColor,
    borderRadius: 8, padding: "4px 12px", fontSize: 12,
    textDecoration: "none", display: "inline-block", fontWeight: 500,
  }}>{children}</a>
) : (
  <button onClick={onClick} className="body" style={{
    background: "transparent", border: `1px solid ${color}`,
    color: textColor, borderRadius: 8, padding: "4px 12px",
    fontSize: 12, cursor: "pointer", fontWeight: 500,
  }}>{children}</button>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="body" style={{
      fontSize: 10, fontWeight: 600, color: C.gold,
      letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6
    }}>{label}</div>
    {children}
  </div>
);

const inputStyle = {
  width: "100%", background: C.surface2,
  color: C.chalk, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "11px 14px",
  fontSize: 14, fontFamily: "'Inter', 'Mukta', sans-serif",
  outline: "none", transition: "border-color .2s",
};

// ============ PITCH DIAGRAM ============
function PitchDiagram({ spec }) {
  if (!spec) return null;
  const W = 100, H = 70;
  const sx = (v) => (v / 100) * W, sy = (v) => (v / 100) * H;
  const teamColor = { A: C.gold, B: C.laterite, N: C.chalk };
  return (
    <div className="fade-up" style={{ marginTop: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", borderRadius: 10, background: `linear-gradient(180deg, ${C.grass}, ${C.grassLight})` }}>
        <defs><marker id="arrowSolid" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.chalk} /></marker></defs>
        <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke={C.chalk} strokeWidth="0.7" opacity="0.8" />
        <circle cx={W / 2} cy={H / 2} r="9" fill="none" stroke={C.chalk} strokeWidth="0.5" opacity="0.5" />
        <line x1={W / 2} y1="2" x2={W / 2} y2={H - 2} stroke={C.chalk} strokeWidth="0.5" opacity="0.5" />
        {(spec.arrows || []).map((a, i) => (
          <line key={"a" + i} x1={sx(a.x1)} y1={sy(a.y1)} x2={sx(a.x2)} y2={sy(a.y2)} stroke={C.chalk} strokeWidth="0.9"
            strokeDasharray={a.k === "pass" ? "2.5,1.8" : a.k === "dribble" ? "0.8,1.4" : "none"} markerEnd="url(#arrowSolid)" opacity="0.95" />
        ))}
        {(spec.cones || []).map((c, i) => (
          <polygon key={"c" + i} points={`${sx(c.x)},${sy(c.y) - 2.2} ${sx(c.x) - 1.8},${sy(c.y) + 1.4} ${sx(c.x) + 1.8},${sy(c.y) + 1.4}`} fill="#e8762d" stroke={C.pitchDeep} strokeWidth="0.3" />
        ))}
        {(spec.balls || []).map((b, i) => (
          <circle key={"b" + i} cx={sx(b.x)} cy={sy(b.y)} r="1.6" fill={C.chalk} stroke={C.pitchDeep} strokeWidth="0.4" />
        ))}
        {(spec.players || []).map((p, i) => (
          <circle key={"p" + i} cx={sx(p.x)} cy={sy(p.y)} r="2.8" fill={teamColor[p.t] || C.gold} stroke={C.pitchDeep} strokeWidth="0.5" />
        ))}
      </svg>
      <div className="body" style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: C.chalkDim, marginTop: 6 }}>
        <span><span style={{ color: C.gold }}>●</span> टीम A</span>
        <span><span style={{ color: C.laterite }}>●</span> टीम B</span>
        <span>▲ कोन/पत्थर</span><span>— — पास</span><span>· · · ड्रिबल</span><span>—— दौड़</span>
      </div>
      {spec.note && <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginTop: 4 }}>{spec.note}</div>}
    </div>
  );
}

const DIAGRAM_SYS = `You convert one football drill into a diagram spec. Coordinate space: x 0-100, y 0-100. Respond ONLY with JSON, no fences:
{"players":[{"x":N,"y":N,"t":"A"|"B"|"N"}],"cones":[{"x":N,"y":N}],"balls":[{"x":N,"y":N}],"arrows":[{"x1":N,"y1":N,"x2":N,"y2":N,"k":"run"|"pass"|"dribble"}],"note":"one short Hindi line"}
Max 10 players, 8 cones, 3 balls, 6 arrows. Keep 10 units from edges. t:"A" attackers, "B" defenders, "N" neutral/GK.`;

function useDiagrams() {
  const [diagrams, setDiagrams] = useState({});
  const make = async (key, text) => {
    setDiagrams((d) => ({ ...d, [key]: "loading" }));
    try {
      const raw = await callClaude([{ role: "user", content: `Drill: ${String(text).slice(0, 1200)}` }], DIAGRAM_SYS, 800);
      setDiagrams((d) => ({ ...d, [key]: parseJSON(raw) }));
    } catch (e) {
      setDiagrams((d) => ({ ...d, [key]: "error" }));
    }
  };
  return [diagrams, make];
}

function DiagramBlock({ k, text, diagrams, make }) {
  const d = diagrams[k];
  return (
    <>
      {d && d !== "loading" && d !== "error" && <PitchDiagram spec={d} />}
      {!d && <Chip onClick={() => make(k, text)} textColor={C.chalkDim}>📐 डायग्राम देखो</Chip>}
      {d === "loading" && <span className="body" style={{ fontSize: 13, color: C.chalkDim }}>डायग्राम बन रहा है…</span>}
      {d === "error" && <Chip onClick={() => make(k, text)} color={C.laterite} textColor={C.laterite}>फिर कोशिश करो</Chip>}
    </>
  );
}

// ============ LOGIN ============
function Login({ onIn }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const go = async () => {
    setLoading(true); setErr("");
    try {
      localStorage.setItem("nvfc_code", code.trim().toUpperCase());
      const { coach } = await db("login");
      localStorage.setItem("nvfc_name", coach.name);
      onIn(coach);
    } catch (e) {
      localStorage.removeItem("nvfc_code");
      setErr("Code नहीं मिला — DJ से अपना NVFC code लो।");
    }
    setLoading(false);
  };
  return (
    <div style={{ padding: "48px 20px", textAlign: "center" }}>
      <div className="display" style={{ fontSize: 56, color: C.chalk, lineHeight: 1 }}>NVFC</div>
      <div className="body" style={{ fontSize: 14, color: C.gold, fontWeight: 700, letterSpacing: "0.14em", marginTop: 4 }}>NARMADA VALLEY FC</div>
      <div className="body" style={{ fontSize: 14, color: C.chalkDim, marginTop: 6 }}>मिट्टी का मैदान — कैज़ेन का खेल</div>
      <PitchDivider />
      <div style={{ maxWidth: 320, margin: "24px auto 0", textAlign: "left" }}>
        <Field label="अपना Coach Code डालो">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NVFC-NAAM-01" style={{ ...inputStyle, textTransform: "uppercase" }}
            onKeyDown={(e) => e.key === "Enter" && go()} />
        </Field>
        <Btn primary onClick={go} disabled={loading || !code.trim()}>{loading ? "देख रहे हैं…" : "मैदान में आओ →"}</Btn>
        {err && <div className="body" style={{ color: C.laterite, fontSize: 13, marginTop: 10 }}>{err}</div>}
      </div>
    </div>
  );
}

// ============ PLAN VIEW ============
function PlanView({ plan, philName, diagrams, make, onVariety, varietyLoading }) {
  return (
    <Card style={{ borderColor: C.grass }}>
      <div className="display" style={{ fontSize: 22, color: C.chalk, textAlign: "center" }}>{plan.title}</div>
      <div className="body" style={{ fontSize: 13, color: C.gold, textAlign: "center", marginTop: 4 }}>{plan.theme}</div>
      {philName && <div style={{ textAlign: "center", marginTop: 6 }}><Tag>{philName} × NVFC</Tag></div>}
      {plan.current && plan.target && (
        <div className="body" style={{ marginTop: 10, border: `1px dashed ${C.gold}`, borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
          <div style={{ color: C.chalk }}><b style={{ color: C.gold }}>पाथवे:</b> {plan.current} <span style={{ color: C.laterite }}>→</span> {plan.target}</div>
          {plan.why_session && <div style={{ color: C.chalkDim, marginTop: 3 }}><b style={{ color: C.gold }}>यह सेशन क्यों:</b> {plan.why_session}</div>}
        </div>
      )}
      <PitchDivider />
      {(plan.blocks || []).map((b, i) => (
        <div key={i} style={{ padding: "12px 0", borderBottom: `1px dashed ${C.line}` }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="display" style={{ fontSize: 18, color: C.laterite, minWidth: 44 }}>{b.minutes}′</div>
            <div className="body" style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.chalk }}>{b.name}</div>
              <div style={{ fontSize: 14, color: C.chalkDim, marginTop: 3, lineHeight: 1.55 }}>{b.drill}</div>
              <div style={{ fontSize: 13, color: C.gold, marginTop: 5 }}>🗣 "{b.cue}"</div>
              {b.why && <div style={{ fontSize: 13, color: C.grassLight, marginTop: 3 }}>💭 {b.why}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <DiagramBlock k={i} text={`${b.name}. ${b.drill}`} diagrams={diagrams} make={make} />
                {getPriorityVideos(b.name, b.yt || "").map((v) => (
                  <Chip key={v.u} href={v.u} color={C.gold} textColor={C.gold}>{v.t}</Chip>
                ))}
                <Chip href={ytLink(b.yt || b.name + " football drill youth")}>▶ और वीडियो खोजो</Chip>
                {onVariety && (
                  <Chip onClick={() => onVariety(i)} color={C.gold} textColor={C.gold}>
                    {varietyLoading === i ? "नया रूप बन रहा…" : "🔄 नया रूप"}
                  </Chip>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginTop: 12 }}>
        <b style={{ color: C.chalk }}>सामान:</b> {plan.equipment}
      </div>
      <div className="body" style={{ fontSize: 14, color: C.chalk, marginTop: 10, fontStyle: "italic", textAlign: "center" }}>⭕ {plan.closing}</div>
      {plan.motivation && (
        <div style={{ marginTop: 16, border: `1px solid ${C.gold}`, borderRadius: 12, padding: 14 }}>
          <div className="display" style={{ fontSize: 16, color: C.gold }}>हौसला — कोच की बात 🔥</div>
          <div className="body" style={{ fontSize: 14, color: C.chalk, lineHeight: 1.65, marginTop: 8, whiteSpace: "pre-wrap" }}>{plan.motivation.talk}</div>
          <div className="body" style={{ fontSize: 13, color: C.grassLight, marginTop: 10 }}>
            <b>कोच, अपने लिए एक सवाल:</b> {plan.motivation.reflection}
          </div>
          <div style={{ marginTop: 10 }}>
            <Chip href="https://www.instagram.com/fit_4_football/" color={C.gold} textColor={C.gold}>📷 @fit_4_football — और हौसला</Chip>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============ SESSION PLANNER ============
function SessionPlanner({ coach, prefill, clearPrefill }) {
  const [stageId, setStageId] = useState(prefill?.stageId || "s2");
  const [current, setCurrent] = useState(prefill?.comp || PATHWAY[1].comps[0].hi);
  const [target, setTarget] = useState("");
  const [duration, setDuration] = useState("60");
  const [ground, setGround] = useState("मिट्टी का मैदान, कम सामान");
  const [phil, setPhil] = useState("coerver");
  const [stage, setStage] = useState("form");
  const [thinking, setThinking] = useState("");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [varietyLoading, setVarietyLoading] = useState(null);
  const [diagrams, makeDiagram] = useDiagrams();

  const pathStage = PATHWAY.find((s) => s.id === stageId);
  const philObj = PHILOSOPHIES.find((p) => p.id === phil);

  useEffect(() => {
    if (prefill) { setStageId(prefill.stageId); setCurrent(prefill.comp); setTarget(""); setStage("form"); setPlan(null); setThinking(""); clearPrefill && clearPrefill(); }
  }, [prefill]);

  useEffect(() => {
    if (!pathStage.comps.find((c) => c.hi === current)) setCurrent(pathStage.comps[0].hi);
  }, [stageId]);

  const targetOptions = ["(अगला कदम — खुद चुनो AI)", ...pathStage.comps.map((c) => c.hi)];
  const ctxLine = `Age stage: ${pathStage.age} (${pathStage.en}). Current competency: ${current}. Target competency: ${target || "next logical step on the pathway — you choose"}. Duration: ${duration} min. Ground: ${ground}. Lens: ${philObj.en}. Coach: ${coach.name}.`;
  const curriculumSys = BASE_CONTEXT + "\n\n" + MASTER_CURRICULUM + `\n\nHARD GUARDRAILS for stage ${pathStage.age}: ${pathStage.avoid}. Character focus: ${pathStage.character}.`;

  const generateThinking = async () => {
    setLoading(true); setErr(""); setThinking(""); setPlan(null); setSaved(false);
    try {
      const sys = curriculumSys + `\n\nActive lens (planted in NVFC soil): ${philObj.lens}\n\nTask: BEFORE any plan, think aloud as NVFC's technical director. Identify the current competency, the target competency, and WHY this session exists on the pathway — what came before, what must NOT be taught yet. 100-150 words, simple Hindi, first person plural ("हम"), spoken style. No drills list, no headings.`;
      const out = await callClaude([{ role: "user", content: ctxLine }], sys, 800);
      setThinking(out.trim()); setStage("thinking");
    } catch (e) { setErr("सोच नहीं बन पाई — फिर कोशिश करें।"); }
    setLoading(false);
  };

  const generatePlan = async () => {
    setLoading(true); setErr("");
    try {
      let avoid = [];
      try { avoid = (await db("recent_drills")).drills || []; } catch (e) {}
      const sys = curriculumSys + `\n\nActive lens: ${philObj.lens}\n\nThe technical director's thinking (build strictly from this):\n${thinking}\n${avoid.length ? `\nDrills this coach used recently — do NOT repeat, give fresh forms of the same concepts: ${avoid.join("; ")}` : ""}\n\nCRITICAL RULE: Each block = ONE drill only. Never combine multiple drills into one block. Never write "Drill 1:", "Drill 2:" inside a single block. If you want 3 drills, make 3 separate blocks.\n\nRespond ONLY with JSON, no fences:\n{"current":"current competency Hindi","target":"target competency Hindi","why_session":"WHY this session exists on the pathway, one line Hindi","title":"short Hindi title","theme":"one-line kaizen theme Hindi","blocks":[{"name":"ONE drill name in Hindi — no numbering","minutes":N,"drill":"ONE drill only — setup + what players do, 2-3 short Hindi sentences. No sub-drills. No lists.","cue":"one spoken cue Hindi","why":"one line, lens voice, Hindi","yt":"english youtube search query for THIS specific drill"}],"equipment":"Hindi minimal list","closing":"closing circle line Hindi"}\nGenerate exactly 4 separate blocks. Block 1: warm-up drill. Block 2: main drill. Block 3: main drill variation or progression. Block 4: closing small game or circle. Each block has ONE drill. Total minutes = ${duration}. Every block serves the target competency. Respect stage do-NOT-teach list absolutely.`;
      const raw = await callClaude([{ role: "user", content: ctxLine }], sys, 2200);
      const p = parseJSON(raw);
      setPlan(p); setStage("plan");
      generateMotivation(p);
    } catch (e) { setErr("प्लान नहीं बन पाया — एक बार फिर कोशिश करें।"); }
    setLoading(false);
  };

  const generateMotivation = async (p) => {
    try {
      const sys = BASE_CONTEXT + `\n\nA session plan titled "${p.title}" (theme: ${p.theme}, pathway: ${p.current} → ${p.target}) just ended. Respond ONLY with JSON, no fences:\n{"talk":"a 60-90 second motivational closing-circle talk the coach reads aloud to the children, simple Hindi, warm, about effort/kaizen/character — tied to today's theme and the stage's character focus (${pathStage.character}). 4-6 short lines.","reflection":"ONE honest reflection question for the COACH himself about today's session, Hindi, one line"}`;
      const raw = await callClaude([{ role: "user", content: `Theme: ${p.theme}. Stage: ${pathStage.age}.` }], sys, 700);
      setPlan((prev) => prev ? { ...prev, motivation: parseJSON(raw) } : prev);
    } catch (e) {}
  };

  const variety = async (i) => {
    setVarietyLoading(i);
    try {
      const b = plan.blocks[i];
      const sys = curriculumSys + `\n\nActive lens: ${philObj.lens}\n\nReplace ONE session block with a DIFFERENT drill teaching the SAME concept — kids found the old one familiar. Old drill (do not repeat or lightly rename): "${b.name}: ${b.drill}". Same minutes (${b.minutes}), same target competency (${plan.target}), fresh form, fun. Respond ONLY with JSON, no fences:\n{"name":"Hindi name","minutes":${b.minutes},"drill":"2-3 short Hindi sentences","cue":"one spoken cue Hindi","why":"one line Hindi","yt":"english youtube query"}`;
      const raw = await callClaude([{ role: "user", content: ctxLine }], sys, 700);
      const nb = parseJSON(raw);
      setPlan((p) => ({ ...p, blocks: p.blocks.map((x, j) => (j === i ? nb : x)) }));
      setSaved(false);
    } catch (e) {}
    setVarietyLoading(null);
  };

  const savePlan = async () => {
    try {
      await db("save_plan", {
        title: plan.title,
        payload: { ...plan, thinking, phil: philObj.id, stageId, age: pathStage.age, focus: plan.target || current, duration, ground },
        drills: (plan.blocks || []).map((b) => b.name),
      });
      setSaved(true);
    } catch (e) { setErr("Save नहीं हुआ — network देखो।"); }
  };

  const reset = () => { setStage("form"); setThinking(""); setPlan(null); setErr(""); setSaved(false); };

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 130px)" }}>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Session Planner</div>
      <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16, marginTop: 2 }}>Age → Stage → Competency → Think → Plan. Every session is one step on the pathway.</div>
      {stage === "form" && (
        <Card>
          <Field label="उम्र / पड़ाव">
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={inputStyle}>
              {PATHWAY.map((s) => <option key={s.id} value={s.id}>{s.age} — {s.hi} ({s.en})</option>)}
            </select>
            <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginTop: 4 }}>फोकस: {pathStage.focus} • 🚫 {pathStage.avoid}</div>
          </Field>
          <Field label="अभी कहाँ हैं (Current Competency)">
            <select value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle}>
              {pathStage.comps.map((c) => <option key={c.hi}>{c.hi}</option>)}
            </select>
          </Field>
          <Field label="कहाँ ले जाना है (Target)">
            <select value={target} onChange={(e) => setTarget(e.target.value === targetOptions[0] ? "" : e.target.value)} style={inputStyle}>
              {targetOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="दर्शन / Philosophy Lens">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PHILOSOPHIES.map((p) => (
                <button key={p.id} onClick={() => setPhil(p.id)} className="body" style={{
                  background: phil === p.id ? C.laterite : C.pitch, border: `1.5px solid ${phil === p.id ? C.laterite : C.line}`,
                  borderRadius: 10, padding: "10px 8px", cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.chalk }}>{p.hi}</div>
                  <div style={{ fontSize: 11, color: phil === p.id ? "rgba(245,242,232,0.8)" : C.chalkDim }}>{p.one}</div>
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="समय (min)">
              <select value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle}>
                <option>45</option><option>60</option><option>90</option>
              </select>
            </Field>
            <Field label="मैदान">
              <select value={ground} onChange={(e) => setGround(e.target.value)} style={inputStyle}>
                <option>मिट्टी का मैदान, कम सामान</option>
                <option>घास, कोन-बॉल हैं</option>
                <option>छोटी जगह, 2-3 बॉल</option>
              </select>
            </Field>
          </div>
          <Btn primary onClick={generateThinking} disabled={loading}>{loading ? "Technical director सोच रहे हैं…" : "पहले सोच देखो →"}</Btn>
          {err && <div className="body" style={{ color: C.laterite, fontSize: 13, marginTop: 10 }}>{err}</div>}
        </Card>
      )}
      {stage === "thinking" && (
        <div>
          <Card style={{ borderColor: C.gold }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="display" style={{ fontSize: 18, color: C.gold }}>Director की सोच</span>
              <Tag>{pathStage.age} • {philObj.hi}</Tag>
            </div>
            <div className="body" style={{ fontSize: 15, color: C.chalk, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{thinking}</div>
          </Card>
          <Btn primary onClick={generatePlan} disabled={loading}>{loading ? "प्लान बन रहा है…" : "इस सोच से प्लान बनाओ →"}</Btn>
          <div style={{ height: 8 }} />
          <Btn onClick={generateThinking} disabled={loading}>सोच दोबारा</Btn>
          <div style={{ height: 8 }} />
          <Btn onClick={reset} disabled={loading} style={{ border: "none", color: C.chalkDim }}>← वापस</Btn>
          {err && <div className="body" style={{ color: C.laterite, fontSize: 13, marginTop: 10 }}>{err}</div>}
        </div>
      )}
      {stage === "plan" && plan && (
        <div>
          <PlanView plan={plan} philName={philObj.hi} diagrams={diagrams} make={makeDiagram} onVariety={variety} varietyLoading={varietyLoading} />
          <Btn primary onClick={savePlan} disabled={saved}>{saved ? "✓ Plan save हो गया" : "💾 Plan save करो"}</Btn>
          <div style={{ height: 8 }} />
          <Btn onClick={reset}>नया सेशन बनाओ</Btn>
          {err && <div className="body" style={{ color: C.laterite, fontSize: 13, marginTop: 10 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

// ============ SAVED PLANS ============
function MyPlans() {
  const [plans, setPlans] = useState(null);
  const [open, setOpen] = useState(null);
  const [diagrams, makeDiagram] = useDiagrams();
  useEffect(() => { db("list_plans").then((r) => setPlans(r.plans)).catch(() => setPlans([])); }, []);
  if (open) {
    const p = open.payload;
    const philName = (PHILOSOPHIES.find((x) => x.id === p.phil) || {}).hi;
    return (
      <div style={{ padding: 20 }}>
        <Chip onClick={() => setOpen(null)} textColor={C.chalkDim}>← सारे प्लान</Chip>
        <div style={{ height: 12 }} />
        {p.thinking && (
          <Card style={{ borderColor: C.gold }}>
            <div className="display" style={{ fontSize: 16, color: C.gold, marginBottom: 6 }}>उस दिन की सोच</div>
            <div className="body" style={{ fontSize: 14, color: C.chalk, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{p.thinking}</div>
          </Card>
        )}
        <PlanView plan={p} philName={philName} diagrams={diagrams} make={makeDiagram} />
      </div>
    );
  }
  return (
    <div style={{ padding: 20 }}>
      <div className="display" style={{ fontSize: 26, color: C.chalk }}>मेरे प्लान</div>
      <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 16 }}>हर save किया हुआ सेशन — दोबारा खोलो, दोबारा खेलो।</div>
      {plans === null && <div className="body" style={{ color: C.chalkDim }}>लोड हो रहा है…</div>}
      {plans && plans.length === 0 && <Card><div className="body" style={{ color: C.chalkDim, fontSize: 14 }}>अभी कोई plan save नहीं है।</div></Card>}
      {plans && plans.map((p) => (
        <button key={p.id} onClick={() => setOpen(p)} className="body fade-up" style={{
          display: "block", width: "100%", textAlign: "left", background: C.pitchDeep,
          border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10, cursor: "pointer",
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.chalk }}>{p.title}</div>
          <div style={{ fontSize: 12, color: C.chalkDim, marginTop: 2 }}>
            {new Date(p.created_at).toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" })}
            {p.payload?.focus ? ` • ${p.payload.focus}` : ""}{p.payload?.age ? ` • ${p.payload.age} साल` : ""}
          </div>
        </button>
      ))}
    </div>
  );
}

// ============ REPORTS ============
function mondayOf(d = new Date()) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function Reports({ coach }) {
  const [form, setForm] = useState({ week_start: mondayOf(), sessions: "", avg_attendance: "", went_well: "", challenge: "", kaizen_moment: "" });
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const dateStr = new Date(form.week_start).toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" });
    const text = `📋 NVFC साप्ताहिक रिपोर्ट
━━━━━━━━━━━━━━━━━━━━
कोच: ${coach.name}
हफ़्ता: ${dateStr}
सेशन: ${form.sessions || "—"} | औसत हाज़िरी: ${form.avg_attendance || "—"} बच्चे

✅ क्या अच्छा हुआ:
${form.went_well || "—"}

⚠️ क्या मुश्किल रही:
${form.challenge || "—"}

改善 कैज़ेन moment:
${form.kaizen_moment || "—"}
━━━━━━━━━━━━━━━━━━━━
NVFC — Narmada Valley Football Club
जय सेवा 🙏`;
    setReport(text);
    setCopied(false);
  };

  const copy = () => {
    const el = document.createElement("textarea");
    el.value = report;
    el.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(el);
    el.focus(); el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const reset = () => { setReport(null); setCopied(false); setForm({ week_start: mondayOf(), sessions: "", avg_attendance: "", went_well: "", challenge: "", kaizen_moment: "" }); };

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 130px)" }}>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Weekly Report</div>
      <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16, marginTop: 2 }}>Fill → Generate → Copy to WhatsApp or diary.</div>

      {!report && (
        <Card>
          <Field label="हफ़्ता (सोमवार)">
            <input type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="कितने सेशन हुए?">
              <input type="number" inputMode="numeric" value={form.sessions} onChange={(e) => setForm({ ...form, sessions: e.target.value })} style={inputStyle} placeholder="3" />
            </Field>
            <Field label="औसत हाज़िरी">
              <input type="number" inputMode="numeric" value={form.avg_attendance} onChange={(e) => setForm({ ...form, avg_attendance: e.target.value })} style={inputStyle} placeholder="18" />
            </Field>
          </div>
          <Field label="क्या अच्छा हुआ?">
            <textarea rows={2} value={form.went_well} onChange={(e) => setForm({ ...form, went_well: e.target.value })} style={{ ...inputStyle, resize: "none" }} placeholder="बच्चों ने पहली बार खुद rondo शुरू किया…" />
          </Field>
          <Field label="क्या मुश्किल रही?">
            <textarea rows={2} value={form.challenge} onChange={(e) => setForm({ ...form, challenge: e.target.value })} style={{ ...inputStyle, resize: "none" }} placeholder="बारिश से मैदान गीला, दो बॉल पंक्चर…" />
          </Field>
          <Field label="इस हफ़्ते का कैज़ेन moment (एक बच्चे की छोटी जीत)">
            <textarea rows={2} value={form.kaizen_moment} onChange={(e) => setForm({ ...form, kaizen_moment: e.target.value })} style={{ ...inputStyle, resize: "none" }} placeholder="गुड़िया ने पहली बार weak foot से pass दिया…" />
          </Field>
          <Btn primary onClick={generate}>📋 रिपोर्ट बनाओ</Btn>
        </Card>
      )}

      {report && (
        <div>
          <Card style={{ borderColor: C.gold }}>
            <div className="body" style={{ fontSize: 14, color: C.chalk, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{report}</div>
          </Card>
          <Btn primary onClick={copy} style={{ marginBottom: 8 }}>{copied ? "✓ कॉपी हो गई!" : "📋 कॉपी करो — WhatsApp / डायरी"}</Btn>
          <div style={{ height: 8 }} />
          <Btn onClick={reset}>← नई रिपोर्ट बनाओ</Btn>
        </div>
      )}
    </div>
  );
}

// ============ SAHAYAK ============
function Sahayak({ coach }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: `Hello Coach ${coach.name}! जय सेवा 🙏 मैं NVFC सहायक हूँ। मैदान की कोई भी बात पूछो — ड्रिल, बच्चों का मन, अनुशासन, चोट से बचाव — जो भी।` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [extras, setExtras] = useState({});
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const enrich = async (i, content) => {
    setExtras((e) => ({ ...e, [i]: "loading" }));
    try {
      const sys = DIAGRAM_SYS.replace('"note":"one short Hindi line"}', '"note":"one short Hindi line","yt":"english youtube search query closest to this drill"}');
      const raw = await callClaude([{ role: "user", content: `Drill/advice: ${content.slice(0, 1200)}` }], sys, 900);
      setExtras((e) => ({ ...e, [i]: parseJSON(raw) }));
    } catch (err) { setExtras((e) => ({ ...e, [i]: "error" })); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setLoading(true);
    try {
      const history = next.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const reply = await callClaude(history, BASE_CONTEXT + "\n\n" + MASTER_CURRICULUM + "\n\nKeep replies short and practical — a coach reads this on the ground, on a phone. If the coach mentions an age, answer within that stage's rules — never suggest what the stage forbids. When you suggest a drill, remind the coach to tap the diagram button below your message.", 900);
      setMsgs((m) => [...m, { role: "assistant", content: reply || "…" }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "नेटवर्क में दिक्कत — फिर भेजो।" }]);
    }
    setLoading(false);
  };

  const starters = ["बच्चे ball देखते हैं, space नहीं — drill बताओ", "वही drill बच्चों को बोरिंग लग रही है", "बारिश में सेशन कैसे करें?"];

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Coach Assistant</div>
      <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 12, marginTop: 2 }}>मैदान का साथी — Hindi में, सीधा जवाब</div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
        {msgs.map((m, i) => (
          <div key={i} className="fade-up" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div className="body" style={{
                maxWidth: "85%", padding: "10px 14px", borderRadius: 14, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap",
                background: m.role === "user" ? C.laterite : C.pitchDeep, color: C.chalk,
                border: m.role === "user" ? "none" : `1px solid ${C.line}`,
                borderBottomRightRadius: m.role === "user" ? 4 : 14, borderBottomLeftRadius: m.role === "user" ? 14 : 4,
              }}>{m.content}</div>
            </div>
            {m.role === "assistant" && i > 0 && (
              <div style={{ maxWidth: "85%" }}>
                {extras[i] && extras[i] !== "loading" && extras[i] !== "error" && (
                  <>
                    <PitchDiagram spec={extras[i]} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {getPriorityVideos(m.content, extras[i].yt || "").map((v) => (
                        <Chip key={v.u} href={v.u} color={C.gold} textColor={C.gold}>{v.t}</Chip>
                      ))}
                      {extras[i].yt && <Chip href={ytLink(extras[i].yt)}>▶ और वीडियो खोजो</Chip>}
                    </div>
                  </>
                )}
                {!extras[i] && <div style={{ marginTop: 6 }}><Chip onClick={() => enrich(i, m.content)} textColor={C.chalkDim}>📐 डायग्राम + वीडियो</Chip></div>}
                {extras[i] === "loading" && <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginTop: 6 }}>डायग्राम बन रहा है…</div>}
                {extras[i] === "error" && <div style={{ marginTop: 6 }}><Chip onClick={() => enrich(i, m.content)} color={C.laterite} textColor={C.laterite}>फिर कोशिश करो</Chip></div>}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="body" style={{ color: C.chalkDim, fontSize: 13 }}>सहायक लिख रहा है…</div>}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
          {starters.map((s) => <Chip key={s} onClick={() => setInput(s)} textColor={C.chalkDim}>{s}</Chip>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder="यहाँ पूछो…" className="body"
          style={{ flex: 1, resize: "none", ...inputStyle, background: C.pitchDeep }} />
        <Btn primary onClick={send} disabled={loading || !input.trim()} style={{ width: "auto", padding: "12px 16px" }}>भेजो</Btn>
      </div>
    </div>
  );
}

// ============ NVFA PRINCIPLES KNOWLEDGE BASE ============
// Source: Coaching the Bielsa Way + Youth Development Coaching (TheFootballCoach)
// Organised by Principle → Why It Exists → Drills as Evidence

const NVFA_PRINCIPLES = [
  {
    phase: "In Possession",
    icon: "⚽",
    color: "#2e7d4f",
    principles: [
      {
        name: "Switch of Play",
        hindi: "खेल बदलना",
        why: "When one side is overloaded or under pressure, switching the point of attack forces the opponent to reorganise — creating space on the opposite side. Bielsa uses this constantly to move the opponent's defensive block before penetrating.",
        game_connection: "Build → Progress → Create",
        coaching_points: [
          "Open body position to receive and switch in one action",
          "Use disguise — don't telegraph the switch",
          "Timing is critical — switch when opponent commits, not before",
          "The receiving player must be ready to attack space immediately"
        ],
        common_mistakes: [
          "Switching too slowly — defender recovers before ball arrives",
          "Telegraphing the pass with eyes and body",
          "Receiving player stands still instead of moving to create angle"
        ],
        questions_for_players: [
          "When is the right moment to switch — what triggers it?",
          "What does the player receiving the switch need to do before the ball arrives?",
          "Why do we switch — what are we trying to create?"
        ],
        drills: [
          {
            name: "4v4+2 Switching Play Practice",
            source: "Youth Development Coaching",
            format: "4v4 in each half + 2 neutral players between halves",
            must: "Try to switch or change the point of attack",
            might: "Recognise high-pressure areas in order to play away",
            could: "Isolate the opponent into wide area to win the ball back",
            desc: "4v4 occurs in each half. Two neutral players positioned between halves can receive and combine to switch the attack to the opposite half. Different rules: 1) Neutrals cannot play forward 2) Players can drop into each zone creating 2v2 centrally.",
            individual_objectives: [
              "Open body position to be able to switch play",
              "Use of disguise to prevent opponent covering the switch",
              "Timing is critical — ensure forward passes are played through when possible"
            ],
            age: "12-16", players: "10+2", principle_tags: ["Switch of Play", "Width", "Support"]
          }
        ]
      },
      {
        name: "Penetration",
        hindi: "घुसपैठ",
        why: "The ultimate objective in possession is to penetrate the opponent's defensive structure — to play through or beyond the defensive line. Every other in-possession principle exists to create the conditions for penetration.",
        game_connection: "Create → Finish",
        coaching_points: [
          "Look for penetrating passes first — only recycle if not available",
          "Third-man runs: player A plays to B, B plays to C who has run beyond",
          "Timing of run must synchronise with the pass",
          "Attack the space behind the defensive line, not the defender"
        ],
        common_mistakes: [
          "Running too early — triggering offside or allowing defender to track",
          "Playing backwards when a forward option exists",
          "Failing to recognise when the gate is open"
        ],
        questions_for_players: [
          "What is penetration and when is it available?",
          "What does the third man need to do to get free?",
          "How does movement off the ball create penetration opportunities?"
        ],
        drills: [
          {
            name: "2v2+2 Combination Practice",
            source: "Youth Development Coaching",
            format: "2v2 in middle zone + end players at each end",
            must: "Try and play through the opponent",
            might: "Try to run beyond the opponent once a pass has been played",
            could: "Look to be narrow and prevent opponent playing through",
            desc: "2v2 in the middle. Each pair attacks two mini-goals at opposite end. They can play into an end-player between opponents' goal, then make a third-man run into space behind the defensive line to receive and score.",
            individual_objectives: [
              "Play through the opponent when you regain the ball",
              "Focus on technique of playing first time (moving ball)",
              "Encourage running without the ball — beyond the opponent"
            ],
            gps: { meters_per_min: 90, accel_per_min: 5.2, sprint_per_min: 0, work_mins: 4, rest_mins: 1, blocks: 5 },
            age: "12-16", players: "6", principle_tags: ["Penetration", "Movement", "Third Man"]
          },
          {
            name: "4v4+2 Combination Practice",
            source: "Youth Development Coaching",
            format: "4v4 locked into quadrant + 1-2 neutral players",
            must: "Try and move the ball quickly under pressure from the opponent",
            might: "Recognise how and when to drop in to create 2v1s",
            could: "Out-of-possession transition quickly and apply pressure",
            desc: "4v4 where the team in-possession are locked into a quarter of the zone. Team out-of-possession can move freely to regain the ball. If they win it, they must move quickly to a quadrant. 1-2 neutral players help create overloads.",
            individual_objectives: [
              "Recognise when to move the ball and when to protect it",
              "Open shoulders to keep play in sight",
              "Recognise transition moments"
            ],
            age: "12-16", players: "10+2", principle_tags: ["Penetration", "Support", "Transition to Attack"]
          }
        ]
      },
      {
        name: "Support & Overloads",
        hindi: "साथ और अधिकता",
        why: "Numerical superiority (more attackers than defenders in a zone) is the foundation of Bielsa's positional play. Creating a +1 overload gives the team in possession a free player — someone who can always receive, turn and progress.",
        game_connection: "Build → Progress",
        coaching_points: [
          "The '+1' player is the key — identify them and use them",
          "Support angles: never stand in a straight line with the ball carrier",
          "Create triangles — three options always available",
          "The free player should always be moving to maintain their advantage"
        ],
        common_mistakes: [
          "Standing in a straight line — easily marked",
          "Supporting too close — compressing space",
          "Supporting too far — not accessible under pressure"
        ],
        questions_for_players: [
          "Where is the free player — the +1?",
          "What angle should you support at to get the ball?",
          "How do you stay free once you have the advantage?"
        ],
        drills: [
          {
            name: "6v6+1 Possession Practice",
            source: "Youth Development Coaching",
            format: "6v6 with 1 permanent neutral player",
            must: "Try and Take Advantage of 4v3 Centrally",
            might: "Try and Receive on Half-Turn",
            could: "Try and Switch to Stay on Ball",
            desc: "6v6 possession practice with a neutral player who always plays with the team in possession, creating a permanent overload. Teams must recognise and exploit the numerical advantage.",
            individual_objectives: [
              "Identify the overload and exploit it quickly",
              "Receive on the half-turn to face forward",
              "Use the neutral to switch and maintain possession"
            ],
            gps: { meters_per_min: 75, accel_per_min: 0.2, sprint_per_min: 0, work_mins: 4, rest_mins: 1, blocks: 1 },
            age: "13-16", players: "13", principle_tags: ["Support", "Width", "Penetration"]
          }
        ]
      },
      {
        name: "Positional Play",
        hindi: "स्थितिगत खेल",
        why: "Bielsa's positional play is about occupying spaces intelligently so that the team always has passing options and can move the ball in any direction. It is not about formation — it is about creating structure that the opponent cannot defend.",
        game_connection: "Build → Progress → Create",
        coaching_points: [
          "Occupy all five lanes of the pitch — don't cluster",
          "The player with the ball needs three passing options minimum",
          "Spacing: players should be approximately 10-15m apart",
          "Before receiving, scan — know your next action"
        ],
        common_mistakes: [
          "Clustering around the ball — losing width and depth",
          "Receiving with back to goal when forward facing was available",
          "Not scanning before receiving — slow decisions"
        ],
        questions_for_players: [
          "What is your position's job in this moment?",
          "Where is the space — and who should be occupying it?",
          "Before you receive, what do you already know?"
        ],
        drills: [
          {
            name: "6v6+6 Positional Practice",
            source: "Youth Development Coaching",
            format: "6v6 possession in central zone + 6 fixed wide/end players",
            must: "Try and Take Advantage of 4v3 Centrally",
            might: "Try and Receive on Half-Turn",
            could: "Try and Switch to Stay on Ball",
            desc: "Positional practice where 6 fixed outside players create a scaffold. The central 6v6 must use outside players to progress and maintain possession while outnumbering opponents centrally.",
            individual_objectives: [
              "Understand your role within the positional structure",
              "Scan before receiving to make faster decisions",
              "Use outside players to release central pressure"
            ],
            age: "13-16", players: "18", principle_tags: ["Positional Play", "Support", "Width"]
          },
          {
            name: "3v3+3 Positional Rondo",
            source: "Youth Development Coaching",
            format: "3v3 in central grid + 3 outside neutral players",
            must: "Play around pressure and look to move the point of control",
            might: "Play into final third and run beyond when required",
            could: "Play first time to progress the practice",
            desc: "3v3 in the middle with 3 neutral outside players. Team in possession uses outside players to maintain possession and progress. Develops understanding of how outside players create options and how to use the third man.",
            age: "12-16", players: "9", principle_tags: ["Positional Play", "Rondo", "Support"]
          }
        ]
      }
    ]
  },
  {
    phase: "Out of Possession",
    icon: "🛡️",
    color: "#c4502a",
    principles: [
      {
        name: "Pressing & Counter-Press",
        hindi: "दबाव देना",
        why: "Bielsa's pressing is about winning the ball back immediately after losing it — within 5 seconds. This is counter-pressing: the most dangerous moment to press is when the opponent has just received because they are unorganised. Every player must understand their role in the press.",
        game_connection: "Press → Delay → Recover",
        coaching_points: [
          "Trigger: press immediately when ball is lost — 5 second rule",
          "Nearest player presses the ball carrier — force one direction",
          "Second player covers the most dangerous passing lane",
          "Team must stay compact — cannot leave spaces between lines",
          "Press with intensity — half-hearted pressing is worse than no pressing"
        ],
        common_mistakes: [
          "Pressing too slowly — opponent reorganises",
          "Individual pressing — team must press as a unit",
          "Pressing without covering passing lanes — ball escapes easily",
          "Dropping too deep after losing the ball instead of counter-pressing"
        ],
        questions_for_players: [
          "What is the trigger for the press?",
          "What is your job when the nearest player presses?",
          "How do we press as a team — not as individuals?"
        ],
        drills: [
          {
            name: "5v5 Counter-Pressing Game",
            source: "Youth Development Coaching",
            format: "5v5 in defined zone with transition pressing trigger",
            must: "Apply pressure to the ball as quickly as possible",
            might: "Try to prevent the opponent playing forward",
            could: "Look to switch play to the opposite half on regaining possession",
            desc: "5v5 game where on losing possession the team immediately counter-presses. First team to regain ball must then build through their structure. Trains the habit of immediate pressure on transition.",
            individual_objectives: [
              "Press immediately on losing possession",
              "Prevent the opponent playing forward",
              "React to transition quickly — both phases"
            ],
            age: "13-16", players: "10", principle_tags: ["Counter-Press", "Transition to Defend", "Compactness"]
          },
          {
            name: "5v2 Possession and Counter-Press",
            source: "Youth Development Coaching",
            format: "5v2 rondo with pressing trigger on ball loss",
            must: "Try and disguise passes",
            might: "Try to play first time to prevent pressure",
            could: "Counter-press when reds regain the ball",
            desc: "5v2 rondo where the two defenders must immediately counter-press after the ball is won. Develops both possession quality under pressure and immediate pressing response.",
            age: "12-16", players: "7", principle_tags: ["Counter-Press", "Possession", "Rondo"]
          }
        ]
      },
      {
        name: "Defending 1v1",
        hindi: "एक बनाम एक रक्षा",
        why: "Bielsa's man-to-man system demands that every defender wins their individual duel. There is nowhere to hide — if your player beats you, the press is broken. Defending 1v1 is therefore the foundation of his entire defensive system.",
        game_connection: "Delay → Recover",
        coaching_points: [
          "Get goal-side first — your position matters before the duel starts",
          "Delay: do not dive in — force the attacker to one side",
          "Stay on your feet — tackle only when the moment is right",
          "Force the attacker away from goal — towards the touchline or backward",
          "Anticipate: read the attacker's body shape before they touch the ball"
        ],
        common_mistakes: [
          "Diving in — committing too early, being beaten easily",
          "Ball-watching instead of player-watching",
          "Getting ball-side instead of goal-side",
          "Not recovering quickly after being beaten"
        ],
        questions_for_players: [
          "What position should you be in before the attacker receives the ball?",
          "When is the right moment to make the tackle?",
          "What are you forcing the attacker to do — and why?"
        ],
        drills: [
          {
            name: "Profiled Turn 1v1 Practice",
            source: "Coaching the Bielsa Way",
            format: "1v1 with directional start positions",
            must: "Win the ball or force backward",
            might: "Anticipate the attacker's direction from body shape",
            could: "Force the attacker wide and contain",
            desc: "Attacker starts with ball and attempts to beat the defender and attack the goal. Defender works on positioning, delaying, forcing one direction and winning the tackle at the right moment. From Bielsa's 1v1 defending chapter.",
            age: "13+", players: "2", principle_tags: ["1v1 Defending", "Delay", "Discipline"]
          }
        ]
      },
      {
        name: "Compactness & Shape",
        hindi: "संगठन और आकार",
        why: "When out of possession, the team must remain compact — limiting the space between lines so the opponent cannot play through. Bielsa's pressing only works if the team maintains its shape; if players are spread, gaps appear and the press is defeated.",
        game_connection: "Delay → Recover",
        coaching_points: [
          "Distance between lines: no more than 10-12m when defending deep",
          "Everyone shifts together — no individual decisions",
          "Block central lanes first — force play wide",
          "When opponent switches, the whole team shifts together",
          "Stay compact until the trigger — then press as a unit"
        ],
        common_mistakes: [
          "Individual players stepping out — breaking the defensive block",
          "Too much distance between lines — opponent plays through",
          "Shifting too slowly — leaving gaps when ball switches"
        ],
        questions_for_players: [
          "What is your job when the ball goes to the opposite side?",
          "How close should the lines be when defending?",
          "What is the trigger to step out and press?"
        ],
        drills: [
          {
            name: "Defending Practices: Blocking the Opponent",
            source: "Coaching the Bielsa Way",
            format: "Structured defensive shape against attacking patterns",
            must: "Maintain compact shape and block central passing lanes",
            might: "Force the opponent wide and prevent penetration",
            could: "Win the ball and transition to attack quickly",
            desc: "Defensive shape practice from Bielsa Way. Defenders work on maintaining block, shifting as a unit when ball is switched, and identifying the trigger to step out and press. Develops collective defensive intelligence.",
            age: "14+", players: "8-11", principle_tags: ["Compactness", "Delay", "Discipline"]
          }
        ]
      }
    ]
  },
  {
    phase: "Transition",
    icon: "⚡",
    color: "#d9a441",
    principles: [
      {
        name: "Transition to Attack",
        hindi: "आक्रमण में बदलाव",
        why: "The moment of winning the ball is the most dangerous attacking moment — the opponent is disorganised and the space is open. Bielsa trains his teams to transition immediately and play forward within seconds of winning possession.",
        game_connection: "Press → Create → Finish",
        coaching_points: [
          "First pass forward if available — don't recycle after winning the ball",
          "Runners beyond the ball must go immediately",
          "The player who wins the ball must make a simple pass — not dribble",
          "Attack the open space at speed before the opponent recovers"
        ],
        common_mistakes: [
          "Taking too many touches after winning possession",
          "Playing sideways or backward — losing the transition advantage",
          "Runners being too slow — opponent recovers before ball arrives"
        ],
        questions_for_players: [
          "What do you do in the first 3 seconds after winning the ball?",
          "Where is the space — and who should be attacking it?",
          "Why do we play forward immediately on transition?"
        ],
        drills: [
          {
            name: "Rondo Breakout Game",
            source: "Youth Development Coaching",
            format: "4v1 rondos on both sides + central gate",
            must: "Play around pressure and look to move the point of control",
            might: "Play into final third and run beyond when required",
            could: "Play first time to progress the practice",
            desc: "4v1 Rondos on both sides of the pitch. First team to steal the ball must immediately transition and attack through the central gate before the opponent reorganises. Trains the habit of instant forward transition.",
            age: "12-16", players: "10", principle_tags: ["Transition to Attack", "Counter-Press", "Penetration"]
          }
        ]
      },
      {
        name: "Transition to Defend",
        hindi: "रक्षा में बदलाव",
        why: "When possession is lost, the team must immediately reorganise defensively. Bielsa demands that counter-pressing starts within 5 seconds — but if that fails, the team must recover into defensive shape before the opponent can attack.",
        game_connection: "Press → Delay → Recover",
        coaching_points: [
          "5-second rule: counter-press immediately or recover into shape",
          "Sprint back — not jog — to get goal-side",
          "Nearest player delays the attacker — buys time for recovery",
          "Recover to your defensive position, not just near the ball"
        ],
        common_mistakes: [
          "Jogging back instead of sprinting",
          "Everyone chasing the ball — leaving defensive positions empty",
          "Not tracking runners — watching the ball only"
        ],
        questions_for_players: [
          "What is the first thing you do when we lose the ball?",
          "If counter-press fails, where do you recover to?",
          "What is your job when the nearest player is pressing?"
        ],
        drills: [
          {
            name: "5v5 Transition Game",
            source: "Youth Development Coaching",
            format: "5v5 with instant transition trigger",
            must: "React immediately to transition — both attack and defend",
            might: "Apply pressure within 5 seconds of losing possession",
            could: "Recover into defensive shape if pressing fails",
            desc: "5v5 game with clear transition triggers. On losing possession, team immediately counter-presses. If ball is not won in 5 seconds, they recover into defensive shape. Trains the dual nature of transition.",
            age: "13-16", players: "10", principle_tags: ["Transition to Defend", "Counter-Press", "Compactness"]
          }
        ]
      }
    ]
  },
  {
    phase: "Rondos",
    icon: "🔄",
    color: "#1565c0",
    principles: [
      {
        name: "Why Rondos Exist",
        hindi: "रोंडो क्यों?",
        why: "Rondos are Bielsa's training foundation. They are not warm-up games — they are the purest training environment for all football principles: possession under pressure, pressing triggers, quick decision-making, playing through, and scanning. Every principle can be trained in a rondo.",
        game_connection: "All phases",
        coaching_points: [
          "The player in the middle is the most important teacher — their pressing teaches the others",
          "One touch rondos develop speed of thought, not just speed of pass",
          "The rondo is a microcosm of the game — treat it with the same intensity",
          "Counting touches aloud builds awareness of own decisions"
        ],
        common_mistakes: [
          "Playing rondo as a warm-up — no intensity, no pressing",
          "Not pressing hard enough in the middle",
          "Only playing safe passes — not looking to penetrate",
          "No scanning before receiving"
        ],
        questions_for_players: [
          "What is the rondo teaching you about the real game?",
          "What does the player in the middle need to do to win the ball?",
          "How does your first touch affect your next decision?"
        ],
        drills: [
          {
            name: "Basic Rondo (4v1 / 5v1 / 6v2)",
            source: "Coaching the Bielsa Way",
            format: "Circular possession with defenders in middle",
            must: "Maintain possession and play quickly under pressure",
            might: "Use one touch when possible to progress the ball",
            could: "Force the middle player to commit before playing",
            desc: "Classic rondo. Outside players maintain possession against middle defender(s). Core training tool from Bielsa's methodology. Develops: scanning, first touch, decision speed, pressing shape.",
            age: "All", players: "5-8", principle_tags: ["Rondo", "Possession", "Pressing"]
          },
          {
            name: "Progression Rondo",
            source: "Coaching the Bielsa Way",
            format: "Rondo with directional objective — must progress through gate",
            must: "Maintain possession and progress through the target gate",
            might: "Use the free player to break the press",
            could: "Switch to the opposite gate when primary gate is closed",
            desc: "Progression rondo from Bielsa Way. Adds directional objective — team must work through a gate while maintaining possession. Connects rondo possession to real game penetration objective.",
            age: "12+", players: "7-9", principle_tags: ["Rondo", "Penetration", "Positional Play"]
          },
          {
            name: "Progression Rondo — Full-Back Role",
            source: "Coaching the Bielsa Way",
            format: "Rondo with full-back overlap trigger",
            must: "Recognise when to trigger the full-back overlap",
            might: "Use full-back to create numerical superiority",
            could: "Switch play when full-back is covered",
            desc: "Rondo variation specifically training the full-back's attacking role. When the full-back receives in the rondo, they must trigger an overlap or underlap. Connects rondo to real positional responsibilities.",
            age: "13+", players: "8-10", principle_tags: ["Rondo", "Width", "Positional Play"]
          },
          {
            name: "Counter Press Rondo",
            source: "Coaching the Bielsa Way",
            format: "Rondo with immediate pressing trigger on ball loss",
            must: "Counter-press immediately when possession is lost",
            might: "Win the ball back within 5 seconds of losing it",
            could: "Force the opponent into error through collective pressure",
            desc: "Rondo where when the middle player wins the ball, the roles immediately reverse and the previous possessors must counter-press. The most intense rondo form — trains both possession and pressing within the same drill.",
            age: "13+", players: "7-9", principle_tags: ["Counter-Press", "Transition", "Rondo"]
          }
        ]
      }
    ]
  },
  {
    phase: "Build Up Play",
    icon: "🏗️",
    color: "#4a148c",
    principles: [
      {
        name: "Building from the Back",
        hindi: "पीछे से खेल बनाना",
        why: "Building from the back is about creating numerical superiority in your own half to bypass the opponent's press and arrive in midfield with possession. Bielsa demands his goalkeepers and defenders are comfortable under pressure — they are the first attackers.",
        game_connection: "Build → Progress",
        coaching_points: [
          "GK is the first attacker — must be able to play out under pressure",
          "Centre-backs split wide to create width in buildup",
          "One holding midfielder drops to create passing triangle with CBs",
          "The free player — find them immediately and play to them",
          "If pressed, go direct — do not force buildup into a press trap"
        ],
        common_mistakes: [
          "Playing backward when forward pass is available",
          "Not splitting wide enough — giving defenders no angle",
          "Playing into the press — not recognising the trigger to go direct"
        ],
        questions_for_players: [
          "What is the GK's role in buildup play?",
          "Where should the centre-backs be when we are building?",
          "How do we know when to play through the press vs go direct?"
        ],
        drills: [
          {
            name: "Build-Up Play Practice",
            source: "Coaching the Bielsa Way",
            format: "GK + defenders building against pressing forwards",
            must: "Build through the press and arrive in midfield with possession",
            might: "Use the GK as an active participant — not just a goalkeeper",
            could: "Recognise when to go direct rather than build through",
            desc: "From Bielsa Way build-up chapter. GK and defenders work on breaking opponent's first press line. Structured buildup shapes and triggers. Develops understanding of the GK's role as first outfield player.",
            age: "14+", players: "8-11", principle_tags: ["Build Up", "GK", "Positional Play"]
          }
        ]
      }
    ]
  }
];

const NVFA_WAY = {
  attack: ["Build", "Progress", "Create", "Finish"],
  defend: ["Press", "Delay", "Recover"],
  transitions: ["Transition to Attack", "Transition to Defend"],
  philosophy: "Organise knowledge around principles. Drills are evidence and examples of principles — not the other way around.",
  bielsa_core: [
    "Work-rate is non-negotiable — physical intensity underpins every principle",
    "Man-to-man marking demands every player wins their individual duel",
    "The +1 overload — always create numerical superiority in the zone of the ball",
    "Play vertically when possible — horizontal possession is preparation, not the goal",
    "Third-man runs — three-player combinations to penetrate defensive blocks",
    "Counter-pressing: the 5-second rule — win it back or recover shape"
  ]
};
// ============ PRINCIPLES TAB ============
function Principles() {
  const [openPhase, setOpenPhase] = useState("In Possession");
  const [openPrinciple, setOpenPrinciple] = useState(null);
  const [openDrill, setOpenDrill] = useState(null);
  const [showWay, setShowWay] = useState(false);

  const phase = NVFA_PRINCIPLES.find(p => p.phase === openPhase);

  const phaseColorClass = {
    "In Possession": "phase-possess",
    "Out of Possession": "phase-defend",
    "Transition": "phase-transit",
    "Rondos": "phase-rondo",
    "Build Up Play": "phase-build",
  };

  return (
    <div style={{ padding: "16px 16px 0", overflowY: "auto", height: "calc(100vh - 130px)" }}>

      {/* NVFA WAY CARD */}
      <div className="fade-up" style={{
        background: `linear-gradient(135deg, ${C.surface2} 0%, ${C.surface} 100%)`,
        border: `1px solid ${C.goldLine}`,
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="display" style={{ fontSize: 13, fontWeight: 700, color: C.gold, letterSpacing: "0.1em" }}>
              THE NVFA WAY
            </div>
            <div className="body" style={{ fontSize: 11, color: C.chalkDim, marginTop: 3, lineHeight: 1.5 }}>
              Principles first. Drills are evidence.
            </div>
          </div>
          <button onClick={() => setShowWay(!showWay)} className="body" style={{
            background: showWay ? C.goldDim : "transparent",
            border: `1px solid ${C.goldLine}`, color: C.gold,
            borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>{showWay ? "Close" : "View"}</button>
        </div>

        {/* Attack/Defend flow */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          {NVFA_WAY.attack.map((a, i) => (
            <span key={a} className="body" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ background: C.greenDim, color: C.green, border: `1px solid ${C.green}44`, padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{a}</span>
              {i < NVFA_WAY.attack.length - 1 && <span style={{ color: C.chalkFaint, fontSize: 10 }}>→</span>}
            </span>
          ))}
          <span style={{ color: C.chalkFaint, fontSize: 10, margin: "0 2px" }}>·</span>
          {NVFA_WAY.defend.map((d, i) => (
            <span key={d} className="body" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}44`, padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{d}</span>
              {i < NVFA_WAY.defend.length - 1 && <span style={{ color: C.chalkFaint, fontSize: 10 }}>→</span>}
            </span>
          ))}
        </div>

        {showWay && (
          <div className="fade-up" style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div className="body" style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Bielsa Core Principles
            </div>
            {NVFA_WAY.bielsa_core.map((p, i) => (
              <div key={i} className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${C.gold}44`, lineHeight: 1.5 }}>
                {p}
              </div>
            ))}
            <div className="body" style={{ fontSize: 10, color: C.chalkFaint, marginTop: 10, fontStyle: "italic" }}>
              Sources: Coaching the Bielsa Way + Youth Development Coaching
            </div>
          </div>
        )}
      </div>

      {/* PHASE SELECTOR */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
        {NVFA_PRINCIPLES.map(p => {
          const active = openPhase === p.phase;
          return (
            <button key={p.phase} onClick={() => { setOpenPhase(p.phase); setOpenPrinciple(null); setOpenDrill(null); }}
              className={`body ${phaseColorClass[p.phase] || ""}`} style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 8,
                border: "1px solid transparent", cursor: "pointer", fontSize: 11, fontWeight: 600,
                opacity: active ? 1 : 0.5, transition: "opacity .2s",
                ...(active ? {} : { background: "transparent", color: C.chalkDim, borderColor: C.border }),
              }}>
              {p.icon} {p.phase}
            </button>
          );
        })}
      </div>

      {/* PRINCIPLES LIST */}
      {phase && phase.principles.map((prin, pi) => (
        <div key={pi} style={{ marginBottom: 8 }}>
          {/* Principle row */}
          <button onClick={() => setOpenPrinciple(openPrinciple === pi ? null : pi)}
            className="body fade-up" style={{
              width: "100%", textAlign: "left",
              background: openPrinciple === pi ? C.surface2 : C.surface,
              border: `1px solid ${openPrinciple === pi ? phase.color + "55" : C.border}`,
              borderRadius: openPrinciple === pi ? "12px 12px 0 0" : 12,
              padding: "13px 16px", cursor: "pointer", transition: "all .2s",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div className="display" style={{ fontSize: 15, fontWeight: 700, color: C.chalk }}>{prin.name}</div>
                  <span className="body" style={{ fontSize: 10, color: C.chalkFaint }}>/ {prin.hindi}</span>
                </div>
                <div className="body" style={{ fontSize: 10, color: C.chalkDim, letterSpacing: "0.04em" }}>
                  {prin.game_connection} · {prin.drills.length} drill{prin.drills.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: openPrinciple === pi ? phase.color + "22" : C.surface2,
                border: `1px solid ${openPrinciple === pi ? phase.color + "55" : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: openPrinciple === pi ? phase.color : C.chalkDim, fontSize: 14, flexShrink: 0,
              }}>
                {openPrinciple === pi ? "−" : "+"}
              </div>
            </div>
          </button>

          {openPrinciple === pi && (
            <div className="fade-up" style={{
              background: C.surface2, border: `1px solid ${phase.color + "33"}`,
              borderTop: "none", borderRadius: "0 0 12px 12px", padding: "0 14px 14px",
            }}>

              {/* WHY */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginBottom: 12 }}>
                <div className="body" style={{ fontSize: 9, fontWeight: 700, color: phase.color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                  Why This Principle Exists
                </div>
                <div className="body" style={{ fontSize: 13, color: C.chalk, lineHeight: 1.7 }}>{prin.why}</div>
              </div>

              {/* Coaching Points */}
              <div style={{ background: C.surface, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div className="body" style={{ fontSize: 9, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                  🗣 Coaching Points
                </div>
                {prin.coaching_points.map((cp, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: phase.color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>→</span>
                    <span className="body" style={{ fontSize: 12, color: C.chalk, lineHeight: 1.55 }}>{cp}</span>
                  </div>
                ))}
              </div>

              {/* Mistakes + Questions in 2-col */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: C.surface, borderRadius: 10, padding: 10 }}>
                  <div className="body" style={{ fontSize: 9, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>⚠ Mistakes</div>
                  {prin.common_mistakes.map((m, i) => (
                    <div key={i} className="body" style={{ fontSize: 11, color: C.chalkDim, marginBottom: 4, lineHeight: 1.4 }}>• {m}</div>
                  ))}
                </div>
                <div style={{ background: C.surface, borderRadius: 10, padding: 10 }}>
                  <div className="body" style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>❓ Questions</div>
                  {prin.questions_for_players.map((q, i) => (
                    <div key={i} className="body" style={{ fontSize: 11, color: C.chalkDim, marginBottom: 4, fontStyle: "italic", lineHeight: 1.4 }}>"{q}"</div>
                  ))}
                </div>
              </div>

              {/* DRILLS HEADER */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <div className="body" style={{ fontSize: 9, color: C.chalkFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
                  Drills as Evidence
                </div>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>

              {prin.drills.map((drill, di) => (
                <div key={di} style={{ marginBottom: 6 }}>
                  <button onClick={() => setOpenDrill(openDrill === `${pi}-${di}` ? null : `${pi}-${di}`)}
                    className="body" style={{
                      width: "100%", textAlign: "left",
                      background: openDrill === `${pi}-${di}` ? C.surface : C.bg,
                      border: `1px solid ${openDrill === `${pi}-${di}` ? C.goldLine : C.border}`,
                      borderRadius: openDrill === `${pi}-${di}` ? "8px 8px 0 0" : 8,
                      padding: "10px 12px", cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div className="body" style={{ fontSize: 13, fontWeight: 600, color: C.chalk }}>{drill.name}</div>
                        <div className="body" style={{ fontSize: 10, color: C.chalkDim, marginTop: 2 }}>
                          {drill.format} · Age {drill.age} · {drill.source}
                        </div>
                      </div>
                      <span style={{ color: C.gold, fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                        {openDrill === `${pi}-${di}` ? "−" : "+"}
                      </span>
                    </div>
                  </button>

                  {openDrill === `${pi}-${di}` && (
                    <div className="fade-up" style={{
                      background: C.bg, border: `1px solid ${C.goldLine}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: 12,
                    }}>
                      {/* Must Might Could */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                        {drill.must && (
                          <div className="body" style={{ fontSize: 11, display: "flex", gap: 6 }}>
                            <span style={{ color: C.red, fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, marginTop: 1 }}>Must</span>
                            <span style={{ color: C.chalk }}>{drill.must}</span>
                          </div>
                        )}
                        {drill.might && (
                          <div className="body" style={{ fontSize: 11, display: "flex", gap: 6 }}>
                            <span style={{ color: C.gold, fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, marginTop: 1 }}>Might</span>
                            <span style={{ color: C.chalk }}>{drill.might}</span>
                          </div>
                        )}
                        {drill.could && (
                          <div className="body" style={{ fontSize: 11, display: "flex", gap: 6 }}>
                            <span style={{ color: C.green, fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, marginTop: 1 }}>Could</span>
                            <span style={{ color: C.chalk }}>{drill.could}</span>
                          </div>
                        )}
                      </div>

                      <div className="body" style={{ fontSize: 12, color: C.chalkDim, lineHeight: 1.65, marginBottom: 10 }}>{drill.desc}</div>

                      {drill.individual_objectives && (
                        <div style={{ marginBottom: 10 }}>
                          <div className="body" style={{ fontSize: 9, color: C.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Individual Objectives</div>
                          {drill.individual_objectives.map((obj, oi) => (
                            <div key={oi} className="body" style={{ fontSize: 11, color: C.chalk, marginBottom: 3 }}>• {obj}</div>
                          ))}
                        </div>
                      )}

                      {drill.gps && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                          {Object.entries(drill.gps).map(([k, v]) => (
                            <span key={k} className="body" style={{
                              background: C.surface2, color: C.chalkDim,
                              padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600,
                              border: `1px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.06em"
                            }}>
                              {k.replace(/_/g, ' ')}: {v}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                        {drill.principle_tags.map(tag => (
                          <span key={tag} className="body" style={{
                            background: phase.color + "22", color: phase.color,
                            border: `1px solid ${phase.color}44`,
                            padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em"
                          }}>{tag}</span>
                        ))}
                        <Chip href={ytLink(drill.name + " football drill")} textColor={C.chalkDim} color={C.border}>▶ Video</Chip>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="body" style={{ fontSize: 10, color: C.chalkFaint, textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
        2 books loaded · 24 more to add · knowledge grows with each book
      </div>
    </div>
  );
}

// ============ LIBRARY (Drills + GK + Videos) ============
function Library() {
  const [sub, setSub] = useState("drills");
  const [diagrams, makeDiagram] = useDiagrams();
  return (
    <div style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 130px)" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Chip onClick={() => setSub("drills")} color={sub === "drills" ? C.laterite : C.line} textColor={sub === "drills" ? C.laterite : C.chalkDim}>⚽ ड्रिल</Chip>
        <Chip onClick={() => setSub("gk")} color={sub === "gk" ? C.laterite : C.line} textColor={sub === "gk" ? C.laterite : C.chalkDim}>🧤 गोलची</Chip>
        <Chip onClick={() => setSub("videos")} color={sub === "videos" ? C.laterite : C.line} textColor={sub === "videos" ? C.laterite : C.chalkDim}>▶ वीडियो</Chip>
      </div>

      {sub === "drills" && (
        <>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Drill Library</div>
          <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16, marginTop: 2 }}>Minimal equipment. Maximum game. Every drill with its kaizen.</div>
          {DRILLS.map((d, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <span className="display" style={{ fontSize: 19, color: C.chalk }}>{d.hi}</span>
                  <span className="body" style={{ fontSize: 12, color: C.chalkDim, marginLeft: 8 }}>{d.en}</span>
                </div>
                <Tag>{d.age}</Tag>
              </div>
              <div className="body" style={{ fontSize: 14, color: C.chalkDim, marginTop: 8, lineHeight: 1.5 }}>{d.desc}</div>
              <div className="body" style={{ fontSize: 13, color: C.gold, marginTop: 8 }}>🗣 "{d.cue}"</div>
              <div className="body" style={{ fontSize: 13, color: C.grassLight, marginTop: 4, fontWeight: 700 }}>改善 कैज़ेन: {d.kaizen}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <DiagramBlock k={"d" + i} text={`${d.hi}. ${d.desc}`} diagrams={diagrams} make={makeDiagram} />
                <Chip href={ytLink(d.q)}>▶ वीडियो खोजो</Chip>
              </div>
            </Card>
          ))}
        </>
      )}

      {sub === "gk" && (
        <>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Goalkeeper 🧤</div>
          <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 8, marginTop: 2 }}>Coerver pyramid — applied to goalkeeping.</div>
          {GK_STAGES.map((s, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className="display" style={{ fontSize: 22, color: C.laterite }}>{s.n}</span>
                  <span className="display" style={{ fontSize: 19, color: C.chalk }}>{s.hi}</span>
                </div>
                <Tag>{s.coerver}</Tag>
              </div>
              <div className="body" style={{ fontSize: 14, color: C.chalkDim, marginTop: 8, lineHeight: 1.55 }}>{s.drill}</div>
              <div className="body" style={{ fontSize: 13, color: C.gold, marginTop: 8 }}>🗣 "{s.cue}"</div>
              <div className="body" style={{ fontSize: 13, color: C.grassLight, marginTop: 4, fontWeight: 700 }}>改善 कैज़ेन: {s.kaizen}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <DiagramBlock k={"g" + i} text={`GK: ${s.hi}. ${s.drill}`} diagrams={diagrams} make={makeDiagram} />
                {s.videos.map((v) => <Chip key={v.u} href={v.u} color={C.grass}>▶ {v.t}</Chip>)}
              </div>
            </Card>
          ))}
        </>
      )}

      {sub === "videos" && (
        <>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Video Library ▶</div>
          <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16, marginTop: 2 }}>Priority channels — check here first.</div>
          {VIDEO_LIBRARY.map((ch, ci) => (
            <Card key={ci} style={{ borderColor: C.gold }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div className="display" style={{ fontSize: 18, color: C.chalk }}>{ch.channel}</div>
                  <div className="body" style={{ fontSize: 12, color: C.chalkDim }}>{ch.handle} • {ch.focus}</div>
                </div>
                <Chip href={ch.url} color={C.gold} textColor={C.gold}>Channel →</Chip>
              </div>
              {ch.videos.map((v, vi) => (
                <a key={vi} href={v.u} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                  background: C.pitch, borderRadius: 10, marginBottom: 8, textDecoration: "none",
                  border: `1px solid ${C.line}`,
                }}>
                  <div style={{ width: 40, height: 40, background: "#ff0000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>▶</div>
                  <div>
                    <div className="body" style={{ fontSize: 14, color: C.chalk, fontWeight: 700 }}>{v.t}</div>
                    <div className="body" style={{ fontSize: 11, color: C.chalkDim, marginTop: 2 }}>YouTube पर खोलें →</div>
                  </div>
                </a>
              ))}
            </Card>
          ))}
          <div className="body" style={{ fontSize: 12, color: C.chalkDim, textAlign: "center", marginTop: 8 }}>
            और channels जोड़े जाएंगे — DJ से बताओ
          </div>
        </>
      )}
    </div>
  );
}

// ============ PATHWAY TAB ============
function Pathway({ onMakeSession }) {
  const [openStage, setOpenStage] = useState("s2");
  const [diagrams, makeDiagram] = useDiagrams();
  return (
    <div style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 130px)" }}>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em" }}>Player Pathway</div>
      <div className="body" style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16, marginTop: 2 }}>6 to 18 — one ladder. Every session moves one step forward.</div>
      {PATHWAY.map((s) => (
        <div key={s.id} style={{ marginBottom: 10 }}>
          <button onClick={() => setOpenStage(openStage === s.id ? null : s.id)} className="body fade-up" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
            background: C.pitchDeep, border: `1.5px solid ${openStage === s.id ? C.gold : C.line}`,
            borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left",
          }}>
            <div>
              <span className="display" style={{ fontSize: 20, color: C.laterite, marginRight: 10 }}>{s.age}</span>
              <span className="display" style={{ fontSize: 18, color: C.chalk }}>{s.hi}</span>
              <div style={{ fontSize: 12, color: C.chalkDim, marginTop: 2 }}>{s.en} • फोकस: {s.focus}</div>
            </div>
            <span style={{ color: C.gold, fontSize: 18 }}>{openStage === s.id ? "−" : "+"}</span>
          </button>
          {openStage === s.id && (
            <div className="fade-up" style={{ padding: "10px 4px 0" }}>
              <div className="body" style={{ fontSize: 12, color: C.laterite, marginBottom: 6 }}>🚫 अभी नहीं: {s.avoid}</div>
              <div className="body" style={{ fontSize: 12, color: C.gold, marginBottom: 10 }}>🌱 चरित्र: {s.character}</div>
              {s.comps.map((c, ci) => (
                <Card key={c.hi}>
                  <div className="body" style={{ fontSize: 16, fontWeight: 800, color: C.chalk }}>{c.hi}</div>
                  <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginTop: 3, lineHeight: 1.5 }}>{c.desc}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <DiagramBlock k={s.id + "-" + ci} text={`${c.hi} (${s.age} saal): ${c.desc}`} diagrams={diagrams} make={makeDiagram} />
                    {c.v.map((v) => <Chip key={v.u} href={v.u} color={v.search ? C.line : C.grass}>{v.t}</Chip>)}
                    <Chip onClick={() => onMakeSession(s.id, c.hi)} color={C.laterite} textColor={C.laterite}>📋 इस पर session बनाओ →</Chip>
                  </div>
                </Card>
              ))}
              <div className="body" style={{ fontSize: 12, color: C.grassLight, margin: "4px 0 8px" }}>
                🎓 Graduation: {s.grad.join(" • ")}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ APP ============
export default function App() {
  const [coach] = useState({ name: "NVFC Coach" });
  const [tab, setTab] = useState("principles");
  const [prefill, setPrefill] = useState(null);
  const makeSession = (stageId, comp) => { setPrefill({ stageId, comp }); setTab("session"); };

  const tabs = [
    { id: "principles", hi: "सिद्धांत", icon: "🧠" },
    { id: "session",    hi: "सेशन",    icon: "📋" },
    { id: "pathway",   hi: "पाथवे",   icon: "🪜" },
    { id: "sahayak",   hi: "सहायक",   icon: "🤝" },
    { id: "library",   hi: "लाइब्रेरी", icon: "⚽" },
    { id: "reports",   hi: "रिपोर्ट",  icon: "📝" },
  ];

  return (
    <div className="body" style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center" }}>
      <FontStyles />
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* ── HEADER ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px 12px",
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Tactical board icon */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill={C.gold} fillOpacity=".12" />
              <rect x="4" y="4" width="20" height="20" rx="3" stroke={C.gold} strokeWidth="1.2" fill="none" />
              <circle cx="14" cy="14" r="4" stroke={C.gold} strokeWidth="1" fill="none" />
              <line x1="4" y1="14" x2="10" y2="14" stroke={C.gold} strokeWidth="1" />
              <line x1="18" y1="14" x2="24" y2="14" stroke={C.gold} strokeWidth="1" />
            </svg>
            <div>
              <div className="display" style={{ fontSize: 16, fontWeight: 700, color: C.chalk, letterSpacing: "-0.02em", lineHeight: 1 }}>
                NVFA
              </div>
              <div className="body" style={{ fontSize: 9, color: C.chalkDim, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>
                Narmada Valley FA
              </div>
            </div>
          </div>

          {/* Active tab label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="body" style={{
              fontSize: 11, color: C.gold, fontWeight: 600,
              background: C.goldDim, border: `1px solid ${C.goldLine}`,
              padding: "4px 10px", borderRadius: 6, letterSpacing: "0.04em"
            }}>
              {tabs.find(t => t.id === tab)?.hi || ""}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, paddingBottom: 72, overflow: "hidden" }}>
          {tab === "principles" && <Principles />}
          {tab === "session"    && <SessionPlanner coach={coach} prefill={prefill} clearPrefill={() => setPrefill(null)} />}
          {tab === "pathway"   && <Pathway onMakeSession={makeSession} />}
          {tab === "sahayak"   && <div style={{ height: "calc(100vh - 130px)" }}><Sahayak coach={coach} /></div>}
          {tab === "library"   && <Library />}
          {tab === "reports"   && <Reports coach={coach} />}
        </div>

        {/* ── BOTTOM NAV ── */}
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 440,
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="body" style={{
                flex: 1, background: "none", border: "none",
                padding: "9px 0 11px",
                cursor: "pointer",
                color: active ? C.gold : C.chalkDim,
                position: "relative",
                transition: "color .15s",
              }}>
                {/* Active indicator line */}
                {active && (
                  <div style={{
                    position: "absolute", top: 0, left: "20%", right: "20%",
                    height: 2, background: C.gold, borderRadius: "0 0 2px 2px",
                  }} />
                )}
                <div style={{ fontSize: 16, lineHeight: 1 }}>{t.icon}</div>
                <div style={{ fontSize: 9, fontWeight: active ? 700 : 500, marginTop: 3, letterSpacing: "0.04em" }}>
                  {t.hi}
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
