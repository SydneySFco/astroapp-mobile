import {configureStore} from '@reduxjs/toolkit';

import {healthApi} from '../features/health/healthApi';

export const store = configureStore({
  reducer: {
    [healthApi.reducerPath]: healthApi.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(healthApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
