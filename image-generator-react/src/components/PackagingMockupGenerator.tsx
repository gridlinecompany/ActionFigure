import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
// import { supabase } from '../supabaseClient'; // REMOVE global client
import { createClient } from '@supabase/supabase-js'; // ADD createClient
// import { useAuth } from '@clerk/clerk-react'; // Change this
import { useAuth, useSession } from '@clerk/clerk-react'; // ADD useSession
import '../style.css';

// Interface for Packaging Mockup form data
interface PackagingFormDataState {
    productName: string;
    brandName: string;
    description: string;
    packagingType: string; // e.g., Box, Pouch, Bottle
    style: string; // e.g., Minimalist, Vintage, Luxury
    size: string;
    quality: string;
    isTransparent: boolean;
}

const PackagingMockupGenerator: React.FC = () => {
    const { getToken } = useAuth();
    const { session } = useSession(); // Get session
    const [formData, setFormData] = useState<PackagingFormDataState>({
        productName: '',
        brandName: '',
        description: '',
        packagingType: 'Box', // Default value
        style: 'Minimalist', // Default value
        size: 'auto',
        quality: 'auto',
        isTransparent: false,
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [referenceImages, setReferenceImages] = useState<File[]>([]);
    const [promptTemplate, setPromptTemplate] = useState<string>("Loading template...");

    // Fetch Prompt Template on Mount
    useEffect(() => {
        const fetchTemplate = async () => {
            if (!session) {
                console.log("PackagingMockupGenerator: No session, cannot fetch template.");
                setPromptTemplate("Login required to load template.");
                return;
            }

            try {
                const accessToken = await getToken({ template: 'supabase' });
                if (!accessToken) {
                    throw new Error('Could not get Supabase token from Clerk.');
                }

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (!supabaseUrl || !supabaseAnonKey) {
                    throw new Error("Supabase URL/Key missing for authenticated client.");
                }

                // Create AUTHENTICATED Supabase client
                const authSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${accessToken}` } },
                });

                // Fetch using the authenticated client
                const { data, error } = await authSupabaseClient
                    .from('prompt_templates')
                    .select('template_text')
                    .eq('template_id', 'packaging') // Fetch the specific template
                    .single();

                if (error) throw error;

                if (data && data.template_text) {
                    setPromptTemplate(data.template_text);
                } else {
                    setPromptTemplate("Could not load template.");
                }
            } catch (error) {
                console.error("Error fetching packaging template:", error);
                setError(error instanceof Error ? error.message : String(error)); // Set error state
                setPromptTemplate("Error loading template.");
            }
        };

        fetchTemplate();
    }, [session, getToken]); // Depend on session and getToken

    // Handle text/select/checkbox input changes
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value, type } = e.target;
        if (type === 'checkbox') {
            const target = e.target as HTMLInputElement;
            setFormData((prevData) => ({
                ...prevData,
                [id]: target.checked,
            }));
        } else {
            setFormData((prevData) => ({
                ...prevData,
                [id]: value,
            }));
        }
    };

    // Handle multiple file uploads
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setReferenceImages(Array.from(e.target.files));
        } else {
            setReferenceImages([]);
        }
    };

    // Construct the prompt for packaging mockup
    const constructPrompt = (): string => {
        const { productName, brandName, description, packagingType, style } = formData;
        return `Create a realistic product packaging mockup for a product named "${productName}" by brand "${brandName}". Packaging type: ${packagingType}. Style: ${style}. Include the following description elements: ${description}. Ensure the mockup looks professional, suitable for marketing presentation, with appropriate lighting and context.`;
    };

    // Handle form submission
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setResultImage(null);

        // Validation (example: require product name, brand, description)
        if (!formData.productName.trim() || !formData.brandName.trim() || !formData.description.trim()) {
            setError("Please fill in Product Name, Brand Name, and Description.");
            return;
        }

        setLoading(true);
        const finalPrompt = constructPrompt();
        const { size, quality, isTransparent } = formData;
        console.log("Packaging Mockup Prompt:", finalPrompt);
        console.log(`Size: ${size}, Quality: ${quality}, Transparent: ${isTransparent}`);
        if (referenceImages.length > 0) {
            console.log(`Reference Images: ${referenceImages.map(f => f.name).join(', ')}`);
        }

        const dataToSend = new FormData();
        dataToSend.append('prompt', finalPrompt);
        dataToSend.append('size', size);
        dataToSend.append('quality', quality);
        dataToSend.append('background', isTransparent ? 'transparent' : 'opaque');
        
        if (referenceImages.length > 0) {
            referenceImages.forEach((file) => {
                dataToSend.append('image', file);
            });
        }

        try {
            // Get the Supabase token template from Clerk
            const accessToken = await getToken({ template: 'supabase' });
            if (!accessToken) {
                throw new Error('Could not get Supabase token from Clerk.');
            }

            // Use env var for the Supabase function URL
            const supabaseFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;
            const response = await fetch(supabaseFunctionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: dataToSend,
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData: { error?: string; message?: string } = await response.json();
                    errorMsg = errorData.error || errorData.message || errorMsg;
                } catch (parseError) {
                     try {
                         const errorText = await response.text();
                         errorMsg = `${errorMsg} - Server response: ${errorText}`;
                    } catch (textError) {
                         console.error("Failed to read error response as text:", textError);
                    }
                    console.error("Failed to parse error response as JSON:", parseError);
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            if (result.error) throw new Error(result.error);
            if (result.imageUrl) {
                setResultImage(result.imageUrl);
            } else {
                throw new Error('No image URL received from server.');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error generating packaging mockup:', err);
            setError(`Failed to generate mockup: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    // JSX for the Packaging Mockup Generator component
    return (
        <>
            <h2>Packaging Mockup Generator</h2>
            
            {/* Display the fetched prompt template */}
            <p className="prompt-template">
                {/* Render the template text, splitting to style placeholders */}
                {promptTemplate.split('[').map((part, index) => {
                    if (index === 0) return part; // First part is before the first placeholder
                    const placeholderContent = part.substring(0, part.indexOf(']'));
                    const restOfText = part.substring(part.indexOf(']') + 1);
                    return (
                        <React.Fragment key={index}>
                            <span className="placeholder">[{placeholderContent}]</span>
                            {restOfText}
                        </React.Fragment>
                    );
                })}
            </p>

            {/* Apply the layout class here */}
            <div className="generator-layout"> 
                <form onSubmit={handleSubmit}>
                    {/* Product Name Input */}
                    <div className="input-group">
                        <label htmlFor="productName">Product Name:</label>
                        <input
                            type="text"
                            id="productName"
                            placeholder="e.g., Organic Honey"
                            value={formData.productName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {/* Brand Name Input */}
                    <div className="input-group">
                        <label htmlFor="brandName">Brand Name:</label>
                        <input
                            type="text"
                            id="brandName"
                            placeholder="e.g., Nature's Gold"
                            value={formData.brandName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {/* Description Input */}
                    <div className="input-group">
                        <label htmlFor="description">Description/Key Features:</label>
                        <textarea
                            id="description"
                            placeholder="e.g., 100% Pure, Wildflower Source, 500g"
                            value={formData.description}
                            onChange={handleChange}
                            required
                        ></textarea>
                    </div>
                    {/* Packaging Type Dropdown */}
                    <div className="input-group">
                        <label htmlFor="packagingType">Packaging Type:</label>
                        <select id="packagingType" value={formData.packagingType} onChange={handleChange}>
                            <option value="Box">Box</option>
                            <option value="Pouch">Pouch</option>
                            <option value="Bottle">Bottle</option>
                            <option value="Jar">Jar</option>
                            <option value="Tube">Tube</option>
                            <option value="Can">Can</option>
                        </select>
                    </div>
                    {/* Style Dropdown */}
                    <div className="input-group">
                        <label htmlFor="style">Style:</label>
                        <select id="style" value={formData.style} onChange={handleChange}>
                            <option value="Minimalist">Minimalist</option>
                            <option value="Vintage">Vintage</option>
                            <option value="Modern">Modern</option>
                            <option value="Luxury">Luxury</option>
                            <option value="Playful">Playful</option>
                            <option value="Eco-friendly">Eco-friendly</option>
                        </select>
                    </div>
                    {/* Reference Image Upload (Optional) */}
                     <div className="input-group">
                        <label htmlFor="referenceImage">Reference Image(s) (Optional):</label>
                        <input 
                            type="file" 
                            id="referenceImage" 
                            onChange={handleFileChange} 
                            accept="image/png, image/jpeg, image/webp"
                            multiple
                        />
                    </div>
                     {/* Size Dropdown */}
                     <div className="input-group">
                        <label htmlFor="size">Size:</label>
                        <select id="size" value={formData.size} onChange={handleChange}>
                            <option value="auto">Auto (Default)</option>
                            <option value="1024x1024">1024x1024 (Square)</option>
                            <option value="1024x1536">1024x1536 (Portrait)</option>
                            <option value="1536x1024">1536x1024 (Landscape)</option>
                        </select>
                    </div>

                    {/* Quality Dropdown */}
                    <div className="input-group">
                        <label htmlFor="quality">Quality:</label>
                        <select id="quality" value={formData.quality} onChange={handleChange}>
                            <option value="auto">Auto (Default)</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    {/* Transparent Background Checkbox */}
                    <div className="input-group checkbox-group">
                        <input 
                            type="checkbox" 
                            id="isTransparent" 
                            checked={formData.isTransparent}
                            onChange={handleChange} 
                        />
                        <label htmlFor="isTransparent">Transparent Background (PNG/WebP only)</label>
                    </div>

                    {/* Submit Button */}
                    <button type="submit" id="generate-btn" disabled={loading}>
                         {loading ? (
                            <>
                                <span className="loading-spinner" style={{ width: '1em', height: '1em', marginRight: '8px', borderWidth: '2px' }}></span>
                                Generating...
                            </>
                        ) : (
                            <>
                                <span className="material-icons">auto_awesome</span>Generate Mockup
                            </>
                        )}
                    </button>
                    {error && <p className="error-message">{error}</p>} 
                </form>

                <div className="result-container">
                    <h2>Generated Mockup</h2>
                     {loading && (
                        <div className="loading-spinner"></div>
                    )}
                     {!loading && resultImage && (
                        <img id="result-image" src={resultImage} alt="Generated packaging mockup" />
                    )}
                    {!loading && !resultImage && (
                        <div className="image-placeholder">Your mockup will appear here</div>
                    )}
                </div>
            </div> 
        </>
    );
};

export default PackagingMockupGenerator; 