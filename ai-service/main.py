"""
Awareness Network AI Processing Service
FastAPI-based microservice for OCR, document generation, and company enrichment
Uses PaddleOCR (free, open-source) for OCR and OpenAI for document generation
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import base64
import os
from openai import OpenAI
import json
import io
from PIL import Image
import numpy as np

# Import PaddleOCR
from paddleocr import PaddleOCR

app = FastAPI(
    title="Awareness Network AI Service",
    description="AI-powered OCR, document generation, and knowledge extraction",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR (supports 100+ languages, free and open-source)
# PP-OCRv5 with latest API - simplified initialization
paddle_ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    lang='ch'  # Chinese + English (can change to 'en' for English only)
)

# Initialize OpenAI client for document generation
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

# Request/Response Models
class OCRRequest(BaseModel):
    image_base64: str
    language: Optional[str] = "ch"  # 'ch' for Chinese+English, 'en' for English only

class OCRResponse(BaseModel):
    extracted_text: str
    structured_data: Optional[Dict[str, Any]] = None
    bounding_boxes: List[Dict[str, Any]]
    confidence: float

class DocumentGenerationRequest(BaseModel):
    extracted_text: str
    document_type: str = "general"  # 'business_card', 'meeting_notes', 'presentation', 'general'
    context: Optional[str] = None

class DocumentGenerationResponse(BaseModel):
    title: str
    content_md: str
    summary: str
    tags: List[str]
    metadata: Dict[str, Any]

class CompanyEnrichmentRequest(BaseModel):
    company_name: str

class CompanyEnrichmentResponse(BaseModel):
    name: str
    industry: str
    description: str
    website: Optional[str] = None
    employee_count: Optional[str] = None
    founded_year: Optional[int] = None
    headquarters: Optional[str] = None


@app.get("/")
async def root():
    return {
        "service": "Awareness Network AI Service",
        "version": "2.0.0",
        "status": "running",
        "ocr_engine": "PaddleOCR (PP-OCRv5)"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "paddleocr_ready": paddle_ocr is not None,
        "openai_configured": bool(os.getenv("OPENAI_API_KEY"))
    }


@app.post("/api/ocr", response_model=OCRResponse)
async def perform_ocr(request: OCRRequest):
    """
    Perform OCR on an image using PaddleOCR (free, open-source)
    Supports 100+ languages including Chinese, English, and more
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert PIL Image to numpy array for PaddleOCR
        img_array = np.array(image)
        
        # Perform OCR with PaddleOCR
        result = paddle_ocr.predict(img_array)
        
        # Parse PaddleOCR results (new API returns Result objects)
        extracted_text_lines = []
        bounding_boxes = []
        total_confidence = 0
        count = 0
        
        # New PaddleOCR API returns Result objects
        for res in result:
            if hasattr(res, 'rec_texts') and hasattr(res, 'rec_scores') and hasattr(res, 'rec_polys'):
                texts = res.rec_texts
                scores = res.rec_scores
                polys = res.rec_polys
                
                for i, text in enumerate(texts):
                    if text:  # Skip empty texts
                        confidence = float(scores[i]) if i < len(scores) else 0.0
                        poly = polys[i] if i < len(polys) else []
                        
                        extracted_text_lines.append(text)
                        bounding_boxes.append({
                            "text": text,
                            "confidence": confidence,
                            "bbox": poly.tolist() if hasattr(poly, 'tolist') else poly
                        })
                        
                        total_confidence += confidence
                        count += 1
        
        extracted_text = "\n".join(extracted_text_lines)
        avg_confidence = total_confidence / count if count > 0 else 0
        
        # Detect if it's a business card and extract structured data
        structured_data = None
        if len(extracted_text_lines) > 0:
            # Use simple heuristics to detect business cards
            # (contains name, phone, email patterns)
            has_phone = any("电话" in line or "Tel" in line or "Phone" in line for line in extracted_text_lines)
            has_email = any("@" in line for line in extracted_text_lines)
            
            if has_phone or has_email:
                # Try to extract structured contact information
                structured_data = await extract_contact_info(extracted_text)
        
        return OCRResponse(
            extracted_text=extracted_text,
            structured_data=structured_data,
            bounding_boxes=bounding_boxes,
            confidence=float(avg_confidence)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.post("/api/ocr/file")
async def perform_ocr_file(file: UploadFile = File(...)):
    """
    Perform OCR on an uploaded image file
    Supports common image formats: JPG, PNG, BMP, etc.
    """
    try:
        # Read uploaded file
        contents = await file.read()
        
        # Convert to base64
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Perform OCR
        request = OCRRequest(image_base64=image_base64)
        return await perform_ocr(request)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File OCR processing failed: {str(e)}")


async def extract_contact_info(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract structured contact information from OCR text using GPT-4o-mini
    This is used for business card parsing
    """
    if not os.getenv("OPENAI_API_KEY"):
        return None
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """Extract contact information from the text.
                    Return a JSON object with these fields (use null if not found):
                    - name: person's name
                    - title: job title
                    - company: company name
                    - email: email address
                    - phone: phone number
                    - address: physical address
                    - website: website URL
                    - wechat: WeChat ID (if mentioned)"""
                },
                {
                    "role": "user",
                    "content": f"Extract contact information from this text:\n\n{text}"
                }
            ],
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
        
    except Exception as e:
        print(f"Contact extraction failed: {e}")
        return None


@app.post("/api/generate-document", response_model=DocumentGenerationResponse)
async def generate_document(request: DocumentGenerationRequest):
    """
    Generate a structured knowledge document from extracted text
    Uses GPT-4o to create well-formatted Markdown content with summary and tags
    """
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503, 
            detail="OpenAI API key not configured. Document generation requires OpenAI API."
        )
    
    try:
        # Determine the document template based on type
        templates = {
            "business_card": """Create a professional contact profile document with:
            - Contact Details section
            - Company Overview (if available)
            - Notes section for future reference
            Format in clean Markdown.""",
            
            "meeting_notes": """Create structured meeting notes with:
            - Meeting Overview
            - Key Discussion Points
            - Action Items
            - Follow-up Tasks
            Format in clean Markdown with bullet points and sections.""",
            
            "presentation": """Create a presentation summary with:
            - Main Topic
            - Key Takeaways (numbered list)
            - Important Data/Statistics
            - References
            Format in clean Markdown.""",
            
            "general": """Create a well-structured knowledge document with:
            - Clear title and introduction
            - Main content organized in logical sections
            - Key insights highlighted
            - Summary at the end
            Format in clean Markdown."""
        }
        
        template = templates.get(request.document_type, templates["general"])
        context_prompt = f"\n\nAdditional context: {request.context}" if request.context else ""
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a knowledge management expert. 
                    Transform raw extracted text into well-structured, professional documents.
                    {template}
                    
                    Return a JSON object with:
                    - title: concise document title
                    - content_md: full Markdown content
                    - summary: 2-3 sentence summary
                    - tags: array of 3-5 relevant tags
                    - metadata: {{document_type, key_entities, main_topics}}"""
                },
                {
                    "role": "user",
                    "content": f"Transform this extracted text into a structured document:\n\n{request.extracted_text}{context_prompt}"
                }
            ],
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        
        return DocumentGenerationResponse(
            title=result.get("title", "Untitled Document"),
            content_md=result.get("content_md", ""),
            summary=result.get("summary", ""),
            tags=result.get("tags", []),
            metadata=result.get("metadata", {})
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")


@app.post("/api/enrich-company", response_model=CompanyEnrichmentResponse)
async def enrich_company_info(request: CompanyEnrichmentRequest):
    """
    Enrich company information using GPT-4o search capabilities
    This is a cost-effective alternative to paid APIs like Clearbit
    """
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key not configured. Company enrichment requires OpenAI API."
        )
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are a business intelligence analyst. 
                    Provide accurate, up-to-date information about companies.
                    Return a JSON object with these fields (use null if not found):
                    - name: official company name
                    - industry: primary industry/sector
                    - description: 2-3 sentence company description
                    - website: official website URL (if known)
                    - employee_count: approximate employee range (e.g., "50-200", "1000+")
                    - founded_year: year founded (if known)
                    - headquarters: city and country
                    
                    If information is not available, use null for that field."""
                },
                {
                    "role": "user",
                    "content": f"Provide detailed information about this company: {request.company_name}"
                }
            ],
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        
        return CompanyEnrichmentResponse(
            name=result.get("name", request.company_name),
            industry=result.get("industry", "Unknown"),
            description=result.get("description", ""),
            website=result.get("website"),
            employee_count=result.get("employee_count"),
            founded_year=result.get("founded_year"),
            headquarters=result.get("headquarters")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Company enrichment failed: {str(e)}")


@app.post("/api/extract-keywords")
async def extract_keywords(text: str = Form(...), max_keywords: int = Form(10)):
    """
    Extract key topics and entities from text for tagging and search
    """
    if not os.getenv("OPENAI_API_KEY"):
        # Fallback: simple keyword extraction without AI
        words = text.split()
        keywords = list(set([w for w in words if len(w) > 3]))[:max_keywords]
        return {
            "keywords": keywords,
            "entities": {"people": [], "organizations": [], "locations": []},
            "topics": []
        }
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""Extract the most important keywords and entities from the text.
                    Return a JSON object with:
                    - keywords: array of {max_keywords} most relevant keywords
                    - entities: {{people: [], organizations: [], locations: []}}
                    - topics: array of main topics/themes"""
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Keyword extraction failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
