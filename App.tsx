import React from 'react';
import {Provider} from 'react-redux';

import {App as RootApp} from './src/app/App';
import {store} from './src/store/store';

function App() {
  return (
    <Provider store={store}>
      <RootApp />
    </Provider>
  );
}

export default App;
