import React from 'react';
import {Provider} from 'react-redux';

import {App as RootApp} from './src/app/App';
import {store} from './src/store/store';
import {ThemeProvider} from './src/theme/ThemeProvider';

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <RootApp />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
