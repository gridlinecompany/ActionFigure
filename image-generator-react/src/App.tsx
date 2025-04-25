import React, { useState, useEffect } from 'react';
import './style.css'; // Use our style.css
// Import components without extension
import ActionFigureGenerator from './components/ActionFigureGenerator'; // <-- Uncomment this import
import PackagingMockupGenerator from './components/PackagingMockupGenerator';
// Import the new LandingPage component
import LandingPage from './components/LandingPage';
// Import the new AdminSettings component
import AdminSettings from './components/AdminSettings';
// Import the new UserGallery component
import UserGallery from './components/UserGallery';
// Import Clerk components and hooks
import { SignedIn, SignedOut, useUser, useSession } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js'; // Add createClient import
// Import the new Header component
import Header from './components/Header';
// Import routing components and Navigate
import { Routes, Route, Navigate } from 'react-router-dom';
// import { supabase } from './supabaseClient'; // REMOVE global client import
// Import the new generator component
import BarbieStyleBoxGenerator from './components/BarbieStyleBoxGenerator';

// Remove ActiveTab type - no longer needed
// type ActiveTab = 'actionFigure' | 'packaging';

// --- Define AdminRoute OUTSIDE the App component ---
const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const { isLoaded, user } = useUser(); // Get user info inside
  const isAdmin = user?.publicMetadata?.role === 'admin';

  if (!isLoaded) return <div>Loading...</div>; // Wait for user data
  if (!user) return <Navigate to="/" replace />; // Redirect if not signed in
  if (!isAdmin) return <Navigate to="/" replace />; // Redirect if not admin
  return children; // Render children (AdminSettings) if admin
};
// -------------------------------------------------

// --- Main Application Component --- 
function App() {
  const { user, isLoaded } = useUser(); // Keep user/isLoaded here for Header prop
  // const { getToken } = useAuth(); // REMOVE if not used elsewhere
  const { session } = useSession(); // Keep session if needed, even if not for logo fetch
  const [logoUrl, setLogoUrl] = useState<string | null>(null); // State for logo URL

  // --- Fetch Logo URL on Mount --- 
  useEffect(() => {
    const fetchLogoUrl = async () => {
      try {
        // Create a temporary, NON-AUTHENTICATED client for public data
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error("Supabase URL/Key missing for public client.");
            return; // Can't create client
        }
        const publicSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        // ------------------------------------------------------------------

        // Assume a 'settings' table with a key column 'setting_key' and 'value' column
        const { data, error } = await publicSupabaseClient // Use the temporary client
          .from('settings') 
          .select('value') 
          .eq('setting_key', 'logo_url')
          .maybeSingle(); // Use maybeSingle in case the setting doesn't exist

        if (error) {
          console.error('Error fetching logo URL:', error.message);
          return;
        }

        if (data && data.value) {
          setLogoUrl(data.value);
        } else {
          console.log('No logo URL found in settings.');
        }
      } catch (err) {
        console.error('Unexpected error fetching logo URL:', err);
      }
    };

    fetchLogoUrl();
  }, []); // Empty dependency array means run once on mount

  // --- Callback function to update logoUrl state --- 
  const handleLogoUpdate = (newUrl: string | null) => {
    console.log("App.tsx: handleLogoUpdate called with:", newUrl);
    setLogoUrl(newUrl);
  };
  // ------------------------------------------------

  // Wait for Clerk to load user data before rendering routes
  if (!isLoaded) {
    // console.log("App Render - Clerk not loaded yet"); // Can remove this now
    return <div className="container">Loading...</div>; 
  }

  return (
    <div className="app-layout"> 
      <Header isAdmin={user?.publicMetadata?.role === 'admin'} logoUrl={logoUrl} />
      <div className="main-content">
        <Routes>
          {/* Root Path Logic */}
          <Route 
            path="/" 
            element={
              <>
                <SignedIn>
                  {/* Redirect signed-in users from root to a default page */}
                  <Navigate to="/action-figure" replace />
                </SignedIn>
                <SignedOut>
                  {/* Show LandingPage for signed-out users at root */}
                  <LandingPage />
                </SignedOut>
              </>
            }
          />
          {/* Generator Routes */}
          <Route 
            path="/action-figure" 
            element={ <SignedIn><ActionFigureGenerator /></SignedIn> }
          />
          <Route 
            path="/packaging-mockup" 
            element={ <SignedIn><PackagingMockupGenerator /></SignedIn> }
          />
          {/* --- Add Route for Barbie Style Box --- */}
          <Route 
            path="/barbie-style-box" 
            element={ <SignedIn><BarbieStyleBoxGenerator /></SignedIn> }
          />
          {/* ------------------------------------- */}
          {/* Admin Route */}
          <Route 
            path="/admin" 
            element={ <AdminRoute><AdminSettings onLogoUpdate={handleLogoUpdate} /></AdminRoute> }
          />
          {/* Gallery Route */}
          <Route 
            path="/gallery" 
            element={ <SignedIn><UserGallery /></SignedIn> }
          />
          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} /> 
        </Routes>
      </div>
    </div>
  );
}

export default App;
