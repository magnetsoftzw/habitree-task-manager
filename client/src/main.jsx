import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/index.js';
import ThemeProvider from './theme/ThemeProvider.jsx';
import './index.css'
import './styles/Theme.css'
import './styles/Ui.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </Provider>,
)
