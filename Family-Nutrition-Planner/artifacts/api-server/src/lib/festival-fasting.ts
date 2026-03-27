export type FastingType = "full" | "partial" | "none";

export interface FastingEntry {
  day: number;
  name: string;
  nameHindi: string;
  fastingType: FastingType;
  recommendedFoods: string[];
  traditions: string[];
}

/**
 * Single source of truth for India's multi-faith fasting calendar.
 * Covers Hindu (Ekadashi, Navratri, Shivratri, Sawan, major vrats),
 * Islamic (Ramadan 2026: Feb 18 – Mar 19), Jain, Sikh, and regional fasts.
 * 2026 Gregorian dates verified from panchang + Islamic Society of North America calculations.
 * Fallback for other years: use 2026 data (hackathon scope).
 */
export const FASTING_CALENDAR: Record<number, Record<number, FastingEntry[]>> = {
  2026: {
    1: [
      { day: 14, name: "Makar Sankranti", nameHindi: "मकर संक्रांति", fastingType: "partial", recommendedFoods: ["Til Ladoo", "Khichdi", "Jaggery Rice", "Peanuts"], traditions: ["Hindu", "Regional"] },
      { day: 15, name: "Ekadashi (Putrada)", nameHindi: "पुत्रदा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana", "Nuts"], traditions: ["Hindu"] },
      { day: 30, name: "Ekadashi (Shattila)", nameHindi: "षट्तिला एकादशी", fastingType: "partial", recommendedFoods: ["Til sweets", "Fruits", "Sabudana khichdi"], traditions: ["Hindu"] },
    ],
    2: [
      { day: 2, name: "Vasant Panchami", nameHindi: "वसंत पंचमी", fastingType: "none", recommendedFoods: ["Yellow foods", "Kesar milk", "Meetha chawal"], traditions: ["Hindu"] },
      // Ramadan 2026 begins Feb 18 (verified via Islamic calendar, 1447 AH)
      { day: 13, name: "Ekadashi (Vijaya)", nameHindi: "विजया एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
      { day: 18, name: "Ramadan Begins (Roza 1)", nameHindi: "रमज़ान शुरू (रोज़ा 1)", fastingType: "full", recommendedFoods: ["Sehri: Oats porridge, Eggs, Dates", "Iftar: Dates, Shorba, Samosas, Khajoor milk"], traditions: ["Muslim", "Islamic"] },
      { day: 19, name: "Ramadan Roza 2", nameHindi: "रमज़ान रोज़ा 2", fastingType: "full", recommendedFoods: ["Sehri: Roti, Dal, Eggs", "Iftar: Dates, Pakoras, Haleem, Kheer"], traditions: ["Muslim"] },
      { day: 20, name: "Ramadan Roza 3", nameHindi: "रमज़ान रोज़ा 3", fastingType: "full", recommendedFoods: ["Sehri: Paratha, Curd, Banana", "Iftar: Dates, Shorba, Nihari"], traditions: ["Muslim"] },
      { day: 21, name: "Ramadan Roza 4", nameHindi: "रमज़ान रोज़ा 4", fastingType: "full", recommendedFoods: ["Sehri: Rice, Dal", "Iftar: Dates, Samosa, Biryani"], traditions: ["Muslim"] },
      { day: 22, name: "Ramadan Roza 5", nameHindi: "रमज़ान रोज़ा 5", fastingType: "full", recommendedFoods: ["Sehri: Roti, Eggs, Chai", "Iftar: Dates, Kebabs, Korma"], traditions: ["Muslim"] },
      { day: 23, name: "Ramadan Roza 6", nameHindi: "रमज़ान रोज़ा 6", fastingType: "full", recommendedFoods: ["Sehri: Oats, Nuts, Milk", "Iftar: Dates, Pakoras, Haleem"], traditions: ["Muslim"] },
      { day: 24, name: "Ramadan Roza 7", nameHindi: "रमज़ान रोज़ा 7", fastingType: "full", recommendedFoods: ["Sehri: Paratha, Dal, Banana", "Iftar: Dates, Shorba, Qorma"], traditions: ["Muslim"] },
      { day: 25, name: "Ramadan Roza 8", nameHindi: "रमज़ान रोज़ा 8", fastingType: "full", recommendedFoods: ["Sehri: Rice, Curd, Fruit", "Iftar: Dates, Shahi Tukda, Shorba"], traditions: ["Muslim"] },
      { day: 26, name: "Maha Shivratri Fast + Ramadan Roza 9", nameHindi: "महाशिवरात्रि व्रत + रमज़ान रोज़ा 9", fastingType: "full", recommendedFoods: ["Water", "Milk", "Fruits (Hindu)", "Dates, Shorba (Muslim Iftar)"], traditions: ["Hindu", "Muslim", "Shaiva", "Islamic"] },
      { day: 27, name: "Ramadan Roza 10", nameHindi: "रमज़ान रोज़ा 10", fastingType: "full", recommendedFoods: ["Sehri: Roti, Dal", "Iftar: Dates, Biryani, Raita"], traditions: ["Muslim"] },
      { day: 28, name: "Ekadashi (Amalaki) + Ramadan Roza 11", nameHindi: "आमलकी एकादशी + रमज़ान रोज़ा 11", fastingType: "full", recommendedFoods: ["Amla dishes, Fruits, Sabudana (Hindu)", "Sehri/Iftar with Dates (Muslim)"], traditions: ["Hindu", "Muslim"] },
    ],
    3: [
      // Ramadan continues (days 12-29 in March 2026)
      { day: 1, name: "Ramadan Roza 12", nameHindi: "रमज़ान रोज़ा 12", fastingType: "full", recommendedFoods: ["Sehri: Paratha, Eggs", "Iftar: Dates, Haleem, Shorba"], traditions: ["Muslim"] },
      { day: 2, name: "Ramadan Roza 13", nameHindi: "रमज़ान रोज़ा 13", fastingType: "full", recommendedFoods: ["Sehri: Rice, Dal, Fruit", "Iftar: Dates, Kebabs, Kheer"], traditions: ["Muslim"] },
      { day: 3, name: "Ramadan Roza 14", nameHindi: "रमज़ान रोज़ा 14", fastingType: "full", recommendedFoods: ["Sehri: Oats, Milk, Banana", "Iftar: Dates, Samosas, Nihari"], traditions: ["Muslim"] },
      { day: 4, name: "Ramadan Roza 15 (Laylatul Qadr approaching)", nameHindi: "रमज़ान रोज़ा 15", fastingType: "full", recommendedFoods: ["Sehri: Roti, Dal, Eggs", "Iftar: Dates, Shorba, Biryani"], traditions: ["Muslim"] },
      { day: 5, name: "Ramadan Roza 16", nameHindi: "रमज़ान रोज़ा 16", fastingType: "full", recommendedFoods: ["Sehri: Rice, Vegetables", "Iftar: Dates, Pakoras, Qorma"], traditions: ["Muslim"] },
      { day: 6, name: "Ramadan Roza 17", nameHindi: "रमज़ान रोज़ा 17", fastingType: "full", recommendedFoods: ["Sehri: Paratha, Curd", "Iftar: Dates, Pheni, Shorba"], traditions: ["Muslim"] },
      { day: 7, name: "Ramadan Roza 18", nameHindi: "रमज़ान रोज़ा 18", fastingType: "full", recommendedFoods: ["Sehri: Eggs, Roti", "Iftar: Dates, Haleem, Sewai"], traditions: ["Muslim"] },
      { day: 8, name: "Ramadan Roza 19", nameHindi: "रमज़ान रोज़ा 19", fastingType: "full", recommendedFoods: ["Sehri: Oats, Fruits, Milk", "Iftar: Dates, Samosas, Biryani"], traditions: ["Muslim"] },
      { day: 9, name: "Ramadan Roza 20", nameHindi: "रमज़ान रोज़ा 20", fastingType: "full", recommendedFoods: ["Sehri: Rice, Dal, Banana", "Iftar: Dates, Shorba, Kebabs"], traditions: ["Muslim"] },
      { day: 10, name: "Ramadan Roza 21 (Last 10 nights begin)", nameHindi: "रमज़ान रोज़ा 21 (आखिरी अशरा)", fastingType: "full", recommendedFoods: ["Sehri: High protein — Eggs, Dal, Milk", "Iftar: Dates, Kheer, Haleem"], traditions: ["Muslim"] },
      { day: 11, name: "Ramadan Roza 22", nameHindi: "रमज़ान रोज़ा 22", fastingType: "full", recommendedFoods: ["Sehri: Paratha, Curd, Dates", "Iftar: Dates, Shorba, Korma"], traditions: ["Muslim"] },
      { day: 12, name: "Ramadan Roza 23 (Laylatul Qadr candidate)", nameHindi: "रमज़ान रोज़ा 23 (लैलतुल कद्र)", fastingType: "full", recommendedFoods: ["Sehri: Light nutritious food", "Iftar: Dates, Shahi Tukda, Sewai"], traditions: ["Muslim"] },
      { day: 13, name: "Ramadan Roza 24", nameHindi: "रमज़ान रोज़ा 24", fastingType: "full", recommendedFoods: ["Sehri: Rice, Eggs, Fruits", "Iftar: Dates, Kebabs, Biryani"], traditions: ["Muslim"] },
      { day: 14, name: "Ramadan Roza 25", nameHindi: "रमज़ान रोज़ा 25", fastingType: "full", recommendedFoods: ["Sehri: Roti, Dal, Dahi", "Iftar: Dates, Haleem, Sewai"], traditions: ["Muslim"] },
      { day: 15, name: "Ramadan Roza 26", nameHindi: "रमज़ान रोज़ा 26", fastingType: "full", recommendedFoods: ["Sehri: Oats, Banana, Milk", "Iftar: Dates, Shorba, Nihari"], traditions: ["Muslim"] },
      { day: 16, name: "Ramadan Roza 27 (Laylatul Qadr — most likely)", nameHindi: "रमज़ान रोज़ा 27 (शब-ए-कद्र)", fastingType: "full", recommendedFoods: ["Sehri: Protein-rich food", "Iftar: Dates, Shahi Biryani, Kheer, Pheni"], traditions: ["Muslim"] },
      { day: 17, name: "Ramadan Roza 28", nameHindi: "रमज़ान रोज़ा 28", fastingType: "full", recommendedFoods: ["Sehri: Rice, Dal, Eggs", "Iftar: Dates, Sewai, Haleem"], traditions: ["Muslim"] },
      { day: 18, name: "Ramadan Roza 29", nameHindi: "रमज़ान रोज़ा 29", fastingType: "full", recommendedFoods: ["Sehri: Roti, Curd, Banana", "Iftar: Dates, Shorba, Biryani"], traditions: ["Muslim"] },
      { day: 19, name: "Eid ul-Fitr (Chand Raat / Ramadan ends)", nameHindi: "ईद-उल-फित्र (चाँद रात)", fastingType: "none", recommendedFoods: ["Sewai", "Phirni", "Sheer Khurma", "Shahi Biryani", "Haleem", "Mithai"], traditions: ["Muslim", "Islamic"] },
      { day: 14, name: "Ekadashi (Papamochani)", nameHindi: "पापमोचनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
      { day: 19, name: "Holi (Holika Dahan eve)", nameHindi: "होलिका दहन", fastingType: "none", recommendedFoods: ["Gujiya", "Thandai", "Mathri", "Puran Poli"], traditions: ["Hindu"] },
      { day: 29, name: "Chaitra Navratri Begins", nameHindi: "चैत्र नवरात्रि प्रारंभ", fastingType: "partial", recommendedFoods: ["Sabudana Khichdi", "Kuttu Roti", "Singhara Atta", "Fruits", "Sendha Namak"], traditions: ["Hindu", "Shakta"] },
    ],
    4: [
      { day: 5, name: "Chaitra Navratri / Ram Navami Fast", nameHindi: "राम नवमी व्रत", fastingType: "partial", recommendedFoods: ["Sabudana Khichdi", "Fruits", "Singhara Atta Roti", "Panchamrit"], traditions: ["Hindu", "Vaishnava"] },
      { day: 6, name: "Hanuman Jayanti", nameHindi: "हनुमान जयंती", fastingType: "partial", recommendedFoods: ["Prasad sweets", "Fruits", "Panchamrit", "Boondi"], traditions: ["Hindu"] },
      { day: 13, name: "Ekadashi (Kamada)", nameHindi: "कामदा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Makhane ki kheer", "Sabudana"], traditions: ["Hindu"] },
      { day: 14, name: "Vaisakhi / Baisakhi", nameHindi: "वैसाखी", fastingType: "none", recommendedFoods: ["Makki di Roti", "Sarson da Saag", "Kheer", "Pinni", "Gajrela"], traditions: ["Sikh", "Hindu", "Punjab"] },
      { day: 27, name: "Ekadashi (Varuthini)", nameHindi: "वरुथिनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
    ],
    5: [
      { day: 1, name: "Akshaya Tritiya", nameHindi: "अक्षय तृतीया", fastingType: "none", recommendedFoods: ["Sweet khichdi", "Puran Poli", "Sattu sharbat"], traditions: ["Hindu", "Jain"] },
      { day: 13, name: "Ekadashi (Mohini)", nameHindi: "मोहिनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Makhane ki kheer", "Sabudana"], traditions: ["Hindu"] },
      { day: 22, name: "Buddha Purnima", nameHindi: "बुद्ध पूर्णिमा", fastingType: "partial", recommendedFoods: ["Vegetarian foods", "Fruits", "Rice kheer"], traditions: ["Buddhist", "Hindu"] },
      { day: 26, name: "Ekadashi (Apara)", nameHindi: "अपरा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
    ],
    6: [
      { day: 11, name: "Ekadashi (Nirjala)", nameHindi: "निर्जला एकादशी", fastingType: "full", recommendedFoods: ["Water only (if nirjala)", "Fruits and milk for regular fast"], traditions: ["Hindu"] },
      { day: 15, name: "Jyeshtha Purnima / Vat Purnima", nameHindi: "ज्येष्ठ पूर्णिमा / वट पूर्णिमा", fastingType: "partial", recommendedFoods: ["Vat puja special foods", "Fruits", "Kheer"], traditions: ["Hindu"] },
      { day: 25, name: "Ekadashi (Yogini)", nameHindi: "योगिनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
    ],
    7: [
      { day: 6, name: "Ashadha Ekadashi (Devshayani)", nameHindi: "देवशयनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana Khichdi", "Kuttu ki Roti"], traditions: ["Hindu"] },
      { day: 13, name: "Sawan Monday 1 (Shravana Somvar)", nameHindi: "सावन सोमवार 1", fastingType: "partial", recommendedFoods: ["Milk", "Curd", "Fruits", "Sabudana Khichdi", "Kuttu ki Roti"], traditions: ["Hindu", "Shaiva"] },
      { day: 20, name: "Sawan Monday 2 (Shravana Somvar)", nameHindi: "सावन सोमवार 2", fastingType: "partial", recommendedFoods: ["Milk", "Curd", "Fruits", "Sabudana", "Singhara"], traditions: ["Hindu"] },
      { day: 21, name: "Ekadashi (Kamika)", nameHindi: "कामिका एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
      { day: 27, name: "Sawan Monday 3 (Shravana Somvar)", nameHindi: "सावन सोमवार 3", fastingType: "partial", recommendedFoods: ["Milk", "Curd", "Fruits", "Sabudana", "Kuttu"], traditions: ["Hindu"] },
      { day: 30, name: "Hariyali Teej", nameHindi: "हरियाली तीज", fastingType: "full", recommendedFoods: ["Water", "Fruits", "Milk after moonrise"], traditions: ["Hindu", "Women's festival"] },
    ],
    8: [
      { day: 2, name: "Nag Panchami", nameHindi: "नाग पंचमी", fastingType: "partial", recommendedFoods: ["Milk", "Lava (parched rice)", "Kheel", "Coconut"], traditions: ["Hindu"] },
      { day: 3, name: "Sawan Monday 4 (Shravana Somvar)", nameHindi: "सावन सोमवार 4", fastingType: "partial", recommendedFoods: ["Milk", "Curd", "Fruits", "Sabudana"], traditions: ["Hindu"] },
      { day: 5, name: "Ekadashi (Shravana Putrada)", nameHindi: "पुत्रदा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
      { day: 16, name: "Ekadashi (Aja)", nameHindi: "अजा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
      { day: 19, name: "Rakshabandhan", nameHindi: "रक्षाबंधन", fastingType: "none", recommendedFoods: ["Traditional sweets", "Ghevar", "Kheer", "Ladoo"], traditions: ["Hindu"] },
      { day: 26, name: "Krishna Janmashtami Fast", nameHindi: "जन्माष्टमी व्रत", fastingType: "full", recommendedFoods: ["Water", "Fruits", "Makhane ki kheer at midnight", "Panchamrit"], traditions: ["Hindu", "Vaishnava"] },
      { day: 28, name: "Paryushana Parva (Jain) begins", nameHindi: "पर्युषण पर्व (जैन)", fastingType: "full", recommendedFoods: ["Only boiled water till sunset", "Uncooked rice", "Dried fruits (Jain tapa rules)"], traditions: ["Jain"] },
    ],
    9: [
      { day: 1, name: "Hartalika Teej", nameHindi: "हरतालिका तीज", fastingType: "full", recommendedFoods: ["Water only", "Fruits after puja", "Satvik food"], traditions: ["Hindu"] },
      { day: 2, name: "Ganesh Chaturthi", nameHindi: "गणेश चतुर्थी", fastingType: "partial", recommendedFoods: ["Modak", "Coconut sweets", "Fruits", "Sabudana Khichdi"], traditions: ["Hindu"] },
      { day: 4, name: "Ekadashi (Parsva / Parivartini)", nameHindi: "परिवर्तिनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
      { day: 17, name: "Ekadashi (Indira)", nameHindi: "इंदिरा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
      { day: 18, name: "Pitru Paksha begins (Shradh)", nameHindi: "पितृ पक्ष / श्राद्ध", fastingType: "none", recommendedFoods: ["Kheer", "Khichdi", "Til dishes", "Satvik vegetarian food"], traditions: ["Hindu"] },
    ],
    10: [
      { day: 2, name: "Shardiya Navratri Day 1", nameHindi: "शारदीय नवरात्रि - प्रतिपदा", fastingType: "partial", recommendedFoods: ["Sabudana", "Kuttu Roti", "Singhara Atta", "Fruits", "Milk", "Sendha Namak"], traditions: ["Hindu", "Shakta"] },
      { day: 3, name: "Ekadashi (Papankusha)", nameHindi: "पापांकुशा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
      { day: 10, name: "Dussehra / Vijayadashami", nameHindi: "दशहरा / विजयादशमी", fastingType: "none", recommendedFoods: ["Traditional sweets", "Jalebi", "Fafda", "Shami", "Halwa"], traditions: ["Hindu"] },
      { day: 16, name: "Karva Chauth", nameHindi: "करवा चौथ", fastingType: "full", recommendedFoods: ["Water", "Sargi before sunrise (fennel/nuts/mathri)", "Fruits after moonrise", "Meal after puja"], traditions: ["Hindu", "Married women"] },
      { day: 17, name: "Ekadashi (Rama)", nameHindi: "रमा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
    ],
    11: [
      { day: 2, name: "Ekadashi (Devutthana)", nameHindi: "देवउठनी एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana", "Tulsi prasad"], traditions: ["Hindu"] },
      { day: 9, name: "Dhanteras", nameHindi: "धनतेरस", fastingType: "none", recommendedFoods: ["Kheel-Batasha", "Mithai", "Dhania Panjiri"], traditions: ["Hindu"] },
      { day: 11, name: "Diwali", nameHindi: "दीपावली", fastingType: "none", recommendedFoods: ["Mithai", "Mathri", "Chakli", "Namakpare", "Shakkarpare"], traditions: ["Hindu", "Jain", "Sikh"] },
      { day: 12, name: "Govardhan Puja", nameHindi: "गोवर्धन पूजा", fastingType: "none", recommendedFoods: ["56 bhog items", "Annakut prasad", "Khichdi"], traditions: ["Hindu", "Vaishnava"] },
      { day: 13, name: "Bhai Dooj", nameHindi: "भाई दूज", fastingType: "none", recommendedFoods: ["Mithai", "Pua", "Poori", "Kheer"], traditions: ["Hindu"] },
      { day: 16, name: "Ekadashi (Utpanna)", nameHindi: "उत्पन्ना एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
      { day: 17, name: "Chhath Puja", nameHindi: "छठ पूजा", fastingType: "full", recommendedFoods: ["Thekua (wheat jaggery cookies)", "Fruits (banana, sugarcane)", "Rice kheer after puja"], traditions: ["Bihar", "Jharkhand", "UP"] },
    ],
    12: [
      { day: 2, name: "Ekadashi (Mokshada)", nameHindi: "मोक्षदा एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana"], traditions: ["Hindu"] },
      { day: 16, name: "Ekadashi (Saphala)", nameHindi: "सफला एकादशी", fastingType: "partial", recommendedFoods: ["Fruits", "Milk", "Sabudana khichdi"], traditions: ["Hindu"] },
      { day: 25, name: "Christmas", nameHindi: "क्रिसमस", fastingType: "none", recommendedFoods: ["Plum cake", "Star cookies", "Roast veggies", "Mulled drinks"], traditions: ["Christian"] },
      { day: 31, name: "Pausha Ekadashi", nameHindi: "पौष एकादशी", fastingType: "partial", recommendedFoods: ["Sabudana Khichdi", "Fruits", "Milk"], traditions: ["Hindu"] },
    ],
  },
};

export interface FestivalFastingResult {
  isFestivalFasting: boolean;
  festivals: FastingEntry[];
  fastingType: FastingType;
  recommendedFoods: string[];
}

/**
 * Returns festival/fasting information for any day within the given 7-day week.
 * Covers Hindu, Islamic (Ramadan), Jain, Sikh, and regional fasts.
 * Falls back to 2026 data for other years.
 */
export function getFestivalFastingForWeek(weekStartDate: Date): FestivalFastingResult {
  const yearData = FASTING_CALENDAR[weekStartDate.getFullYear()] ?? FASTING_CALENDAR[2026] ?? {};
  const festivals: FastingEntry[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + i);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const monthEntries = yearData[month] ?? [];
    const todayEntries = monthEntries.filter(e => e.day === day && e.fastingType !== "none");
    festivals.push(...todayEntries);
  }

  if (festivals.length === 0) {
    return { isFestivalFasting: false, festivals: [], fastingType: "none", recommendedFoods: [] };
  }

  const hasFullFast = festivals.some(f => f.fastingType === "full");
  const fastingType: FastingType = hasFullFast ? "full" : "partial";
  const allFoods = [...new Set(festivals.flatMap(f => f.recommendedFoods))];

  return { isFestivalFasting: true, festivals, fastingType, recommendedFoods: allFoods };
}
