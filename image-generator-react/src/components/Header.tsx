import React from 'react';
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Link } from 'react-router-dom';
import '../style.css'; // Ensure CSS is imported if class names are used

// Define props for the Header component
interface HeaderProps {
  isAdmin: boolean;
  logoUrl: string | null; // Add logoUrl prop
}

const Header: React.FC<HeaderProps> = ({ isAdmin, logoUrl }) => { // Destructure logoUrl

  return (
    // Use className for styling as sidebar
    <header className="app-sidebar"> 
      {/* Logo Area */} 
      {logoUrl && ( // Conditionally render if logoUrl exists
        <div className="sidebar-logo-container"> 
          <img src={logoUrl} alt="App Logo" className="sidebar-logo" />
        </div>
      )}

      {/* Title Area - Stacks Vertically */}
      <div className="sidebar-section sidebar-title"> 
         <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>AI Image Gen</h1> 
         </Link>
      </div>
      
      {/* Navigation/User Area - Stacks Vertically */}
      <nav className="sidebar-section sidebar-nav"> 
         <SignedIn>
           {/* Add links for generators first */}
           <Link to="/action-figure" className="sidebar-link">
             Action Figure Gen
           </Link>
           <Link to="/packaging-mockup" className="sidebar-link">
             Packaging Mockup
           </Link>
           {/* Then Gallery */}
           <Link to="/gallery" className="sidebar-link">
             My Gallery
           </Link>
           <Link to="/barbie-style-box" className="sidebar-link">
            Barbie Style Box
          </Link>
           {/* Then Admin, if applicable */}
           {isAdmin && (
             <Link to="/admin" className="sidebar-link">
               Admin Settings
             </Link>
           )}
           {/* User Button at the bottom */}
           <div className="sidebar-user-button"> 
              <UserButton afterSignOutUrl="/" />
           </div>
         </SignedIn>
         <SignedOut>
           {/* Sidebar might be empty or show login prompts */}
         </SignedOut>
      </nav>
    </header>
  );
};

export default Header; 