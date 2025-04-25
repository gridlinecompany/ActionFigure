import React, { useState, useEffect } from 'react';
// import { supabase } from '../supabaseClient'; // REMOVE global client import
import { useUser, useSession } from '@clerk/clerk-react';
import { createClient } from '@supabase/supabase-js'; // Remove SupabaseClient type if unused
import '../style.css'; // Assuming general styles might apply

interface GalleryImage {
  name: string;
  url: string;
}

const UserGallery: React.FC = () => {
  const { user, isLoaded } = useUser();
  const { session } = useSession();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      if (!isLoaded || !user || !session) {
        // Still loading Clerk data or no session
        setLoading(false); // Stop loading if no session
        return;
      }

      // --- Create Supabase client dynamically using Clerk token ---
      const supabaseAccessToken = await session.getToken({ template: 'supabase' });
      if (!supabaseAccessToken) {
          setError("Failed to get Supabase token from Clerk.");
          setLoading(false);
          return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
         setError("Supabase URL/Key missing.");
         setLoading(false);
         return;
      }

      // Use the recommended pattern from Clerk docs
      const supabaseClerkClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { 
              headers: { Authorization: `Bearer ${supabaseAccessToken}` } 
          }
      });
      // --- End dynamic client creation ---
      
      // Check if client creation failed (unlikely with this pattern but good practice)
      // if (!supabaseClerkClient) { ... }

      setLoading(true);
      setError(null);

      try {
        const userId = user.id; // Clerk user ID
        const bucketName = 'generated-images';
        const userFolderPath = `public/${userId}/`; // Path uses Clerk user ID

        console.log(`Listing images from bucket: ${bucketName}, path: ${userFolderPath}`);

        const { data: fileList, error: listError } = await supabaseClerkClient.storage
          .from(bucketName)
          .list(userFolderPath, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' },
          });

        if (listError) {
          console.error("Supabase storage list error:", listError);
          // Check for specific RLS error signature if needed
          if (listError.message.includes('permission denied') || listError.message.includes('security policy') || listError.message.includes('syntax error')) {
            throw new Error(`Storage Error: Could not list images. Check RLS policy for generated-images bucket and path '${userFolderPath}'. Policy might be incorrect or function failed.`);
          } else {
             throw new Error(`Failed to list images: ${listError.message}`);
          }
        }

        if (!fileList || fileList.length === 0) {
          console.log("No images found in user folder.");
          setImages([]);
          setLoading(false);
          return;
        }
        console.log(`Found ${fileList.length} images.`);

        // Generate public URLs (consider batching if many images)
        const imageUrls = fileList.map(file => {
          const { data: urlData } = supabaseClerkClient.storage
            .from(bucketName)
            .getPublicUrl(`${userFolderPath}${file.name}`);
          return { name: file.name, url: urlData.publicUrl };
        });

        setImages(imageUrls);

      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching gallery images:", err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded && session) {
      fetchImages();
    }

  }, [user, isLoaded, session]); // Dependencies for useEffect

  if (!isLoaded || loading) {
    return <div className="container">Loading gallery...</div>;
  }

  if (error) {
    return <div className="error-message">Error loading gallery: {error}</div>;
  }

  return (
    <div className="gallery-container">
      <h2>My Generated Images</h2>
      {images.length === 0 ? (
        <p>You haven't generated any images yet.</p>
      ) : (
        <div className="image-grid">
          {images.map((image) => (
            <div key={image.name} className="image-item">
              <img src={image.url} alt={`Generated image ${image.name}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserGallery; 