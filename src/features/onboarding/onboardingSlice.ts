import {createSlice, PayloadAction} from '@reduxjs/toolkit';

type OnboardingState = {
  completed: boolean;
};

const initialState: OnboardingState = {
  completed: false,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    setOnboardingComplete(state, action: PayloadAction<boolean>) {
      state.completed = action.payload;
    },
  },
});

export const {setOnboardingComplete} = onboardingSlice.actions;
export const onboardingReducer = onboardingSlice.reducer;
