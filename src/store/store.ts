import {configureStore} from '@reduxjs/toolkit';

import {authApi} from '../features/auth/authApi';
import {healthApi} from '../features/health/healthApi';
import {onboardingReducer} from '../features/onboarding/onboardingSlice';
import {subscriptionReducer} from '../features/subscription/subscriptionSlice';

export const store = configureStore({
  reducer: {
    onboarding: onboardingReducer,
    subscription: subscriptionReducer,
    [healthApi.reducerPath]: healthApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(healthApi.middleware, authApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
