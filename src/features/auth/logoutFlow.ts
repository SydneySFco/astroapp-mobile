import type {AppDispatch} from '../../store/store';
import {authApi} from './authApi';
import {reportsApi} from '../reports/reportsApi';

/**
 * Centralized logout invalidation flow.
 * Clears token storage through authApi.logout and resets RTK Query caches.
 */
export const runLogoutFlow = async (dispatch: AppDispatch) => {
  try {
    await dispatch(authApi.endpoints.logout.initiate()).unwrap();
  } catch {
    // Intentionally ignore network errors: local session still must be invalidated.
  } finally {
    dispatch(authApi.util.resetApiState());
    dispatch(reportsApi.util.resetApiState());
  }
};
