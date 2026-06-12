import { useState, useRef, useEffect } from "react";

// ============ THEME ============
const C = {
  pitch: "#14301f", pitchDeep: "#0d2316",
  grass: "#2e7d4f", grassLight: "#3a9663",
  chalk: "#f5f2e8", chalkDim: "rgba(245,242,232,0.55)",
  laterite: "#c4502a", gold: "#d9a441", line: "rgba(245,242,232,0.18)",
};

const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Mukta:wght@400;500;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; }
    .display { font-family: 'Anton', sans-serif; letter-spacing: 0.02em; }
    .body { font-family: 'Mukta', sans-serif; }
    @keyframes chalkIn { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-up { animation: fadeUp 0.35s ease both; }
    @media (prefers-reduced-motion: reduce) {
      .fade-up { animation: none; }
      .chalk-line { animation: none !important; stroke-dashoffset: 0 !important; }
    }
    button:focus-visible, textarea:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
  `}</style>
);

const PitchDivider = () => (
  <svg viewBox="0 0 320 36" style={{ width: "100%", display: "block", margin: "4px 0" }} aria-hidden="true">
    <line x1="0" y1="18" x2="128" y2="18" stroke={C.chalkDim} strokeWidth="1.5" className="chalk-line" strokeDasharray="600" style={{ animation: "chalkIn 1.2s ease both" }} />
    <circle cx="160" cy="18" r="14" fill="none" stroke={C.chalkDim} strokeWidth="1.5" className="chalk-line" strokeDasharray="600" style={{ animation: "chalkIn 1.2s ease both" }} />
    <circle cx="160" cy="18" r="2" fill={C.chalkDim} />
    <line x1="192" y1="18" x2="320" y2="18" stroke={C.chalkDim} strokeWidth="1.5" className="chalk-line" strokeDasharray="600" style={{ animation: "chalkIn 1.2s ease both" }} />
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

// ============ MASTER CURRICULUM (the operating system) ============
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
      { hi: "फर्स्ट टच", desc: "पहला टच अगले काम की तैयारी — दिशा में लो।", v: [sq("first touch drills U10 soccer")] },
      { hi: "पासिंग-रिसीविंग", desc: "ज़मीन पर, अंदर के पंजे से, साथी के सही पैर पर।", v: [sq("passing receiving drills U10 football")] },
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

// (ytLink defined above with PATHWAY)
const Card = ({ children, style }) => (
  <div className="fade-up" style={{ position: "relative", background: C.pitchDeep, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 12, ...style }}>{children}</div>
);
const Tag = ({ children, color = C.gold }) => (
  <span className="body" style={{ fontSize: 11, fontWeight: 700, color: C.pitchDeep, background: color, borderRadius: 999, padding: "2px 10px", letterSpacing: "0.04em" }}>{children}</span>
);
const Btn = ({ children, onClick, primary, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} className="body" style={{
    background: primary ? C.laterite : "transparent", color: C.chalk,
    border: primary ? "none" : `1.5px solid ${C.line}`, borderRadius: 10,
    padding: "12px 18px", fontSize: 15, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, width: "100%", ...style,
  }}>{children}</button>
);
const Chip = ({ children, onClick, href, color = C.line, textColor = C.chalk }) => href ? (
  <a href={href} target="_blank" rel="noopener noreferrer" className="body" style={{ border: `1px solid ${color}`, color: textColor, borderRadius: 999, padding: "5px 12px", fontSize: 13, textDecoration: "none", display: "inline-block" }}>{children}</a>
) : (
  <button onClick={onClick} className="body" style={{ background: "transparent", border: `1px solid ${color}`, color: textColor, borderRadius: 999, padding: "5px 12px", fontSize: 13, cursor: "pointer" }}>{children}</button>
);
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="body" style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);
const inputStyle = {
  width: "100%", background: C.pitch, color: C.chalk, border: `1.5px solid ${C.line}`,
  borderRadius: 10, padding: "12px", fontSize: 15, fontFamily: "'Mukta', sans-serif",
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

// ============ PLAN VIEW (shared by planner + saved plans) ============
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
              <div style={{ fontSize: 13, color: C.gold, marginTop: 5 }}>🗣 “{b.cue}”</div>
              {b.why && <div style={{ fontSize: 13, color: C.grassLight, marginTop: 3 }}>💭 {b.why}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <DiagramBlock k={i} text={`${b.name}. ${b.drill}`} diagrams={diagrams} make={make} />
                {b.yt && <Chip href={ytLink(b.yt)}>▶ वीडियो खोजो</Chip>}
                {onVariety && (
                  <Chip onClick={() => onVariety(i)} color={C.gold} textColor={C.gold}>
                    {varietyLoading === i ? "नया रूप बन रहा…" : "🔄 वही concept — नया रूप"}
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

// ============ SESSION PLANNER (curriculum-driven) ============
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
    if (prefill) {
      setStageId(prefill.stageId);
      setCurrent(prefill.comp);
      setTarget("");
      setStage("form"); setPlan(null); setThinking("");
      clearPrefill && clearPrefill();
    }
  }, [prefill]);

  useEffect(() => {
    // keep competency selections valid when stage changes
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
      const sys = curriculumSys + `\n\nActive lens: ${philObj.lens}\n\nThe technical director's thinking (build strictly from this):\n${thinking}\n${avoid.length ? `\nDrills this coach used recently — do NOT repeat, give fresh forms of the same concepts: ${avoid.join("; ")}` : ""}\n\nRespond ONLY with JSON, no fences:\n{"current":"current competency Hindi","target":"target competency Hindi","why_session":"WHY this session exists on the pathway, one line Hindi","title":"short Hindi title","theme":"one-line kaizen theme Hindi","blocks":[{"name":"Hindi name","minutes":N,"drill":"setup + what players do, 2-3 short Hindi sentences","cue":"one spoken cue Hindi","why":"one line, lens voice, Hindi","yt":"english youtube query"}],"equipment":"Hindi minimal list","closing":"closing circle line Hindi"}\nExactly 4 blocks: warm-up, two main, closing game/circle. Minutes total ${duration}. Every block must serve the target competency. Respect the stage's do-NOT-teach list absolutely.`;
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
    <div style={{ padding: 20 }}>
      <div className="display" style={{ fontSize: 26, color: C.chalk }}>सेशन प्लानर</div>
      <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 16 }}>उम्र → पड़ाव → competency → सोच → सेशन। हर सेशन पाथवे पर एक कदम।</div>

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
                  background: phil === p.id ? C.laterite : C.pitch,
                  border: `1.5px solid ${phil === p.id ? C.laterite : C.line}`,
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
      {plans && plans.length === 0 && <Card><div className="body" style={{ color: C.chalkDim, fontSize: 14 }}>अभी कोई plan save नहीं है। सेशन tab से पहला plan बनाओ और save करो।</div></Card>}
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
  const [reports, setReports] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const load = () => db("list_reports").then((r) => setReports(r.reports)).catch(() => setReports([]));
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await db("save_report", { ...form, sessions: Number(form.sessions) || 0, avg_attendance: Number(form.avg_attendance) || 0 });
      setMsg("✓ रिपोर्ट जमा हो गई — शाबाश कोच!");
      setForm({ week_start: mondayOf(), sessions: "", avg_attendance: "", went_well: "", challenge: "", kaizen_moment: "" });
      load();
    } catch (e) { setMsg("जमा नहीं हुई — फिर कोशिश करो।"); }
    setSaving(false);
  };

  const byMonth = {};
  (reports || []).forEach((r) => {
    const m = new Date(r.week_start).toLocaleDateString("hi-IN", { month: "long", year: "numeric" });
    (byMonth[m] = byMonth[m] || []).push(r);
  });

  return (
    <div style={{ padding: 20 }}>
      <div className="display" style={{ fontSize: 26, color: C.chalk }}>साप्ताहिक रिपोर्ट</div>
      <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 16 }}>हर हफ़्ते 2 मिनट — पूरे प्रोग्राम की आँखें यही हैं।</div>
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
        <Btn primary onClick={save} disabled={saving}>{saving ? "जमा हो रही…" : "रिपोर्ट जमा करो"}</Btn>
        {msg && <div className="body" style={{ color: msg.startsWith("✓") ? C.grassLight : C.laterite, fontSize: 13, marginTop: 10 }}>{msg}</div>}
      </Card>

      {Object.entries(byMonth).map(([month, rows]) => (
        <div key={month}>
          <div className="display" style={{ fontSize: 16, color: C.gold, margin: "16px 0 8px" }}>{month}</div>
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="body" style={{ fontSize: 13, color: C.chalkDim }}>
                हफ़्ता {new Date(r.week_start).toLocaleDateString("hi-IN", { day: "numeric", month: "short" })} • {r.sessions} सेशन • ~{r.avg_attendance} बच्चे
              </div>
              {r.went_well && <div className="body" style={{ fontSize: 14, color: C.chalk, marginTop: 6 }}>✅ {r.went_well}</div>}
              {r.challenge && <div className="body" style={{ fontSize: 14, color: C.chalkDim, marginTop: 4 }}>⚠️ {r.challenge}</div>}
              {r.kaizen_moment && <div className="body" style={{ fontSize: 14, color: C.grassLight, marginTop: 4 }}>改善 {r.kaizen_moment}</div>}
            </Card>
          ))}
        </div>
      ))}
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
      <div className="display" style={{ fontSize: 26, color: C.chalk }}>कोच सहायक</div>
      <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 12 }}>मैदान का साथी — हिंदी में, सीधा जवाब</div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
        {msgs.map((m, i) => (
          <div key={i} className="fade-up" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div className="body" style={{
                maxWidth: "85%", padding: "10px 14px", borderRadius: 14, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap",
                background: m.role === "user" ? C.laterite : C.pitchDeep, color: C.chalk,
                border: m.role === "user" ? "none" : `1px solid ${C.line}`,
                borderBottomRightRadius: m.role === "user" ? 4 : 14,
                borderBottomLeftRadius: m.role === "user" ? 14 : 4,
              }}>{m.content}</div>
            </div>
            {m.role === "assistant" && i > 0 && (
              <div style={{ maxWidth: "85%" }}>
                {extras[i] && extras[i] !== "loading" && extras[i] !== "error" && (
                  <>
                    <PitchDiagram spec={extras[i]} />
                    {extras[i].yt && <div style={{ marginTop: 8 }}><Chip href={ytLink(extras[i].yt)}>▶ सबसे क़रीबी वीडियो खोजो</Chip></div>}
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

// ============ LIBRARY (Drills + GK) ============
function Library() {
  const [sub, setSub] = useState("drills");
  const [diagrams, makeDiagram] = useDiagrams();
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Chip onClick={() => setSub("drills")} color={sub === "drills" ? C.laterite : C.line} textColor={sub === "drills" ? C.laterite : C.chalkDim}>⚽ ड्रिल</Chip>
        <Chip onClick={() => setSub("gk")} color={sub === "gk" ? C.laterite : C.line} textColor={sub === "gk" ? C.laterite : C.chalkDim}>🧤 गोलची</Chip>
      </div>

      {sub === "drills" && (
        <>
          <div className="display" style={{ fontSize: 26, color: C.chalk }}>ड्रिल लाइब्रेरी</div>
          <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 16 }}>कम सामान — पूरा खेल। हर ड्रिल के साथ उसका कैज़ेन।</div>
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
              <div className="body" style={{ fontSize: 13, color: C.gold, marginTop: 8 }}>🗣 “{d.cue}”</div>
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
          <div className="display" style={{ fontSize: 26, color: C.chalk }}>गोलची 🧤</div>
          <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 8 }}>कोएर्वर pyramid — goalkeeping पर। पहले बॉल से दोस्ती, फिर हुनर, फिर खेल।</div>
          <div className="body" style={{ fontSize: 12, color: C.gold, marginBottom: 16, border: `1px dashed ${C.line}`, borderRadius: 10, padding: "8px 12px" }}>
            ईमानदार बात: Coerver की कोई official GK किताब नहीं — यहाँ उनकी सीढ़ी-दर-सीढ़ी सोच को goalkeeping पर लगाया गया है। videos असली और जाँचे हुए हैं।
          </div>
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
              <div className="body" style={{ fontSize: 13, color: C.gold, marginTop: 8 }}>🗣 “{s.cue}”</div>
              <div className="body" style={{ fontSize: 13, color: C.grassLight, marginTop: 4, fontWeight: 700 }}>改善 कैज़ेन: {s.kaizen}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <DiagramBlock k={"g" + i} text={`GK: ${s.hi}. ${s.drill}`} diagrams={diagrams} make={makeDiagram} />
                {s.videos.map((v) => <Chip key={v.u} href={v.u} color={C.grass}>▶ {v.t}</Chip>)}
              </div>
            </Card>
          ))}
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
    <div style={{ padding: 20 }}>
      <div className="display" style={{ fontSize: 26, color: C.chalk }}>खिलाड़ी पाथवे</div>
      <div className="body" style={{ fontSize: 13, color: C.chalkDim, marginBottom: 16 }}>
        6 साल से 18 तक — एक सीढ़ी। हर सेशन इस पर एक कदम। फुटबॉल और चरित्र — दोनों बराबर।
      </div>
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
  const [tab, setTab] = useState("pathway");
  const [prefill, setPrefill] = useState(null);

  
  const makeSession = (stageId, comp) => { setPrefill({ stageId, comp }); setTab("session"); };

  const tabs = [
    { id: "pathway", hi: "पाथवे", icon: "🪜" },
    { id: "session", hi: "सेशन", icon: "📋" },
    { id: "sahayak", hi: "सहायक", icon: "🤝" },
    { id: "library", hi: "लाइब्रेरी", icon: "⚽" },
    { id: "reports", hi: "रिपोर्ट", icon: "📝" },
    { id: "plans", hi: "प्लान", icon: "📚" },
  ];

  return (
    <div className="body" style={{ minHeight: "100vh", background: C.pitch, display: "flex", justifyContent: "center" }}>
      <FontStyles />
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative" }}>
        {true && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 0" }}>
              <span className="display" style={{ color: C.chalk, fontSize: 20 }}>NVFC</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag color={C.grass}>NVFC Coach</Tag>
                
              </div>
            </div>
            <div style={{ flex: 1, paddingBottom: 84 }}>
              {tab === "pathway" && <Pathway onMakeSession={makeSession} />}
              {tab === "session" && <SessionPlanner coach={coach} prefill={prefill} clearPrefill={() => setPrefill(null)} />}
              {tab === "sahayak" && <div style={{ height: "calc(100vh - 150px)" }}><Sahayak coach={coach} /></div>}
              {tab === "library" && <Library />}
              {tab === "reports" && <Reports coach={coach} />}
              {tab === "plans" && <MyPlans />}
            </div>
            <div style={{
              position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
              width: "100%", maxWidth: 440, display: "flex",
              background: C.pitchDeep, borderTop: `1.5px solid ${C.line}`,
            }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className="body" style={{
                  flex: 1, background: "none", border: "none", padding: "10px 0 14px",
                  cursor: "pointer", color: tab === t.id ? C.gold : C.chalkDim,
                  borderTop: tab === t.id ? `3px solid ${C.laterite}` : "3px solid transparent",
                  fontSize: 12, fontWeight: 700,
                }}>
                  <div style={{ fontSize: 17 }}>{t.icon}</div>
                  {t.hi}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
