Generate Images
You can use the image generation endpoint to create images based on text prompts. To learn more about customizing the output (size, quality, format, transparency), refer to the customize image output section below.

You can set the n parameter to generate multiple images at once in a single request (by default, the API returns a single image).

Generate an image
from openai import OpenAI
import base64
client = OpenAI()

prompt = """
A children's book drawing of a veterinarian using a stethoscope to 
listen to the heartbeat of a baby otter.
"""

result = client.images.generate(
    model="gpt-image-1",
    prompt=prompt
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("otter.png", "wb") as f:
    f.write(image_bytes)
Edit Images
The image edits endpoint lets you:

Edit existing images
Generate new images using other images as a reference
Edit parts of an image by uploading an image and mask indicating which areas should be replaced (a process known as inpainting)
Create a new image using image references
You can use one or more images as a reference to generate a new image.

In this example, we'll use 4 input images to generate a new image of a gift basket containing the items in the reference images.

Body Lotion
Soap
Incense Kit
Bath Bomb
Bath Gift Set
Edit an image
import base64
from openai import OpenAI
client = OpenAI()

prompt = """
Generate a photorealistic image of a gift basket on a white background 
labeled 'Relax & Unwind' with a ribbon and handwriting-like font, 
containing all the items in the reference pictures.
"""

result = client.images.edit(
    model="gpt-image-1",
    image=[
        open("body-lotion.png", "rb"),
        open("bath-bomb.png", "rb"),
        open("incense-kit.png", "rb"),
        open("soap.png", "rb"),
    ],
    prompt=prompt
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("gift-basket.png", "wb") as f:
    f.write(image_bytes)
Edit an image using a mask (inpainting)
You can provide a mask to indicate where the image should be edited. The transparent areas of the mask will be replaced, while the black areas will be left unchanged.

You can use the prompt to describe the full new image, not just the erased area. If you provide multiple input images, the mask will be applied to the first image.

Image	Mask	Output
A pink room with a pool	A mask in part of the pool	The original pool with an inflatable flamigo replacing the mask
Edit an image
from openai import OpenAI
client = OpenAI()

result = client.images.edit(
    model="gpt-image-1",
    image=open("sunlit_lounge.png", "rb"),
    mask=open("mask.png", "rb"),
    prompt="A sunlit indoor lounge area with a pool containing a flamingo"
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("composition.png", "wb") as f:
    f.write(image_bytes)
Mask requirements
The image to edit and mask must be of the same format and size (less than 25MB in size).

The mask image must also contain an alpha channel. If you're using an image editing tool to create the mask, make sure to save the mask with an alpha channel.

Add an alpha channel to a black and white mask
Customize Image Output
You can configure the following output options:

Size: Image dimensions (e.g., 1024x1024, 1024x1536)
Quality: Rendering quality (e.g. low, medium, high)
Format: File output format
Compression: Compression level (0-100%) for JPEG and WebP formats
Background: Transparent or opaque
Size and quality options
Square images with standard quality are the fastest to generate. The default size is 1024x1024 pixels.

Available sizes	
1024x1024 (square)
1536x1024 (portrait)
1024x1536 (landscape)
auto (default)
Quality options	
low
medium
high
auto (default)
Output format
The Image API returns base64-encoded image data. The default format is png, but you can also request jpeg or webp.

If using jpeg or webp, you can also specify the output_compression parameter to control the compression level (0-100%). For example, output_compression=50 will compress the image by 50%.

Transparency
The gpt-image-1 model supports transparent backgrounds. To enable transparency, set the background parameter to transparent.

It is only supported with the png and webp output formats.

Transparency works best when setting the quality to medium or high.

Generate an image with a transparent background
from openai import OpenAI
import base64
client = OpenAI()

result = client.images.generate(
    model="gpt-image-1",
    prompt="Draw a 2D pixel art style sprite sheet of a tabby gray cat",
    size="1024x1024",
    background="transparent",
    quality="high",
)

image_base64 = result.json()["data"][0]["b64_json"]
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("sprite.png", "wb") as f:
    f.write(image_bytes)
Limitations
The GPT-4o Image model is a powerful and versatile image generation model, but it still has some limitations to be aware of:

Latency: Complex prompts may take up to 2 minutes to process.
Text Rendering: Although significantly improved over the DALL·E series, the model can still struggle with precise text placement and clarity.
Consistency: While capable of producing consistent imagery, the model may occasionally struggle to maintain visual consistency for recurring characters or brand elements across multiple generations.
Composition Control: Despite improved instruction following, the model may have difficulty placing elements precisely in structured or layout-sensitive compositions.
Content Moderation
All prompts and generated images are filtered in accordance with our content policy.

For image generation using gpt-image-1, you can control moderation strictness with the moderation parameter. This parameter supports two values:

auto (default): Standard filtering that seeks to limit creating certain categories of potentially age-inappropriate content.
low: Less restrictive filtering.
Cost and latency
This model generates images by first producing specialized image tokens. Both latency and eventual cost are proportional to the number of tokens required to render an image—larger image sizes and higher quality settings result in more tokens.

The number of tokens generated depends on image dimensions and quality:

Quality	Square (1024×1024)	Portrait (1024×1536)	Landscape (1536×1024)
Low	272 tokens	408 tokens	400 tokens
Medium	1056 tokens	1584 tokens	1568 tokens
High	4160 tokens	6240 tokens	6208 tokens
Note that you will also need to account for input text tokens used in the prompt.

Refer to our pricing page for more information about price per text and image tokens.

Was this page useful?
