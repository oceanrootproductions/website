import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Home from './routes/Home'
import Projects from './routes/Projects'
import Studio from './routes/Studio'
import Contact from './routes/Contact'
import NotFound from './routes/NotFound'
import TwistedDarkPrivacy from './routes/TwistedDarkPrivacy'
import TwistedDarkTerms from './routes/TwistedDarkTerms'

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'projects', element: <Projects /> },
      { path: 'studio', element: <Studio /> },
      { path: 'contact', element: <Contact /> },
      { path: 'twisteddark/privacy', element: <TwistedDarkPrivacy /> },
      { path: 'twisteddark/terms', element: <TwistedDarkTerms /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
