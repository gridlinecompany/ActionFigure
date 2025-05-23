import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAuth, useSession } from '@clerk/clerk-react'; // Import useAuth AND useSession
import '../style.css'; // Import base styles if needed
import { createClient } from '@supabase/supabase-js'; // Import createClient

interface Template {
    template_id: string;
    template_text: string;
}

// Define props interface for AdminSettings
interface AdminSettingsProps {
  onLogoUpdate: (newUrl: string | null) => void; // Callback prop
}

// Define constants for bucket and logo path
const LOGO_BUCKET = 'app-assets'; // <<< CHANGE THIS if your bucket name is different
const LOGO_PATH = 'public/logo.png'; // Fixed path for the logo file

const AdminSettings: React.FC<AdminSettingsProps> = ({ onLogoUpdate }) => {
    const { getToken } = useAuth(); // Get getToken function
    const { session } = useSession(); // Get session object
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<{ [key: string]: string }>({}); // For templates

    // --- State for Prompt Visibility ---
    const [showPromptsGlobally, setShowPromptsGlobally] = useState<boolean>(true);
    const [loadingPromptSetting, setLoadingPromptSetting] = useState<boolean>(true);
    const [promptSettingError, setPromptSettingError] = useState<string | null>(null);
    const [promptSettingSaveStatus, setPromptSettingSaveStatus] = useState<string>('');
    // ----------------------------------

    // --- State for Logo --- 
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null); // Display current logo
    const [logoFile, setLogoFile] = useState<File | null>(null); // Store selected file
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null); // State for the preview
    const [loadingLogo, setLoadingLogo] = useState<boolean>(true);
    const [logoSaveStatus, setLogoSaveStatus] = useState<string>(''); // Saving, Saved!, Error!
    const [logoError, setLogoError] = useState<string | null>(null);
    // ---------------------------------------------

    // Fetch all templates AND logo URL on mount
    useEffect(() => {
        const fetchData = async () => {
            if (!session) { // Wait for session
                // console.log("AdminSettings: No session, waiting...");
                // Optionally set loading state here if needed
                return;
            }
            // console.log("AdminSettings: Session found, fetching data...");

            setLoadingTemplates(true);
            setLoadingLogo(true);
            setLoadingPromptSetting(true); // <<< Start loading prompt setting
            setError(null);
            setLogoError(null);
            setPromptSettingError(null); // <<< Clear prompt setting error

            try {
                // --- Create temporary authenticated client ---
                const accessToken = await session.getToken({ template: 'supabase' });
                if (!accessToken) {
                    throw new Error('Could not get Supabase token from Clerk for admin data fetch.');
                }
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (!supabaseUrl || !supabaseAnonKey) {
                    throw new Error("Supabase URL/Anon key missing in .env for authenticated client.");
                }
                const authSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${accessToken}` } }
                });
                // --------------------------------------------

                // --- Fetch All Data Concurrently (Optional but efficient) ---
                const [templateResult, logoResult, promptSettingResult] = await Promise.all([
                    // Fetch Templates
                    authSupabaseClient.from('prompt_templates').select('template_id, template_text'),
                    // Fetch Logo URL
                    authSupabaseClient.from('settings').select('value').eq('setting_key', 'logo_url').maybeSingle(),
                    // Fetch Prompt Visibility Setting
                    authSupabaseClient.from('global_settings').select('show_prompts_globally').eq('id', 1).single() // Expect exactly one row
                ]);
                // ------------------------------------------------------------

                // Process Template Result
                const { data: templateData, error: templateError } = templateResult;
                // console.log("Template fetch result - Error:", templateError);
                // console.log("Template fetch result - Data:", templateData);
                if (templateError) {
                    // console.error("Template fetch error:", templateError);
                    if (templateError.message.includes('policy')) {
                        setError(`RLS Error fetching templates: ${templateError.message}. Check JWT role and policy.`);
                    } else {
                        setError(`Error loading templates: ${templateError.message}`);
                    }
                } else if (templateData) {
                    setTemplates(templateData);
                } else {
                    setError("Could not load templates (empty data).");
                }

                // Process Logo Result
                const { data: logoData, error: logoFetchError } = logoResult;
                // console.log("Logo setting fetch result - Error:", logoFetchError);
                // console.log("Logo setting fetch result - Data:", logoData);
                if (logoFetchError) {
                    // console.error('Error fetching logo URL setting:', logoFetchError.message);
                    setLogoError("Could not fetch current logo setting.");
                } else if (logoData && logoData.value) {
                    setCurrentLogoUrl(logoData.value);
                }

                // Process Prompt Visibility Result <<<
                const { data: promptSettingData, error: promptSettingFetchError } = promptSettingResult;
                // console.log("Prompt setting fetch result - Error:", promptSettingFetchError);
                // console.log("Prompt setting fetch result - Data:", promptSettingData);
                if (promptSettingFetchError) {
                    // console.error('Error fetching prompt visibility setting:', promptSettingFetchError.message);
                    // If the table/row doesn't exist yet, it might error. Handle this gracefully.
                    if (promptSettingFetchError.message.includes('Results contain 0 rows')) {
                        setPromptSettingError("Prompt setting not found in DB. Using default (Show). You might need to run the initial INSERT SQL.");
                        setShowPromptsGlobally(true); // Default to true if not found
                    } else {
                        setPromptSettingError(`Could not fetch prompt setting: ${promptSettingFetchError.message}`);
                    }
                } else if (promptSettingData) {
                    setShowPromptsGlobally(promptSettingData.show_prompts_globally);
                } else {
                     setPromptSettingError("Could not load prompt setting (empty data).");
                     setShowPromptsGlobally(true); // Default to true if no data
                }
                // ----------------------------------------

            } catch (err) {
                // console.error("Error fetching admin data:", err);
                const message = err instanceof Error ? err.message : "An unknown error occurred";
                // Set a general error or specific ones depending on what failed
                setError(`Error loading admin data: ${message}`);
                // Ensure specific errors are also set if available
                if (!logoError) setLogoError("Failed due to general error.");
                if (!promptSettingError) setPromptSettingError("Failed due to general error.");
            } finally {
                setLoadingTemplates(false);
                setLoadingLogo(false);
                setLoadingPromptSetting(false); // <<< Finish loading prompt setting
            }
        };

        fetchData();
    }, [session]); // Depend on session

    // Handle changes in textareas
    const handleTemplateChange = (templateId: string, newText: string) => {
        setTemplates(currentTemplates =>
            currentTemplates.map(t =>
                t.template_id === templateId ? { ...t, template_text: newText } : t
            )
        );
        // Clear save status when text changes
        setSaveStatus(prevStatus => ({ ...prevStatus, [templateId]: '' }));
    };

    // Handle saving a specific template
    const handleSaveTemplate = async (templateId: string) => {
        // console.log(`Attempting to save template: ${templateId}`);
        const templateToSave = templates.find(t => t.template_id === templateId);
        if (!templateToSave) {
            // console.error(`Template with ID ${templateId} not found in state.`);
            return;
        }
        // console.log("Template data to save:", templateToSave);

        setSaveStatus(prevStatus => ({ ...prevStatus, [templateId]: 'Saving...' }));
        setError(null);

        try {
            // --- Get token and create temporary client --- 
            const accessToken = await getToken({ template: 'supabase' });
            // console.log("Got Supabase token snippet:", accessToken ? accessToken.substring(0, 20) + '...' : 'null'); 
            if (!accessToken) {
                throw new Error('Could not get Supabase token from Clerk for template save.');
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error("Supabase URL/Anon key missing in .env for temporary client.");
            }

            const temporaryAuthenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                global: { 
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            });
            // ---------------------------------------------

            // console.log("Calling supabase.update for:", templateId, "(WITH .select(), using TEMP client)"); // <<< Modified Log
            // *** Use the temporary client ***
            const { error: updateError, data: updateData } = await temporaryAuthenticatedSupabase
                .from('prompt_templates')
                .update({ 
                    template_text: templateToSave.template_text, 
                    updated_at: new Date().toISOString() 
                 }) 
                .eq('template_id', templateId)
                .select();
            // *** End Modification ***

            // console.log("Supabase update result (with .select()) - Error:", updateError);
            // console.log("Supabase update result (with .select()) - Data:", updateData);

            if (updateError) {
                // console.error("Throwing update error:", updateError);
                throw updateError;
            }

            if (updateData && updateData.length > 0) {
                 // Update the specific template in the state with the confirmed data
                 setTemplates(currentTemplates =>
                     currentTemplates.map(t =>
                         t.template_id === templateId ? updateData[0] : t
                     )
                 );
                 setSaveStatus(prevStatus => ({ ...prevStatus, [templateId]: 'Saved!' })); 
            } else {
                // console.error(`Update for ${templateId} returned no data. RLS likely blocked based on JWT.`);
                setError(`Failed to save ${templateId}. RLS check failed with provided token.`);
                setSaveStatus(prevStatus => ({ ...prevStatus, [templateId]: 'Error (RLS?)' }));
            }

            setTimeout(() => {
                setSaveStatus(prevStatus => ({ ...prevStatus, [templateId]: '' }));
            }, 3000);

        } catch (err) {
            // console.error(`Error updating template ${templateId}:`, err);
            setError(`Failed to save ${templateId} template. Error: ${err instanceof Error ? err.message : String(err)}`);
            setSaveStatus(prevStatus => ({ ...prevStatus, [templateId]: 'Error!' }));
        }
    };

    // --- Handle Logo File Selection --- 
    const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        try {
            const file = e.target.files?.[0];
            const previousPreviewUrl = logoPreviewUrl;

            if (file) {
                const newPreviewUrl = URL.createObjectURL(file);
                
                setLogoFile(file);
                setLogoPreviewUrl(newPreviewUrl);

                if (previousPreviewUrl) {
                    URL.revokeObjectURL(previousPreviewUrl);
                }
                
                setLogoSaveStatus(''); 
                setLogoError(null);
            } else {
                setLogoFile(null);
                setLogoPreviewUrl(null);
                if (previousPreviewUrl) {
                    URL.revokeObjectURL(previousPreviewUrl);
                }
            }
            e.target.value = ""; 
        } catch (error) {
            // console.error("AdminSettings: Error inside handleLogoFileChange:", error);
        }
    };
    // -----------------------------------

    // --- Handle Uploading Logo and Saving URL --- 
    const handleUploadAndSaveLogo = async () => {
        if (!logoFile) {
            setLogoError("Please select a logo file to upload.");
            return;
        }

        setLogoSaveStatus('Uploading...');
        setLogoError(null);

        try {
            const accessToken = await getToken({ template: 'supabase' }); 
            if (!accessToken) {
                throw new Error('Could not get Supabase token from Clerk for authenticated operation.');
            }

            // --- Create Temporary Authenticated Client --- 
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error("Supabase URL/Anon key missing in .env for temporary client.");
            }

            const temporaryAuthenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                global: { 
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            });
            // ---------------------------------------------

            // 1. Upload the file using the *temporary authenticated* client
            const { error: uploadError } = await temporaryAuthenticatedSupabase.storage
                .from(LOGO_BUCKET)
                .upload(LOGO_PATH, logoFile, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: logoFile.type
                });

            if (uploadError) {
                // console.error("Supabase Upload Error Details:", uploadError);
                throw new Error(`Storage upload error: ${uploadError.message}`);
            }

            // 2. Get the public URL using the *temporary authenticated* client
            const { data: urlData } = temporaryAuthenticatedSupabase.storage
                .from(LOGO_BUCKET)
                .getPublicUrl(LOGO_PATH);
            const publicUrlWithTimestamp = `${urlData.publicUrl}?t=${new Date().getTime()}`;

            setLogoSaveStatus('Saving URL...');
            
            // 3. Save the public URL using the *temporary authenticated* client
            const { error: upsertError } = await temporaryAuthenticatedSupabase
                .from('settings')
                .upsert(
                    { setting_key: 'logo_url', value: publicUrlWithTimestamp },
                    { onConflict: 'setting_key' } 
                )
                .select();

            if (upsertError) {
                 // console.error("Supabase Settings Upsert Error Details:", upsertError);
                 throw new Error(`Settings save error: ${upsertError.message}`);
            }

            // 4. Update display state & cleanup
            const urlToRevoke = logoPreviewUrl;
            setCurrentLogoUrl(publicUrlWithTimestamp);
            // --- Call the parent callback --- 
            onLogoUpdate(publicUrlWithTimestamp);   // Inform the parent
            // --------------------------------
            setLogoFile(null); 
            setLogoPreviewUrl(null); 
            if (urlToRevoke) {
                URL.revokeObjectURL(urlToRevoke);
            }
            setLogoSaveStatus('Saved!');
            setTimeout(() => setLogoSaveStatus(''), 3000);

        } catch (err) {
            // console.error(`Error processing logo:`, err);
            const message = err instanceof Error ? err.message : "An unknown error occurred";
            if (message.includes('security policy') || message.includes('permission')) {
                 setLogoError("Failed to save logo: Check admin permissions/RLS on storage bucket or settings table.");
            } else {
                 setLogoError(`Failed to save logo: ${message}`);
            }
            setLogoSaveStatus('Error!');
            // If there was an error, maybe inform parent the logo is null?
            // onLogoUpdate(null); // Optional: Clear logo in parent on error
        }
    };
    // ------------------------------------------

    // --- Handle Toggling Prompt Visibility Setting --- <<<
    const handleTogglePrompts = async (event: ChangeEvent<HTMLInputElement>) => {
        const isChecked = event.target.checked;
        setShowPromptsGlobally(isChecked); // Optimistic update
        setPromptSettingSaveStatus('Saving...');
        setPromptSettingError(null);

        try {
            const accessToken = await getToken({ template: 'supabase' });
            if (!accessToken) {
                throw new Error('Could not get Supabase token from Clerk for saving setting.');
            }
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error("Supabase URL/Anon key missing in .env for authenticated client.");
            }
            const authSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: `Bearer ${accessToken}` } }
            });

            const { error: updateError } = await authSupabaseClient
                .from('global_settings')
                .update({ show_prompts_globally: isChecked, updated_at: new Date().toISOString() })
                .eq('id', 1);

            if (updateError) {
                throw updateError;
            }

            setPromptSettingSaveStatus('Saved!');
            setTimeout(() => setPromptSettingSaveStatus(''), 3000);

        } catch (err) {
            // console.error(`Error updating prompt visibility setting:`, err);
            // Revert optimistic update on error
            setShowPromptsGlobally(!isChecked);
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('policy') || message.includes('permission')) {
                 setPromptSettingError("Failed to save setting: Check admin permissions/RLS on global_settings table.");
            } else {
                 setPromptSettingError(`Failed to save setting: ${message}`);
            }
            setPromptSettingSaveStatus('Error!');
        }
    };
    // ---------------------------------------------------

    // Combine loading states for initial display
    if (loadingTemplates || loadingLogo || loadingPromptSetting) return <p>Loading admin settings...</p>; // Add prompt setting loading
    // Display global error first if it exists
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="admin-settings-container">
            {/* --- Logo Upload Section --- */} 
            <div className="admin-section logo-settings">
                <h3>Logo Image</h3>
                {logoError && <p className="error-message">{logoError}</p>}
                <div className="input-group" > 
                    {/* Display Preview OR Current Logo */} 
                    <div className="logo-preview-container">
                         {/* Show preview if a new file is selected, otherwise show current */} 
                         <p>{logoPreviewUrl ? "New Logo Preview:" : "Current Logo:"}</p>
                         <img 
                            // Restore original logic
                            src={logoPreviewUrl || currentLogoUrl || ''} 
                            alt={logoPreviewUrl ? "New logo preview" : "Current logo"}
                            className="current-logo-preview"
                            // Restore inline style
                            style={{ display: (logoPreviewUrl || currentLogoUrl) ? 'inline-block' : 'none' }} 
                        />
                        {/* Placeholder if no logo is set or selected */}
                        {!logoPreviewUrl && !currentLogoUrl && (
                            <div className="image-placeholder" style={{ height: '80px', width:'auto', minWidth:'150px', marginTop: '10px' }}>No logo set</div>
                        )}
                    </div>
                   
                    <label htmlFor="logo-file">Upload New Logo (overwrites existing):</label>
                    <input
                        type="file"
                        id="logo-file"
                        accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                        onChange={handleLogoFileChange}
                    />
                </div>
                <div className="save-button-container" >
                    <button 
                        onClick={handleUploadAndSaveLogo}
                        disabled={!logoFile || logoSaveStatus === 'Uploading...' || logoSaveStatus === 'Getting URL...' || logoSaveStatus === 'Saving URL...'}
                        className="clerk-button" 
                    >
                        {logoSaveStatus.startsWith('Saving') || logoSaveStatus.startsWith('Upload') || logoSaveStatus.startsWith('Getting') ? logoSaveStatus : 'Upload & Save Logo'}
                    </button>
                    {logoSaveStatus && !logoSaveStatus.startsWith('Upload') && !logoSaveStatus.startsWith('Getting') && !logoSaveStatus.startsWith('Saving') &&(
                        <span className="save-status-message" >
                            {logoSaveStatus}
                        </span>
                    )}
                </div>
            </div> 
            {/* ------------------------- */}

            {/* --- General Settings Section --- */}
            <div className="admin-section general-settings">
                <h3>General Settings</h3>
                {promptSettingError && <p className="error-message">{promptSettingError}</p>}
                <div className="input-group checkbox-group">
                    <label htmlFor="show-prompts-toggle">
                        Show Prompt Previews on Generator Pages:
                    </label>
                    <input
                        type="checkbox"
                        id="show-prompts-toggle"
                        checked={showPromptsGlobally}
                        onChange={handleTogglePrompts}
                        disabled={promptSettingSaveStatus === 'Saving...'}
                    />
                     {promptSettingSaveStatus && (
                        <span className="save-status-message" style={{ marginLeft: '10px' }}>
                            {promptSettingSaveStatus}
                        </span>
                    )}
                </div>
            </div>
            {/* ---------------------------- */}

            {/* --- Template Section --- */} 
             <div className="admin-section template-settings">
                <h3>Edit Prompt Templates</h3>
                {/* Display global error again if specific saves failed */}
                {error && Object.values(saveStatus).some(s => s === 'Error!') && <p className="error-message">{error}</p>} 
                
                {templates.length === 0 && !loadingTemplates && <p>No templates found.</p>}

                {templates.map(template => (
                    <div key={template.template_id} className="template-editor-item" >
                        <div className="input-group">
                            <label htmlFor={`template-${template.template_id}`} style={{ textTransform: 'capitalize' }}>
                                {template.template_id.replace(/([A-Z])/g, ' $1')} Template:
                            </label>
                            <textarea
                                id={`template-${template.template_id}`}
                                value={template.template_text}
                                onChange={(e) => handleTemplateChange(template.template_id, e.target.value)}
                                rows={8} 
                            />
                        </div>
                        <div className="save-button-container" >
                            <button 
                                onClick={() => handleSaveTemplate(template.template_id)}
                                disabled={saveStatus[template.template_id] === 'Saving...'}
                                className="clerk-button" 
                            >
                                {saveStatus[template.template_id] === 'Saving...' ? 'Saving...' : 'Save Changes'}
                            </button>
                            {saveStatus[template.template_id] && (
                                <span className="save-status-message" >
                                    {saveStatus[template.template_id]}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div> 
        </div>
    );
};

export default AdminSettings; 