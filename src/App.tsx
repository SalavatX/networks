import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/auth/PrivateRoute';
import Navbar from './components/layout/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import PostFeed from './components/posts/PostFeed';
import Profile from './components/profile/Profile';
import Messages from './components/messages/Messages';
import Notifications from './components/notifications/Notifications';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="animated-gradient-bg"></div>
        
        <div className="min-h-screen">
          <Routes>
            <Route path="/login" element={null} />
            <Route path="/register" element={null} />
            <Route path="*" element={<Navbar />} />
          </Routes>
          
          <main className="content-container">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route element={<PrivateRoute />}>
                <Route path="/" element={<PostFeed />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
