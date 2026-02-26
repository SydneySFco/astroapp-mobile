import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export type Report = {
  id: string;
  title: string;
  shortDescription: string;
  preview: string;
  fullContent: string;
  price: number;
  currency: 'TRY';
};

type ReportsState = {
  catalog: Report[];
  purchasedReportIds: string[];
};

const INITIAL_REPORTS: Report[] = [
  {
    id: 'career-focus-2026',
    title: 'Kariyer Odağı Raporu',
    shortDescription: 'Önümüzdeki 30 gün için iş ve üretkenlik odağı.',
    preview:
      'Bu dönemde dikkatini tek bir hedefe topladığında ivme artıyor. 7 günlük planla ilerlemek en güçlü strateji.',
    fullContent:
      'Kariyer ritminde sadeleşme zamanı. Bu ay, dağınık görevleri tek ana hedef etrafında toplamak netlik kazandırır. Her gün 20 dakikalık odak bloğu ve haftalık mini değerlendirme ile ilerlediğinde verimliliğin belirgin şekilde artar.',
    price: 149,
    currency: 'TRY',
  },
  {
    id: 'relationship-patterns-2026',
    title: 'İlişki Dinamikleri Raporu',
    shortDescription: 'İletişim kalıpların ve duygusal denge önerileri.',
    preview:
      'Empati kasın güçlü; ancak sınır koymayı geciktirdiğinde yorgunluk artıyor. Net istek cümleleri ilişkiyi dengeler.',
    fullContent:
      'İlişkilerde derinlik arayışın yüksek. Bu hafta, ihtiyaçlarını açık ve kısa cümlelerle ifade etmek yanlış anlaşılmaları azaltır. Haftada iki kez “duygu check-in” rutini kurmak bağ kalitesini artırır.',
    price: 199,
    currency: 'TRY',
  },
];

const initialState: ReportsState = {
  catalog: INITIAL_REPORTS,
  purchasedReportIds: [],
};

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    markReportPurchased: (state, action: PayloadAction<string>) => {
      if (!state.purchasedReportIds.includes(action.payload)) {
        state.purchasedReportIds.push(action.payload);
      }
    },
  },
});

export const {markReportPurchased} = reportsSlice.actions;
export const reportsReducer = reportsSlice.reducer;
