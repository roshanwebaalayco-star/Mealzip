export type Region = "north" | "south" | "east" | "west" | "central";
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface SeasonalData {
  vegetables: string[];
  fruits: string[];
  grains: string[];
}

export const SEASONAL_CALENDAR: Record<Region, Record<Month, SeasonalData>> = {
  north: {
    1:  { vegetables: ["spinach","methi","sarson","cauliflower","carrot","radish","peas"], fruits: ["amla","guava","orange"], grains: ["bajra","makka"] },
    2:  { vegetables: ["spinach","methi","broccoli","cabbage","peas","beetroot"], fruits: ["strawberry","guava","orange"], grains: ["wheat","barley"] },
    3:  { vegetables: ["raw mango","spring onion","cucumber","ash gourd"], fruits: ["mango (raw)","lychee (early)"], grains: ["wheat","chana"] },
    4:  { vegetables: ["bitter gourd","bottle gourd","raw mango","tinda"], fruits: ["mango","lychee","jackfruit"], grains: ["wheat","jowar"] },
    5:  { vegetables: ["lauki","tinda","karela","bhindi","tori"], fruits: ["mango","watermelon","muskmelon"], grains: ["jowar","bajra"] },
    6:  { vegetables: ["lauki","bhindi","arbi","green chilli"], fruits: ["mango","jamun","watermelon"], grains: ["jowar","rice"] },
    7:  { vegetables: ["bhindi","tinda","parwal","lauki","arbi"], fruits: ["jamun","pear","plum"], grains: ["rice","bajra"] },
    8:  { vegetables: ["parwal","lauki","tinda","bhindi"], fruits: ["pear","apple (early)","pomegranate"], grains: ["rice","maize"] },
    9:  { vegetables: ["arbi","parwal","ridge gourd","snake gourd"], fruits: ["pomegranate","apple","fig"], grains: ["rice","jowar"] },
    10: { vegetables: ["cauliflower (early)","pumpkin","sweet potato"], fruits: ["pomegranate","apple","grapes"], grains: ["rice","bajra"] },
    11: { vegetables: ["cauliflower","peas","carrot","radish"], fruits: ["amla","guava","orange"], grains: ["wheat","barley"] },
    12: { vegetables: ["sarson","methi","spinach","carrot","peas"], fruits: ["amla","guava","orange"], grains: ["bajra","wheat"] },
  },
  south: {
    1:  { vegetables: ["drumstick","raw banana","elephant yam","colocasia"], fruits: ["sapota","guava","papaya"], grains: ["rice","ragi"] },
    2:  { vegetables: ["raw mango","drumstick","snake gourd","ridge gourd"], fruits: ["mango (raw)","jackfruit (early)"], grains: ["ragi","jowar"] },
    3:  { vegetables: ["raw mango","ash gourd","bitter gourd"], fruits: ["mango","jackfruit","pineapple"], grains: ["rice","ragi"] },
    4:  { vegetables: ["bitter gourd","ash gourd","raw jackfruit"], fruits: ["mango","jackfruit","pineapple"], grains: ["rice","jowar"] },
    5:  { vegetables: ["raw jackfruit","drumstick","cluster beans"], fruits: ["mango","banana","coconut"], grains: ["rice","ragi"] },
    6:  { vegetables: ["colocasia","drumstick leaves","moringa"], fruits: ["banana","papaya","coconut"], grains: ["rice","ragi"] },
    7:  { vegetables: ["ash gourd","drumstick","ridge gourd"], fruits: ["banana","papaya"], grains: ["rice","ragi"] },
    8:  { vegetables: ["snake gourd","ridge gourd","ivy gourd"], fruits: ["banana","pomegranate"], grains: ["rice","jowar"] },
    9:  { vegetables: ["brinjal","cluster beans","drumstick"], fruits: ["sapota","guava","pomegranate"], grains: ["rice","finger millet"] },
    10: { vegetables: ["drumstick","beans","raw banana"], fruits: ["guava","sapota","orange"], grains: ["rice","ragi"] },
    11: { vegetables: ["drumstick","moringa leaves","beans"], fruits: ["sapota","guava","orange"], grains: ["rice","ragi"] },
    12: { vegetables: ["raw banana","colocasia","yam","drumstick"], fruits: ["sapota","guava","orange"], grains: ["rice","ragi"] },
  },
  east: {
    1:  { vegetables: ["pointed gourd","spinach","mustard greens","radish"], fruits: ["guava","orange"], grains: ["rice","lentils"] },
    2:  { vegetables: ["spinach","mustard greens","cauliflower","cabbage"], fruits: ["guava","orange"], grains: ["rice","mustard"] },
    3:  { vegetables: ["raw mango","spring onion","parwal"], fruits: ["mango (raw)","jackfruit (early)"], grains: ["rice","wheat"] },
    4:  { vegetables: ["parwal","raw jackfruit","bitter gourd"], fruits: ["mango","jackfruit","litchi (early)"], grains: ["rice"] },
    5:  { vegetables: ["parwal","bitter gourd","raw jackfruit"], fruits: ["mango","litchi","jackfruit"], grains: ["rice","lentils"] },
    6:  { vegetables: ["parwal","bottle gourd"], fruits: ["mango","jamun"], grains: ["rice"] },
    7:  { vegetables: ["parwal","taro","pointed gourd","colocasia"], fruits: ["jamun","plum"], grains: ["rice","kodo millet"] },
    8:  { vegetables: ["taro","colocasia","ridge gourd"], fruits: ["pear","plum","fig"], grains: ["rice"] },
    9:  { vegetables: ["pointed gourd","pumpkin","sweet potato"], fruits: ["pomegranate","pear"], grains: ["rice","lentils"] },
    10: { vegetables: ["sweet potato","elephant yam","pumpkin"], fruits: ["pomegranate","guava"], grains: ["rice","lentils"] },
    11: { vegetables: ["spinach","radish","carrot","cauliflower"], fruits: ["guava","orange"], grains: ["rice","lentils"] },
    12: { vegetables: ["mustard greens","spinach","radish","carrot"], fruits: ["guava","orange","amla"], grains: ["rice","lentils"] },
  },
  west: {
    1:  { vegetables: ["methi","spinach","carrot","green peas","cauliflower"], fruits: ["guava","orange","strawberry"], grains: ["wheat","bajra","jowar"] },
    2:  { vegetables: ["methi","spinach","carrot","peas"], fruits: ["strawberry","orange"], grains: ["wheat","jowar"] },
    3:  { vegetables: ["raw mango","cucumber","spring onion"], fruits: ["mango (raw)","chikoo"], grains: ["wheat","jowar"] },
    4:  { vegetables: ["bitter gourd","raw mango","tinda"], fruits: ["mango","chikoo","sitaphal"], grains: ["bajra","jowar"] },
    5:  { vegetables: ["lauki","tinda","bhindi","cluster beans"], fruits: ["mango","watermelon"], grains: ["bajra","jowar"] },
    6:  { vegetables: ["lauki","bhindi","tinda","karela"], fruits: ["mango","jamun","watermelon"], grains: ["bajra","rice"] },
    7:  { vegetables: ["bhindi","tinda","val beans","cluster beans"], fruits: ["jamun","papaya"], grains: ["rice","bajra"] },
    8:  { vegetables: ["val beans","tinda","ridge gourd"], fruits: ["papaya","pear"], grains: ["rice","jowar"] },
    9:  { vegetables: ["surti papdi","flat beans","brinjal"], fruits: ["pomegranate","chikoo"], grains: ["jowar","rice"] },
    10: { vegetables: ["surti papdi","cabbage","cauliflower (early)"], fruits: ["pomegranate","apple","chikoo"], grains: ["jowar","wheat"] },
    11: { vegetables: ["methi","cauliflower","carrot","green peas"], fruits: ["guava","orange","chikoo"], grains: ["wheat","bajra"] },
    12: { vegetables: ["methi","spinach","carrot","green peas"], fruits: ["guava","orange","strawberry"], grains: ["wheat","bajra","jowar"] },
  },
  central: {
    1:  { vegetables: ["spinach","methi","cauliflower","carrot","peas"], fruits: ["amla","guava","orange"], grains: ["wheat","gram","lentils"] },
    2:  { vegetables: ["spinach","cauliflower","cabbage","peas"], fruits: ["guava","orange"], grains: ["wheat","gram"] },
    3:  { vegetables: ["raw mango","cucumber","spring onion"], fruits: ["mango (raw)"], grains: ["wheat","gram"] },
    4:  { vegetables: ["raw mango","bitter gourd","tinda"], fruits: ["mango","jamun (early)"], grains: ["jowar","moong"] },
    5:  { vegetables: ["lauki","tinda","bhindi","karela"], fruits: ["mango","watermelon"], grains: ["jowar","moong"] },
    6:  { vegetables: ["lauki","bhindi","tinda"], fruits: ["mango","jamun"], grains: ["jowar","rice"] },
    7:  { vegetables: ["bhindi","arbi","parwal"], fruits: ["jamun","pear"], grains: ["rice","soybean"] },
    8:  { vegetables: ["parwal","ridge gourd","snake gourd"], fruits: ["pear","plum"], grains: ["rice","soybean"] },
    9:  { vegetables: ["arbi","pumpkin","sweet potato"], fruits: ["pomegranate","apple"], grains: ["rice","lentils"] },
    10: { vegetables: ["sweet potato","yam","pumpkin","cauliflower (early)"], fruits: ["pomegranate","guava"], grains: ["wheat","lentils"] },
    11: { vegetables: ["cauliflower","peas","carrot","spinach"], fruits: ["amla","guava","orange"], grains: ["wheat","gram"] },
    12: { vegetables: ["sarson","spinach","methi","carrot","peas"], fruits: ["amla","guava","orange"], grains: ["wheat","bajra","gram"] },
  },
};

export const getSeasonalIngredients = (region: Region, month: Month): SeasonalData => {
  return SEASONAL_CALENDAR[region]?.[month] ?? SEASONAL_CALENDAR.north[month];
};
