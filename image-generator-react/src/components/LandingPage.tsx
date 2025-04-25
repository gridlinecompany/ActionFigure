import React from 'react';
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import '../style.css'; // Assuming styles from the main css are needed

const LandingPage: React.FC = () => {
  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#e0e0e0',
    },
    title: {
      fontSize: '2.5rem',
      color: '#bb86fc',
      marginBottom: '20px',
    },
    subtitle: {
      fontSize: '1.2rem',
      color: '#bdbdbd',
      marginBottom: '40px',
      maxWidth: '600px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    buttonContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
    },
    // Use existing clerk-button styles defined in style.css
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Unleash Your Creativity with AI</h2>
      <p style={styles.subtitle}>
        Generate stunning action figure concepts and professional packaging mockups 
        in seconds. Sign up or sign in to bring your ideas to life.
      </p>
      <div style={styles.buttonContainer}>
        <SignInButton mode="modal">
          {/* Use the class from style.css */}
          <button className="clerk-button">Sign in</button> 
        </SignInButton>
        <SignUpButton mode="modal">
          {/* Use the class from style.css */}
          <button className="clerk-button clerk-button-secondary">Sign up</button>
        </SignUpButton>
      </div>
      {/* You could add more sections here: features, examples, etc. */}
    </div>
  );
};

export default LandingPage; 