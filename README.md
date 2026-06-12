# NVFC Coach App ⚽

Narmada Valley FC का coaching operating system — curriculum-driven sessions, हर जवाब के साथ diagram और video.

## क्या-क्या है
- 🪜 **पाथवे** — 6-18 साल का master curriculum: हर पड़ाव की competencies, verified videos, diagrams, और "इस पर session बनाओ"
- 📋 **सेशन प्लानर** — Age stage → Current → Target competency → Director की सोच → plan। हर plan में: पाथवे लाइन, "यह सेशन क्यों", हर block पर diagram/video/"नया रूप", और अंत में "हौसला — कोच की बात" + कोच का reflection सवाल
- 🤝 **सहायक** — curriculum-aware chat; हर जवाब के नीचे डायग्राम+वीडियो button
- ⚽ **लाइब्रेरी** — drills + Coerver-pyramid GK section (verified videos)
- 📝 **रिपोर्ट** — साप्ताहिक, महीने-वार grouped
- 📚 **प्लान** — हर save किया session, anti-repeat के लिए drill history भी यहीं से

## Deploy (phone से भी हो जाएगा)

### 1. Supabase (free)
1. supabase.com → New project
2. SQL Editor → `db/schema.sql` का पूरा text paste → Run
3. नए coaches जोड़ने के लिए वही file के नीचे वाली insert line इस्तेमाल करो
4. Settings → API से copy करो: **Project URL** और **service_role key**

### 2. GitHub
इस folder को नई repo में upload करो (जैसे rishi-proxy किया था)।

### 3. Vercel
1. vercel.com → Import repo → Framework: **Vite** (auto-detect)
2. Environment Variables में तीन चीज़ें:
   - `ANTHROPIC_API_KEY` = आपकी Anthropic key
   - `SUPABASE_URL` = step 1 का Project URL
   - `SUPABASE_SERVICE_KEY` = step 1 की service_role key
3. Deploy 🚀

⚠️ Keys सिर्फ़ Vercel env में — GitHub में कभी नहीं (पुराना सबक़!)

## Coach codes
Format: `NVFC-NAAM-01`। Supabase के Table Editor → coaches में जोड़ो। Coach app खोलकर अपना code डालेगा — बस।

## आगे (v2 ideas)
- DJ के लिए admin dashboard (सब coaches की reports एक जगह + AI monthly summary)
- Player profiles + competency tracking (कौन बच्चा पाथवे पर कहाँ)
- fit_4_football captions से motivation voice tuning
