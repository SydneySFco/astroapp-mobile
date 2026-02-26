import {createSlice, PayloadAction} from '@reduxjs/toolkit';

type SubscriptionState = {
  isPremium: boolean;
};

const initialState: SubscriptionState = {
  isPremium: false,
};

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    setPremium(state, action: PayloadAction<boolean>) {
      state.isPremium = action.payload;
    },
  },
});

export const {setPremium} = subscriptionSlice.actions;
export const subscriptionReducer = subscriptionSlice.reducer;
